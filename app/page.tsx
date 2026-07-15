"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { DownloadStep } from "./components/DownloadStep";
import { PreviewStep } from "./components/PreviewStep";
import { UploadStep } from "./components/UploadStep";
import type { IssueSummary, ParseResponse, ValidationIssue } from "@/lib/client-types";
import { setManualMappingOverride, type ManualMapping } from "@/lib/manual-mapping";
import {
  createDefaultSheetSelection,
  selectedSheetCount,
  type SheetSelection,
} from "@/lib/sheet-selection";

const STEP_LABELS = [
  "1. อัปโหลดไฟล์",
  "2. Sheet overview",
  "3. Preview + validate",
  "4. Export",
];

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const WORKBOOK_FILE_PATTERN = /\.xlsx?$/i;

export default function Page() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  // Every sheet that qualifies under the default export policy is
  // included automatically; there is no user-facing sheet toggle.
  const sheetSelection: SheetSelection = useMemo(
    () => (parsed ? createDefaultSheetSelection(parsed.sheetOverview || []) : {}),
    [parsed],
  );

  // mappingState[sheetName][templateColumn] = sourceColumn | ""
  const [mappingState, setMappingState] = useState<
    Record<string, ManualMapping>
  >({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const [issueSummary, setIssueSummary] = useState<IssueSummary | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

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
    })),
  });

  const validateWorkbook = async (
    parsedData: ParseResponse,
    manualMappingState: Record<string, ManualMapping>,
    selection: SheetSelection,
  ) => {
    const res = await fetch("/api/v1/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildExportPayload(parsedData, manualMappingState, "validate", selection)),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ตรวจสอบข้อมูลไม่สำเร็จ");
    setIssues(data.issues);
    setIssueSummary({
      errorCount: data.errorCount,
      warningCount: data.warningCount,
      totalRows: data.totalRows,
    });
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
      const initSelection = createDefaultSheetSelection(data.sheetOverview || []);
      setMappingState(initMapping);
      await validateWorkbook(data, initMapping, initSelection);
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
      await validateWorkbook(parsed, mappingState, sheetSelection);
      setStep(3);
    } catch (e: any) {
      setError(e.message || "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async () => {
    if (!parsed || selectedSheetCount(sheetSelection) === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildExportPayload(parsed, mappingState, "download", sheetSelection)),
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
      a.download = `converted_template_${baseName}.xlsx`;
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
    setAdvancedOpen(false);
    setIssues(null);
    setIssueSummary(null);
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
    // Mapping changes invalidate the previous server-side validation result.
    setIssues(null);
    setIssueSummary(null);
  };

  const mappedCountForSheet = (sheetName: string) => {
    const sheet = parsed?.sheets.find((item) => item.sheetName === sheetName);
    const m = mappingState[sheetName] || {};
    const autoMap = Object.fromEntries(
      (sheet?.mapping || []).map((item) => [item.templateColumn, item.sourceColumn || ""]),
    );
    return Object.values({ ...autoMap, ...m }).filter(Boolean).length;
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
            onBack={() => setStep(0)}
            updateMapping={updateMapping}
            mappedCountForSheet={mappedCountForSheet}
            issues={issues}
            issueSummary={issueSummary}
            advancedOpen={advancedOpen}
            setAdvancedOpen={setAdvancedOpen}
            onNext={runValidation}
            canContinue={selectedCount > 0}
            loading={loading}
          />
        )}

        {step === 3 && parsed && (
          <DownloadStep
            parsed={parsed}
            issues={issues}
            issueSummary={issueSummary}
            onBack={() => setStep(1)}
            onDownload={downloadFile}
            onReset={reset}
            loading={loading}
            selectedSheetCount={selectedCount}
          />
        )}
      </div>
    </div>
  );
}
