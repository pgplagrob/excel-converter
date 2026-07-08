"use client";

import { useState, useRef, useCallback } from "react";
import { DownloadStep } from "./components/DownloadStep";
import { PreviewStep } from "./components/PreviewStep";
import { UploadStep } from "./components/UploadStep";
import type { IssueSummary, ParseResponse, ValidationIssue } from "@/lib/client-types";

const STEP_LABELS = [
  "1. อัปโหลดไฟล์",
  "2. Sheet overview",
  "3. Preview + validate",
  "4. Export",
];

export default function Page() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  // mappingState[sheetName][templateColumn] = sourceColumn | ""
  const [mappingState, setMappingState] = useState<
    Record<string, Record<string, string>>
  >({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const [issueSummary, setIssueSummary] = useState<IssueSummary | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setError(null);
    setFile(f);
  }, []);

  const buildExportPayload = (
    parsedData: ParseResponse,
    manualMappingState: Record<string, Record<string, string>>,
    mode: "validate" | "download",
  ) => ({
    mode,
    sourceFileName: parsedData.fileName,
    sheets: parsedData.sheets.map((s) => ({
      sheetName: s.sheetName,
      rows: s.rows,
      headerRow: s.headerRowIndex + 1,
      autoMapping: s.mapping,
      manualMapping: manualMappingState[s.sheetName] || {},
    })),
  });

  const validateWorkbook = async (
    parsedData: ParseResponse,
    manualMappingState: Record<string, Record<string, string>>,
  ) => {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildExportPayload(parsedData, manualMappingState, "validate")),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ตรวจสอบข้อมูลไม่สำเร็จ");
    console.log("[Transform] template dataset", data.transformedSheets);
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
      const res = await fetch("/api/parse", { method: "POST", body: fd });
      const data: ParseResponse = await res.json();
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาดในการอ่านไฟล์");
        setLoading(false);
        return;
      }
      console.log("[DataSource] parsed workbook", data);
      setParsed(data);
      setActiveSheetIdx(0);

      const initMapping: Record<string, Record<string, string>> = {};
      for (const sheet of data.sheets) {
        initMapping[sheet.sheetName] = {};
      }
      setMappingState(initMapping);
      await validateWorkbook(data, initMapping);
      setStep(1);
    } catch (e: any) {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const runValidation = async () => {
    if (!parsed) return;
    setLoading(true);
    setError(null);
    try {
      await validateWorkbook(parsed, mappingState);
      setStep(3);
    } catch (e: any) {
      setError(e.message || "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async () => {
    if (!parsed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildExportPayload(parsed, mappingState, "download")),
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

  const activeSheet = parsed?.sheets[activeSheetIdx];

  const updateMapping = (
    sheetName: string,
    templateColumn: string,
    sourceColumn: string
  ) => {
    setMappingState((prev) => ({
      ...prev,
      [sheetName]: { ...prev[sheetName], [templateColumn]: sourceColumn },
    }));
  };

  const mappedCountForSheet = (sheetName: string) => {
    const sheet = parsed?.sheets.find((item) => item.sheetName === sheetName);
    const m = mappingState[sheetName] || {};
    const autoMap = Object.fromEntries(
      (sheet?.mapping || []).map((item) => [item.templateColumn, item.sourceColumn || ""]),
    );
    return Object.values({ ...autoMap, ...m }).filter(Boolean).length;
  };

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

        {step === 1 && parsed && activeSheet && (
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
          />
        )}
      </div>
    </div>
  );
}
