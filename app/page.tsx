"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { DownloadStep } from "./components/DownloadStep";
import { PreviewStep } from "./components/PreviewStep";
import { UploadStep } from "./components/UploadStep";
import type {
  CellOverridesBySheet,
  ExcludedRowsBySheet,
  IssueSummary,
  ParseResponse,
  SheetData,
  TransformedSheetPreview,
  ValidationIssue,
} from "@/lib/client-types";
import { setManualMappingOverride, type ManualMapping } from "@/lib/manual-mapping";
import {
  createParsedSheetSelection,
  selectedSheetCount,
  type SheetSelection,
} from "@/lib/sheet-selection";

const STEP_LABELS = [
  "1. อัปโหลดไฟล์",
  "2. Preview + Mapping + Validate",
  "3. Export",
];

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const WORKBOOK_FILE_PATTERN = /\.xlsx?$/i;

interface CurrentTemplateStatus {
  isOverride: boolean;
  active: { originalFileName: string } | null;
}

function hasManualHeaderPin(sheet: SheetData): boolean {
  const debug = sheet.profileDebug;
  if (!debug || typeof debug !== "object" || !("manuallyPinned" in debug)) return false;
  return (debug as { manuallyPinned?: unknown }).manuallyPinned === true;
}

export default function Page() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<CurrentTemplateStatus | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  // Keep validation limited to parsed sheets. Sheet overview also contains
  // preserved/skipped entries, which must never become an empty export payload.
  const sheetSelection: SheetSelection = useMemo(() => {
    if (!parsed) return {};
    const selection = createParsedSheetSelection(parsed.sheets, parsed.sheetOverview || []);
    for (const sheet of parsed.sheets) {
      // A manually reparsed sheet must remain selectable so the user can rerun validation.
      if (sheet.rowCount > 0 && hasManualHeaderPin(sheet)) selection[sheet.sheetName] = true;
    }
    return selection;
  }, [parsed]);

  // mappingState[sheetName][templateColumn] = sourceColumn | ""
  const [mappingState, setMappingState] = useState<
    Record<string, ManualMapping>
  >({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [cellOverrides, setCellOverrides] = useState<CellOverridesBySheet>({});
  const [excludedRows, setExcludedRows] = useState<ExcludedRowsBySheet>({});

  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const [issueSummary, setIssueSummary] = useState<IssueSummary | null>(null);
  const [transformedSheets, setTransformedSheets] = useState<TransformedSheetPreview[]>([]);
  // True once a local edit (mapping/cell/exclude/reparse) makes the last
  // server-validated issues/issueSummary snapshot out of date.
  const [resultsStale, setResultsStale] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/v1/admin/template", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CurrentTemplateStatus | null) => setTemplateStatus(data))
      .catch(() => setTemplateStatus(null));
  }, []);

  const handleFile = useCallback((f: File) => {
    setError(null);
    if (!WORKBOOK_FILE_PATTERN.test(f.name)) {
      setFile(null);
      setError("รองรับเฉพาะไฟล์ .xlsx และ .xls");
      return;
    }
    if (!f.size) {
      setFile(null);
      setError("ไฟล์ที่เลือกไม่มีข้อมูล");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setError("ไฟล์ต้องมีขนาดไม่เกิน 20 MB");
      return;
    }
    setFile(f);
  }, []);

  const buildExportPayload = (
    parsedData: ParseResponse,
    manualMappingState: Record<string, ManualMapping>,
    cellOverrideState: CellOverridesBySheet,
    excludedRowState: ExcludedRowsBySheet,
    mode: "validate" | "download",
    selection: SheetSelection,
  ) => ({
    mode,
    analysisId: parsedData.analysisId,
    sourceFileName: parsedData.fileName,
    sheets: parsedData.sheets.filter((s) => selection[s.sheetName]).map((s) => ({
      sheetName: s.sheetName,
      headerRow: s.headerRowIndex + 1,
      autoMapping: s.mapping,
      manualMapping: manualMappingState[s.sheetName] || {},
      cellOverrides: cellOverrideState[s.sheetName] || {},
      excludedRows: excludedRowState[s.sheetName] || [],
    })),
  });

  const validateWorkbook = async (
    parsedData: ParseResponse,
    manualMappingState: Record<string, ManualMapping>,
    cellOverrideState: CellOverridesBySheet,
    excludedRowState: ExcludedRowsBySheet,
    selection: SheetSelection,
  ) => {
    const res = await fetch("/api/v1/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildExportPayload(
        parsedData,
        manualMappingState,
        cellOverrideState,
        excludedRowState,
        "validate",
        selection,
      )),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ตรวจสอบข้อมูลไม่สำเร็จ");
    setIssues(data.issues);
    setIssueSummary({
      errorCount: data.errorCount,
      warningCount: data.warningCount,
      totalRows: data.totalRows,
    });
    setTransformedSheets(data.transformedSheets || []);
    setResultsStale(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const uploadAndParse = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/parse", { method: "POST", body: fd });
      const data: ParseResponse = await res.json();
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาดในการอ่านไฟล์");
        setLoading(false);
        return;
      }
      setParsed(data);
      setActiveSheetIdx(0);

      const initMapping: Record<string, ManualMapping> = {};
      for (const sheet of data.sheets) {
        initMapping[sheet.sheetName] = {};
      }
      const initSelection = createParsedSheetSelection(data.sheets, data.sheetOverview || []);
      setMappingState(initMapping);
      setCellOverrides({});
      setExcludedRows({});
      if (selectedSheetCount(initSelection) > 0) {
        await validateWorkbook(data, initMapping, {}, {}, initSelection);
      } else {
        setIssues([]);
        setIssueSummary({ errorCount: 0, warningCount: 0, totalRows: 0 });
        setTransformedSheets([]);
      }
      setStep(1);
    } catch (e: any) {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const runValidation = async () => {
    if (!parsed || selectedSheetCount(sheetSelection) === 0) return;
    setLoading(true);
    setError(null);
    try {
      await validateWorkbook(parsed, mappingState, cellOverrides, excludedRows, sheetSelection);
      setStep(2);
    } catch (e: any) {
      setError(e.message || "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (sheetNames: string[]) => {
    const exportSelection: SheetSelection = Object.fromEntries(
      sheetNames.map((sheetName) => [sheetName, true]),
    );
    if (!parsed || selectedSheetCount(exportSelection) === 0) {
      setError("กรุณาเลือกอย่างน้อย 1 ชีตก่อนสร้างไฟล์");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildExportPayload(
          parsed,
          mappingState,
          cellOverrides,
          excludedRows,
          "download",
          exportSelection,
        )),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "สร้างไฟล์ไม่สำเร็จ");
        setLoading(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = parsed.fileName.replace(/\.[^/.]+$/, "");
      const sheetSuffix = sheetNames.length === 1
        ? `_${sheetNames[0].replace(/[\\/:*?"<>|]/g, "_")}`
        : "";
      a.download = `converted_template_${baseName}${sheetSuffix}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError("ดาวน์โหลดไม่สำเร็จ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setParsed(null);
    setMappingState({});
    setCellOverrides({});
    setExcludedRows({});
    setAdvancedOpen(false);
    setIssues(null);
    setIssueSummary(null);
    setTransformedSheets([]);
    setResultsStale(false);
    setError(null);
  };

  const updateMapping = (
    sheetName: string,
    templateColumn: string,
    sourceColumn: string | null | undefined,
  ) => {
    setMappingState((prev) => ({
      ...prev,
      [sheetName]: setManualMappingOverride(
        prev[sheetName] || {},
        templateColumn,
        sourceColumn,
      ),
    }));
    // Mapping changes invalidate the previous server-side validation result,
    // but keep the last snapshot on screen (marked stale) instead of wiping it.
    setResultsStale(true);
  };

  const mappedCountForSheet = (sheetName: string) => {
    const sheet = parsed?.sheets.find((item) => item.sheetName === sheetName);
    const m = mappingState[sheetName] || {};
    const autoMap = Object.fromEntries(
      (sheet?.mapping || []).map((item) => [item.templateColumn, item.sourceColumn || ""]),
    );
    return Object.values({ ...autoMap, ...m }).filter(Boolean).length;
  };

  const updateCellOverride = (
    sheetName: string,
    rowIndex: number,
    templateColumn: string,
    value: string,
  ) => {
    setCellOverrides((prev) => ({
      ...prev,
      [sheetName]: {
        ...(prev[sheetName] || {}),
        [rowIndex]: {
          ...(prev[sheetName]?.[rowIndex] || {}),
          [templateColumn]: value,
        },
      },
    }));
    setResultsStale(true);
  };

  const toggleExcludedRow = (sheetName: string, rowIndex: number) => {
    setExcludedRows((prev) => {
      const current = prev[sheetName] || [];
      const next = current.includes(rowIndex)
        ? current.filter((index) => index !== rowIndex)
        : [...current, rowIndex].sort((a, b) => a - b);
      return { ...prev, [sheetName]: next };
    });
    setResultsStale(true);
  };

  const resetSheetFixes = (sheetName: string) => {
    setCellOverrides((prev) => {
      const next = { ...prev };
      delete next[sheetName];
      return next;
    });
    setExcludedRows((prev) => {
      const next = { ...prev };
      delete next[sheetName];
      return next;
    });
    setResultsStale(true);
  };

  const reparseSheet = async (
    sheetName: string,
    headerRow: number,
    dataStartRow?: number,
    dataEndRow?: number,
  ) => {
    if (!parsed?.analysisId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/reparse-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: parsed.analysisId,
          sheetName,
          headerRow,
          ...(dataStartRow !== undefined ? { dataStartRow } : {}),
          ...(dataEndRow !== undefined ? { dataEndRow } : {}),
        }),
      });
      const data: { sheet?: SheetData; error?: string } = await res.json();
      if (!res.ok || !data.sheet) {
        throw new Error(data.error || "วิเคราะห์ชีตใหม่ไม่สำเร็จ");
      }

      const reparsedSheet = data.sheet;
      setParsed((current) => {
        if (!current) return current;
        const sheetIndex = current.sheets.findIndex((sheet) => sheet.sheetName === sheetName);
        if (sheetIndex < 0) return current;
        const sheets = [...current.sheets];
        sheets[sheetIndex] = reparsedSheet;
        return {
          ...current,
          sheets,
          sheetOverview: current.sheetOverview.map((overview) =>
            overview.sheetName === sheetName
              ? {
                  ...overview,
                  eligibility: reparsedSheet.eligibility,
                  reason: reparsedSheet.eligibilityReason,
                  rowCount: reparsedSheet.rowCount,
                  errorCount: reparsedSheet.summary.errorCount,
                  warningCount: reparsedSheet.summary.warningCount,
                  confidence: reparsedSheet.confidence,
                }
              : overview,
          ),
        };
      });
      setMappingState((current) => ({ ...current, [sheetName]: {} }));
      setCellOverrides((current) => {
        const next = { ...current };
        delete next[sheetName];
        return next;
      });
      setExcludedRows((current) => {
        const next = { ...current };
        delete next[sheetName];
        return next;
      });
      // Reparsing shifts row indices, so the old issues no longer line up
      // with the new rows - unlike other edits, this snapshot can't be kept.
      setIssues(null);
      setIssueSummary(null);
      setResultsStale(true);
      setAdvancedOpen(false);
    } catch (e: any) {
      const message = e.message || "วิเคราะห์ชีตใหม่ไม่สำเร็จ";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = selectedSheetCount(sheetSelection);

  return (
    <div className="page">
      <div className="header">
        <div className="brand">
          <div className="brand-tag" />
          <div>
            <h1>ตัวกลางแปลงไฟล์สินทรัพย์</h1>
            <p>แปลงข้อมูล Excel หลายชีตให้ตรงเทมเพลตบริษัท</p>
            <p className="template-indicator">
              Template ที่ใช้อยู่: {templateStatus
                ? templateStatus.isOverride && templateStatus.active
                  ? templateStatus.active.originalFileName
                  : "Template มาตรฐาน (ค่าเริ่มต้น)"
                : "กำลังตรวจสอบ..."}
            </p>
          </div>
        </div>
        <div className="steps">
          {STEP_LABELS.map((label, idx) => (
            <span
              key={label}
              className={`step-chip ${
                idx === step ? "active" : idx < step ? "done" : ""
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && (
        <div className="loading-bar">
          <div className="fill" />
        </div>
      )}

      <div className="panel">
        {step === 0 && (
          <UploadStep
            file={file}
            dragActive={dragActive}
            setDragActive={setDragActive}
            onDrop={onDrop}
            inputRef={inputRef}
            handleFile={handleFile}
            setFile={setFile}
            onNext={uploadAndParse}
            loading={loading}
          />
        )}

        {step === 1 && parsed && (
          <PreviewStep
            parsed={parsed}
            activeSheetIdx={activeSheetIdx}
            setActiveSheetIdx={(idx: number) => {
              setActiveSheetIdx(idx);
              setAdvancedOpen(false);
            }}
            mappingState={mappingState}
            cellOverrides={cellOverrides}
            excludedRows={excludedRows}
            onBack={() => setStep(0)}
            updateMapping={updateMapping}
            updateCellOverride={updateCellOverride}
            toggleExcludedRow={toggleExcludedRow}
            resetSheetFixes={resetSheetFixes}
            reparseSheet={reparseSheet}
            mappedCountForSheet={mappedCountForSheet}
            issues={issues}
            issueSummary={issueSummary}
            resultsStale={resultsStale}
            advancedOpen={advancedOpen}
            setAdvancedOpen={setAdvancedOpen}
            onNext={runValidation}
            canContinue={selectedCount > 0}
            loading={loading}
          />
        )}

        {step === 2 && parsed && (
          <DownloadStep
            parsed={parsed}
            issues={issues}
            issueSummary={issueSummary}
            transformedSheets={transformedSheets}
            onBack={() => setStep(1)}
            onDownload={downloadFile}
            onReset={reset}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
