"use client";

import { useState, useRef, useCallback, useMemo } from "react";

type MappingMethod = "exact" | "alias" | "fuzzy" | "none";
type MappingConfidence = "high" | "medium" | "low" | "none";
type MappingStatus = "matched" | "guessed" | "missing" | "manual";
type SheetStatus = "success" | "warning" | "error" | "skipped";

interface MappingSuggestion {
  templateColumn: string;
  sourceColumn: string | null;
  confidence: MappingConfidence;
  confidenceScore: number;
  status: MappingStatus;
  method: MappingMethod;
}

interface SheetSummary {
  sheetName: string;
  status: SheetStatus;
  rowCount: number;
  headerRow?: number;
  errorCount: number;
  warningCount: number;
  reason?: string;
}

interface SheetData {
  sheetName: string;
  headerRowIndex: number;
  summary: SheetSummary;
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, any>[];
  rows: Record<string, any>[];
  mapping: MappingSuggestion[];
}

interface ParseResponse {
  fileName: string;
  sheets: SheetData[];
  skippedSheets: string[];
  skippedSheetSummaries: SheetSummary[];
  error?: string;
}

interface ValidationIssue {
  sheetName: string;
  rowIndex: number;
  column: string;
  message: string;
  severity: "error" | "warning";
}

const STEP_LABELS = [
  "① อัปโหลดไฟล์",
  "② Sheet overview",
  "③ Preview + validate",
  "④ Export",
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
  const [issueSummary, setIssueSummary] = useState<{
    errorCount: number;
    warningCount: number;
    totalRows: number;
  } | null>(null);

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
      a.download = "converted_template.xlsx";
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
            <p>แปลงข้อมูล Excel หลายชีตให้ตรงเทมเพลตมาตรฐาน 44 คอลัมน์</p>
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

// ---------- Step 1: Upload ----------

function UploadStep({
  file,
  dragActive,
  setDragActive,
  onDrop,
  inputRef,
  handleFile,
  setFile,
  onNext,
  loading,
}: any) {
  return (
    <>
      <p className="eyebrow">Step 1</p>
      <h2>อัปโหลดไฟล์ Excel</h2>
      <p className="lead">
        รองรับไฟล์ .xlsx / .xls ที่มีหลายชีต
        ระบบจะตรวจหาชีตที่มีข้อมูลสินทรัพย์ให้อัตโนมัติ
      </p>

      {!file ? (
        <label
          className={`dropzone ${dragActive ? "drag" : ""}`}
          onDragOver={(e: React.DragEvent) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <div className="icon" />
          <div className="main">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</div>
          <div className="sub">.xlsx, .xls — ไม่จำกัดจำนวนชีต</div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      ) : (
        <div className="filebar">
          <span className="name">
            📄 {file.name}{" "}
            <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>
              ({(file.size / 1024).toFixed(0)} KB)
            </span>
          </span>
          <button onClick={() => setFile(null)}>ลบไฟล์</button>
        </div>
      )}

      <div className="actions">
        <span />
        <button
          className="btn amber"
          disabled={!file || loading}
          onClick={onNext}
        >
          {loading ? "กำลังอ่านไฟล์..." : "อ่านไฟล์และดำเนินการต่อ →"}
        </button>
      </div>
    </>
  );
}

// ---------- Step 2: Preview — แสดง 44 คอลัมน์เทมเพลตตรึงไว้ ----------

// 44 คอลัมน์เทมเพลต (ซ้ำกับ lib/mapping.ts เพื่อให้ client ใช้ได้โดยไม่ต้อง import server lib)
const TEMPLATE_COLS = [
  "RFID/QR CODE","รหัสสินทรัพย์ Elaas","รหัสสินทรัพย์","รหัสสินทรัพย์ (ส่วนประกอบ)",
  "ชื่อสินทรัพย์","รายละเอียด","ระบุอื่น ๆ","ประเภทสินทรัพย์","ชนิดสินทรัพย์",
  "รายการสินทรัพย์","หน่วยนับ","อาคาร","ห้อง","ได้มาโดย","ได้มาจาก","แหล่งงบประมาณ",
  "มูลค่า","วันที่ได้รับ","วันที่ได้รับโอน","วันที่ออกจำหน่าย","วันที่เริ่มรับประกัน",
  "วันที่หมดประกัน","อายุการรับประกัน","อายุการใช้งาน","ผู้ถือครอง","สำนัก","ฝ่าย",
  "งาน","งานที่รับผิดชอบ","สถานะ","ต้องตรวจนับ","คิดค่าเสื่อม","ของสำคัญ",
  "ค่าเสื่อมสะสมยกมา","ณ วันที่ (ค่าเสื่อมยกมา)","ส่งคืนสินทรัพย์","เงินงบประมาณ",
  "เงินสะสม/เงินทุนสำรองเงินสะสม","เงินอุดหนุนระบุวัตถุประสงค์/เฉพาะกิจ","เงินรับฝาก",
  "รับโอน/รับบริจาค","เงินกู้","รายได้สะสม","ทุนดำเนินการ",
];

function statusIcon(status: SheetStatus): string {
  if (status === "success") return "✓";
  if (status === "warning") return "!";
  if (status === "error") return "×";
  return "skipped";
}

function statusLabel(status: SheetStatus): string {
  if (status === "success") return "success";
  if (status === "warning") return "warning";
  if (status === "error") return "error";
  return "skipped";
}

function summaryText(summary: SheetSummary): string {
  if (summary.status === "skipped") return "skipped";
  if (summary.errorCount > 0) return `${summary.errorCount} errors`;
  if (summary.warningCount > 0) return `${summary.warningCount} warnings`;
  return `${summary.rowCount} rows`;
}

function createRuntimeSheetSummary(
  sheet: SheetData,
  sheetIssues: ValidationIssue[],
): SheetSummary {
  const errorCount = sheetIssues.filter((issue) => issue.severity === "error").length;
  const warningCount =
    sheetIssues.filter((issue) => issue.severity === "warning").length +
    (sheet.summary?.warningCount || 0);
  return {
    sheetName: sheet.sheetName,
    status: errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "success",
    rowCount: sheet.rowCount,
    headerRow: sheet.headerRowIndex + 1,
    errorCount,
    warningCount,
  };
}

function IssueList({ issues, emptyText }: { issues: ValidationIssue[]; emptyText: string }) {
  if (!issues.length) {
    return (
      <div className="success-block inline">
        <div className="icon">✓</div>
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="issue-list">
      {issues.slice(0, 200).map((issue, idx) => (
        <div className={`issue-row ${issue.severity}`} key={idx}>
          <span className="tag">{issue.severity === "error" ? "error" : "warning"}</span>
          <span>
            <strong>{issue.sheetName}</strong>{" "}
            {issue.rowIndex >= 0 ? `แถวที่ ${issue.rowIndex + 1}` : "ระดับชีต"}
            {issue.column ? ` · ${issue.column}` : ""}: {issue.message}
          </span>
        </div>
      ))}
    </div>
  );
}

function PreviewStep({
  parsed,
  activeSheetIdx,
  setActiveSheetIdx,
  mappingState,
  updateMapping,
  mappedCountForSheet,
  issues,
  issueSummary,
  advancedOpen,
  setAdvancedOpen,
  onBack,
  onNext,
  loading,
}: any) {
  const sheet: SheetData = parsed.sheets[activeSheetIdx];
  const previewRows = sheet.rows.slice(0, 30);
  const displayCols = sheet.headers;
  const sheetMap: Record<string, string> = mappingState[sheet.sheetName] || {};
  const sheetIssues = ((issues || []) as ValidationIssue[]).filter(
    (issue) => issue.sheetName === sheet.sheetName,
  );
  const currentSummary = createRuntimeSheetSummary(sheet, sheetIssues);
  const visibleMappings = sheet.mapping.map((m) => {
    const manualSource = sheetMap[m.templateColumn];
    return {
      ...m,
      sourceColumn: manualSource !== undefined ? manualSource || null : m.sourceColumn,
      status: manualSource !== undefined ? "manual" : m.status,
      confidence: manualSource !== undefined ? "high" : m.confidence,
    };
  });

  return (
    <>
      <p className="eyebrow">Auto mapping default</p>
      <h2>ตรวจสอบชีต พรีวิว และผล Validation</h2>
      <p className="lead">
        พบ {parsed.sheets.length} ชีตที่แปลงได้
        {parsed.skippedSheets.length > 0 &&
          ` และข้าม ${parsed.skippedSheets.length} ชีต (${parsed.skippedSheets.join(", ")})`}
        ระบบจับคู่คอลัมน์และตรวจสอบเบื้องต้นให้อัตโนมัติ สามารถแก้เฉพาะกรณีที่ mapping ผิดได้จาก Advanced Mapping
      </p>

      <div className="sheet-tabs">
        {parsed.sheets.map((s: SheetData, idx: number) => {
          const summary = createRuntimeSheetSummary(
            s,
            ((issues || []) as ValidationIssue[]).filter((issue) => issue.sheetName === s.sheetName),
          );
          return (
            <button
              key={s.sheetName}
              className={`sheet-tab ${summary.status} ${idx === activeSheetIdx ? "active" : ""}`}
              onClick={() => setActiveSheetIdx(idx)}
              title={`Header row ${summary.headerRow || "-"} · ${summary.errorCount} errors · ${summary.warningCount} warnings`}
            >
              <span className="status-dot">{statusIcon(summary.status)}</span>
              {s.sheetName}
              <span className="count">{summaryText(summary)}</span>
            </button>
          );
        })}
        {(parsed.skippedSheetSummaries || []).map((summary: SheetSummary) => (
          <span key={summary.sheetName} className="sheet-tab skipped muted">
            <span className="status-dot">{statusIcon("skipped")}</span>
            {summary.sheetName}
            <span className="count">skipped</span>
          </span>
        ))}
      </div>

      <div className="sheet-meta">
        <span>สถานะ: {statusLabel(currentSummary.status)}</span>
        <span>{currentSummary.rowCount} rows</span>
        <span>Header row: {currentSummary.headerRow || "-"}</span>
        <span>{currentSummary.errorCount} errors</span>
        <span>{currentSummary.warningCount} warnings</span>
        <span>Mapped {mappedCountForSheet(sheet.sheetName)}/44 columns</span>
      </div>

      <h3>Source Preview</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {displayCols.map((col) => (
                <th key={col}>
                  <div>{col}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row: any, i: number) => (
              <tr key={i}>
                {displayCols.map((col) => (
                  <td key={col}>{row[col] || <span style={{ color: "#ccc" }}>—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        แสดงตัวอย่าง {previewRows.length} แถวแรกจากทั้งหมด {sheet.rowCount} แถว
      </p>

      <h3>Mapping Summary</h3>
      <div className="table-wrap compact">
        <table>
          <thead>
            <tr>
              <th>Template Column</th>
              <th>Source Column</th>
              <th>Confidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleMappings.map((m: MappingSuggestion) => (
              <tr key={m.templateColumn}>
                <td>{m.templateColumn}</td>
                <td>{m.sourceColumn || <span className="muted-text">ไม่พบคอลัมน์</span>}</td>
                <td>
                  <span className={`badge ${m.confidence}`}>{m.confidence}</span>
                </td>
                <td>
                  <span className={`badge ${m.status}`}>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="advanced-box">
        <button className="btn secondary" onClick={() => setAdvancedOpen(!advancedOpen)}>
          {advancedOpen ? "ซ่อน Advanced Mapping" : "แก้ไขการจับคู่คอลัมน์"}
        </button>
        {advancedOpen && (
          <div className="manual-mapping">
            {sheet.mapping.map((m: MappingSuggestion) => {
              const current = sheetMap[m.templateColumn] ?? m.sourceColumn ?? "";
              const isManual = sheetMap[m.templateColumn] !== undefined;
              return (
                <div className="map-row" key={m.templateColumn}>
                  <div className="tmpl-col">{m.templateColumn}</div>
                  <div className="arrow">→</div>
                  <select
                    value={current}
                    onChange={(e) =>
                      updateMapping(sheet.sheetName, m.templateColumn, e.target.value)
                    }
                  >
                    <option value="">— ไม่จับคู่ —</option>
                    {sheet.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className={`badge ${isManual ? "manual" : m.method}`}>
                    {isManual ? "manual" : m.method}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <h3>Validation Result</h3>
      {issueSummary && (
        <div className="summary-grid small">
          <div className="summary-card">
            <div className="num">{issueSummary.totalRows}</div>
            <div className="label">แถวทั้งหมด</div>
          </div>
          <div className={`summary-card ${issueSummary.errorCount > 0 ? "error" : "ok"}`}>
            <div className="num">{issueSummary.errorCount}</div>
            <div className="label">Errors</div>
          </div>
          <div className="summary-card">
            <div className="num">{issueSummary.warningCount}</div>
            <div className="label">Warnings</div>
          </div>
        </div>
      )}
      <IssueList issues={sheetIssues} emptyText="ชีตนี้ไม่พบปัญหา พร้อม export ได้" />

      <div className="actions">
        <button className="btn secondary" onClick={onBack}>
          ← ย้อนกลับ
        </button>
        <button className="btn amber" disabled={loading} onClick={onNext}>
          {loading ? "กำลังตรวจสอบ..." : "ตรวจสอบอีกครั้งและไป Export →"}
        </button>
      </div>
    </>
  );
}

// ---------- Step 3: Mapping ----------

function MappingStep({
  parsed,
  activeSheetIdx,
  setActiveSheetIdx,
  mappingState,
  updateMapping,
  mappedCountForSheet,
  onBack,
  onNext,
  loading,
}: any) {
  const sheet: SheetData = parsed.sheets[activeSheetIdx];
  const sheetMapping = mappingState[sheet.sheetName] || {};

  const methodForCol = (templateColumn: string): MappingMethod => {
    const found = sheet.mapping.find(
      (m: MappingSuggestion) => m.templateColumn === templateColumn
    );
    const currentSource = sheetMapping[templateColumn];
    if (!currentSource) return "none";
    if (found && found.sourceColumn === currentSource) return found.method;
    return "alias";
  };

  return (
    <>
      <p className="eyebrow">Step 3</p>
      <h2>จับคู่คอลัมน์กับเทมเพลต</h2>
      <p className="lead">
        ระบบจับคู่อัตโนมัติให้แล้ว ({mappedCountForSheet(sheet.sheetName)}/44
        คอลัมน์) — ปรับแก้ได้โดยเลือกคอลัมน์ต้นทางใหม่จากดรอปดาวน์
      </p>

      <div className="sheet-tabs">
        {parsed.sheets.map((s: SheetData, idx: number) => (
          <span
            key={s.sheetName}
            className={`sheet-tab ${idx === activeSheetIdx ? "active" : ""}`}
            onClick={() => setActiveSheetIdx(idx)}
          >
            {s.sheetName}{" "}
            <span className="count">{mappedCountForSheet(s.sheetName)}/44</span>
          </span>
        ))}
      </div>

      <div
        style={{
          maxHeight: 440,
          overflowY: "auto",
          border: "1px solid var(--line)",
          borderRadius: 4,
          padding: "4px 16px",
        }}
      >
        {sheet.mapping.map((m: MappingSuggestion) => {
          const current = sheetMapping[m.templateColumn] || "";
          const method = methodForCol(m.templateColumn);
          return (
            <div className="map-row" key={m.templateColumn}>
              <div className="tmpl-col">{m.templateColumn}</div>
              <div className="arrow">→</div>
              <select
                value={current}
                onChange={(e) =>
                  updateMapping(sheet.sheetName, m.templateColumn, e.target.value)
                }
              >
                <option value="">— ไม่จับคู่ —</option>
                {sheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className={`badge ${method}`}>
                {method === "exact" && "ตรงทั้งหมด"}
                {method === "alias" && "ใกล้เคียง"}
                {method === "fuzzy" && "คาดเดา"}
                {method === "none" && "ไม่จับคู่"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="actions">
        <button className="btn secondary" onClick={onBack}>
          ← ย้อนกลับ
        </button>
        <button className="btn amber" disabled={loading} onClick={onNext}>
          {loading ? "กำลังตรวจสอบ..." : "ตรวจสอบข้อมูล →"}
        </button>
      </div>
    </>
  );
}

// ---------- Step 4: Download ----------

function DownloadStep({
  parsed,
  issues,
  issueSummary,
  onBack,
  onDownload,
  onReset,
  loading,
}: any) {
  const grouped = useMemo(() => {
    if (!issues) return {};
    const g: Record<string, ValidationIssue[]> = {};
    for (const i of issues as ValidationIssue[]) {
      g[i.sheetName] = g[i.sheetName] || [];
      g[i.sheetName].push(i);
    }
    return g;
  }, [issues]);

  return (
    <>
      <p className="eyebrow">Step 4</p>
      <h2>ผลการตรวจสอบ และดาวน์โหลดเทมเพลต</h2>
      <p className="lead">
        ตรวจสอบรายการที่ต้องแก้ไขก่อนดาวน์โหลด หรือดาวน์โหลดไฟล์ได้ทันที
      </p>

      {issueSummary && (
        <div className="summary-grid">
          <div className="summary-card">
            <div className="num">{issueSummary.totalRows}</div>
            <div className="label">แถวข้อมูลทั้งหมด</div>
          </div>
          <div
            className={`summary-card ${
              issueSummary.errorCount > 0 ? "error" : "ok"
            }`}
          >
            <div className="num">{issueSummary.errorCount}</div>
            <div className="label">ข้อผิดพลาด (ต้องแก้ไข)</div>
          </div>
          <div className="summary-card">
            <div className="num">{issueSummary.warningCount}</div>
            <div className="label">คำเตือน (ควรตรวจสอบ)</div>
          </div>
        </div>
      )}

      {issues && issues.length > 0 ? (
        <div className="issue-list">
          {(issues as ValidationIssue[]).slice(0, 200).map((issue, idx) => (
            <div className={`issue-row ${issue.severity}`} key={idx}>
              <span className="tag">
                {issue.severity === "error" ? "ผิดพลาด" : "เตือน"}
              </span>
              <span>
                <strong>{issue.sheetName}</strong> แถวที่ {issue.rowIndex + 1}:{" "}
                {issue.message}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="success-block">
          <div className="icon">✓</div>
          <p>ไม่พบปัญหากับข้อมูล พร้อมดาวน์โหลดเทมเพลตได้เลย</p>
        </div>
      )}

      <div className="actions">
        <button className="btn secondary" onClick={onBack}>
          ← กลับไปแก้ไขการจับคู่
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn secondary" onClick={onReset}>
            เริ่มไฟล์ใหม่
          </button>
          <button className="btn amber" disabled={loading} onClick={onDownload}>
            {loading ? "กำลังสร้างไฟล์..." : "⬇ ดาวน์โหลดเทมเพลต .xlsx"}
          </button>
        </div>
      </div>
    </>
  );
}
