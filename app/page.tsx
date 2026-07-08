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
  "1. อัปโหลดไฟล์",
  "2. Sheet overview",
  "3. Preview + validate",
  "4. Export",
];

const SOURCE_COLUMN_LABELS: Record<string, string> = {
  __sourceProfile: "รูปแบบไฟล์ที่ระบบตรวจพบ",
  __sheetName: "ชื่อชีตต้นทาง",
  __excelRow: "แถวในไฟล์ Excel",
  __sourceRowIndex: "Source row index",
  __rowKey: "Stable row key",
  sourceAssetType: "ชนิดสินทรัพย์จากต้นทาง",
  __sourceAssetTypeEmitOnce: "แสดงชนิดสินทรัพย์จากต้นทางครั้งเดียว",
  sourceAssetItem: "รายการสินทรัพย์จากต้นทาง",
  sourceAssetName: "ชื่อสินทรัพย์ที่ระบบอ่านได้",
  assetCode: "รหัสสินทรัพย์",
  assetName: "ชื่อสินทรัพย์",
  assetDetail: "รายละเอียดสินทรัพย์",
  receivedDate: "วันที่ได้รับ",
  value: "มูลค่า",
  responsibleUnit: "งานที่รับผิดชอบ",
  location: "สถานที่ตั้ง",
  acquiredBy: "ได้มาโดย",
  acquiredFrom: "ได้มาจาก",
  budgetSource: "แหล่งงบประมาณ",
  note: "หมายเหตุ",
  statusNormal: "สถานะ: ปกติ",
  statusBroken: "สถานะ: ชำรุด",
  statusDeteriorated: "สถานะ: เสื่อมสภาพ",
  statusLost: "สถานะ: สูญหาย",
  statusStoredLong: "สถานะ: เก็บไว้นาน",
  statusUnnecessary: "สถานะ: ไม่จำเป็นต้องใช้",
  seq: "ลำดับ",
  itemName: "รายการ",
  __seq: "ลำดับที่ระบบอ่านได้",
  __assetCode: "รหัสสินทรัพย์ที่ระบบอ่านได้",
  __assetName: "ชื่อสินทรัพย์ที่ระบบอ่านได้",
  __detail: "รายละเอียดที่ระบบอ่านได้",
  __receivedDate: "วันที่ได้รับที่ระบบอ่านได้",
  __value: "มูลค่าที่ระบบอ่านได้",
  __acquiredBy: "ได้มาโดยที่ระบบอ่านได้",
  __acquiredFrom: "ได้มาจากที่ระบบอ่านได้",
  __budgetSource: "แหล่งงบประมาณที่ระบบอ่านได้",
  __location: "สถานที่ตั้งที่ระบบอ่านได้",
  __responsibleUnit: "งานที่รับผิดชอบที่ระบบอ่านได้",
  __note: "หมายเหตุที่ระบบอ่านได้",
  __status: "สถานะที่ระบบอ่านได้",
  __assetCategory: "ประเภทสินทรัพย์ที่ระบบอ่านได้",
  __depreciationFlag: "คิดค่าเสื่อมที่ระบบอ่านได้",
  __needCount: "ต้องตรวจนับที่ระบบอ่านได้",
  __importantFlag: "ของสำคัญที่ระบบอ่านได้",
};

const SOURCE_PROFILE_COLUMN = "__sourceProfile";
const SOURCE_ASSET_TYPE_COLUMN = "sourceAssetType";
const SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN = "__sourceAssetTypeEmitOnce";

function displaySourceColumnLabel(column: string | null | undefined): string {
  if (!column) return "";
  const emptyColumn = column.match(/^__EMPTY_COLUMN_(\d+)$/);
  if (emptyColumn) return `คอลัมน์ว่าง ${emptyColumn[1]}`;
  return SOURCE_COLUMN_LABELS[column] || column;
}

function previewRowsWithVisibleAssetType(rows: Record<string, any>[]): Record<string, any>[] {
  let previousAssetType = "";

  return rows.map((row) => {
    const profile = String(row[SOURCE_PROFILE_COLUMN] || "").trim();
    const sourceAssetType = String(row[SOURCE_ASSET_TYPE_COLUMN] || "").trim();

    if (profile !== "REGISTER_3_ROW_HEADER" || !sourceAssetType) return row;

    const emitFlag = row[SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN];
    const shouldShow =
      emitFlag === true || (emitFlag !== false && sourceAssetType !== previousAssetType);
    previousAssetType = sourceAssetType;

    return shouldShow
      ? row
      : {
          ...row,
          [SOURCE_ASSET_TYPE_COLUMN]: "",
        };
  });
}

function displaySourceColumnWithOriginal(column: string): string {
  const label = displaySourceColumnLabel(column);
  return label === column ? label : `${label} (${column})`;
}

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
  return "–";
}

function statusLabel(status: SheetStatus): string {
  if (status === "success") return "พร้อมใช้งาน";
  if (status === "warning") return "มีคำเตือน";
  if (status === "error") return "พบข้อผิดพลาด";
  return "ข้ามชีต";
}

function summaryText(summary: SheetSummary): string {
  if (summary.status === "skipped") return "ข้าม";
  if (summary.errorCount > 0) return `${summary.errorCount} ข้อผิดพลาด`;
  if (summary.warningCount > 0) return `${summary.warningCount} คำเตือน`;
  return `${summary.rowCount} แถว`;
}

function issueSeverityLabel(severity: ValidationIssue["severity"]): string {
  return severity === "error" ? "ผิดพลาด" : "เตือน";
}

function displayIssueColumn(column: string): string {
  if (column === "row") return "ทั้งแถว";
  if (column === "sheet") return "ระดับชีต";
  if (column === "header") return "หัวตาราง";
  return column;
}

function displayIssueMessage(message: string): string {
  const exactDuplicate = message.match(
    /^Exact duplicate exported row matches row (\d+)\. Duplicate asset codes are allowed when other fields differ\.$/,
  );
  if (exactDuplicate) {
    return `แถวส่งออกซ้ำกับแถวที่ ${exactDuplicate[1]} แบบทั้งแถว ระบบอนุญาตให้รหัสสินทรัพย์ซ้ำได้เฉพาะกรณีที่ข้อมูลช่องอื่นแตกต่างกัน`;
  }
  return message;
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
          <span className="tag">{issueSeverityLabel(issue.severity)}</span>
          <span>
            <strong>{issue.sheetName}</strong>{" "}
            {issue.rowIndex >= 0 ? `แถวที่ ${issue.rowIndex + 1}` : "ระดับชีต"}
            {issue.column ? ` · ${displayIssueColumn(issue.column)}` : ""}:{" "}
            {displayIssueMessage(issue.message)}
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
  const previewRows = previewRowsWithVisibleAssetType(sheet.rows).slice(0, 30);
  const displayCols = sheet.headers;
  const sheetMap: Record<string, string> = mappingState[sheet.sheetName] || {};
  const sheetIssues = ((issues || []) as ValidationIssue[]).filter(
    (issue) => issue.sheetName === sheet.sheetName,
  );
  const currentSummary = createRuntimeSheetSummary(sheet, sheetIssues);
  const visibleMappings = sheet.mapping
    .map((m, index) => {
      const manualSource = sheetMap[m.templateColumn];
      return {
        ...m,
        sourceColumn: manualSource !== undefined ? manualSource || null : m.sourceColumn,
        status: manualSource !== undefined ? "manual" : m.status,
        confidence: manualSource !== undefined ? "high" : m.confidence,
        originalIndex: index,
      };
    })
    .sort((a, b) => {
      const aIsMapped = Boolean(a.sourceColumn);
      const bIsMapped = Boolean(b.sourceColumn);
      if (aIsMapped === bIsMapped) return a.originalIndex - b.originalIndex;
      return aIsMapped ? -1 : 1;
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
              title={`แถวหัวตาราง ${summary.headerRow || "-"} · ${summary.errorCount} ข้อผิดพลาด · ${summary.warningCount} คำเตือน`}
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

      <div className={`sheet-summary-panel ${currentSummary.status}`}>
        <div className="sheet-summary-heading">
          <div>
            <span className="summary-kicker">สรุปชีตปัจจุบัน</span>
            <strong>{sheet.sheetName}</strong>
          </div>
          <span className={`status-badge ${currentSummary.status}`}>
            {statusLabel(currentSummary.status)}
          </span>
        </div>
        <div className="sheet-summary-grid">
          <div className="sheet-summary-item">
            <span>จำนวนแถว</span>
            <strong>{currentSummary.rowCount.toLocaleString("th-TH")}</strong>
          </div>
          <div className="sheet-summary-item">
            <span>ข้อผิดพลาด</span>
            <strong>{currentSummary.errorCount.toLocaleString("th-TH")}</strong>
          </div>
          <div className="sheet-summary-item">
            <span>คำเตือน</span>
            <strong>{currentSummary.warningCount.toLocaleString("th-TH")}</strong>
          </div>
          <div className="sheet-summary-item">
            <span>จับคู่คอลัมน์แล้ว</span>
            <strong>{mappedCountForSheet(sheet.sheetName).toLocaleString("th-TH")}/44</strong>
          </div>
        </div>
      </div>

      <h3>Source Preview</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {displayCols.map((col) => (
                <th key={col} title={col}>
                  <div>{displaySourceColumnLabel(col)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row: any, i: number) => (
              <tr key={row.__rowKey || `${sheet.sheetName}:${i}`}>
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
                <td>
                  {m.sourceColumn ? (
                    <span title={m.sourceColumn}>{displaySourceColumnLabel(m.sourceColumn)}</span>
                  ) : (
                    <span className="muted-text">ไม่พบคอลัมน์</span>
                  )}
                </td>
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

      <div className="advanced-box mt-6 rounded-lg border p-4">
        <button className="btn secondary " onClick={() => setAdvancedOpen(!advancedOpen)}>
          {advancedOpen ? "ซ่อน Advanced Mapping" : "แก้ไขการจับคู่คอลัมน์"}
        </button>
        {advancedOpen && (
          <div className="manual-mapping">
            {visibleMappings.map((m: MappingSuggestion) => {
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
                        {displaySourceColumnWithOriginal(h)}
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

      <h3>ผลการตรวจสอบข้อมูล</h3>
      {issueSummary && (
        <div className="summary-grid small">
          <div className="summary-card">
            <div className="num">{issueSummary.totalRows}</div>
            <div className="label">แถวทั้งหมด</div>
          </div>
          <div className={`summary-card ${issueSummary.errorCount > 0 ? "error" : "ok"}`}>
            <div className="num">{issueSummary.errorCount}</div>
            <div className="label">ข้อผิดพลาด</div>
          </div>
          <div className="summary-card">
            <div className="num">{issueSummary.warningCount}</div>
            <div className="label">คำเตือน</div>
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
                {issueSeverityLabel(issue.severity)}
              </span>
              <span>
                <strong>{issue.sheetName}</strong> แถวที่ {issue.rowIndex + 1}:{" "}
                {displayIssueMessage(issue.message)}
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
