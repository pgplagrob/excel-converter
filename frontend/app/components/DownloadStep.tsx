"use client";

import { useEffect, useMemo, useState } from "react";
import { TEMPLATE_COLUMNS } from "@/lib/mapping";
import type { IssueSummary, ParseResponse, TransformedSheetPreview, ValidationIssue } from "@/lib/client-types";
import { displayIssueMessage, issueSeverityLabel } from "./display";

interface DownloadStepProps {
  parsed: ParseResponse;
  issues: ValidationIssue[] | null;
  issueSummary: IssueSummary | null;
  transformedSheets: TransformedSheetPreview[];
  onBack: () => void;
  onDownload: (sheetNames: string[]) => void;
  onReset: () => void;
  loading: boolean;
}

export function DownloadStep({
  parsed,
  issues,
  issueSummary,
  transformedSheets,
  onBack,
  onDownload,
  onReset,
  loading,
}: DownloadStepProps) {
  const [previewSheetName, setPreviewSheetName] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportSelection, setExportSelection] = useState<Record<string, boolean>>({});

  const availableSheets = useMemo(() => {
    const sheetsWithErrors = new Set(
      (issues || [])
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.sheetName),
    );
    return transformedSheets.filter(
      (sheet) => sheet.rowCount > 0 && !sheetsWithErrors.has(sheet.sheetName),
    );
  }, [issues, transformedSheets]);

  const selectedExportCount = availableSheets.filter(
    (sheet) => exportSelection[sheet.sheetName],
  ).length;

  const openExportDialog = () => {
    setExportSelection(Object.fromEntries(
      availableSheets.map((sheet) => [sheet.sheetName, true]),
    ));
    setExportDialogOpen(true);
  };

  const confirmExport = () => {
    const selectedNames = availableSheets
      .filter((sheet) => exportSelection[sheet.sheetName])
      .map((sheet) => sheet.sheetName);
    if (selectedNames.length === 0) return;
    setExportDialogOpen(false);
    onDownload(selectedNames);
  };

  useEffect(() => {
    if (!transformedSheets.some((sheet) => sheet.sheetName === previewSheetName)) {
      setPreviewSheetName(transformedSheets[0]?.sheetName || "");
    }
  }, [previewSheetName, transformedSheets]);

  useEffect(() => {
    if (!exportDialogOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExportDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [exportDialogOpen]);

  const previewSheet = transformedSheets.find((sheet) => sheet.sheetName === previewSheetName)
    || transformedSheets[0];
  const previewRows = previewSheet?.sampleRows || [];
  const previewColumns = previewRows.length > 0 ? Object.keys(previewRows[0]) : TEMPLATE_COLUMNS;

  return (
    <>
      <p className="eyebrow">Step 4</p>
      <h2>ผลการตรวจสอบ และดาวน์โหลดเทมเพลต</h2>
      <p className="lead">
        ตรวจสอบรายการที่ต้องแก้ไขก่อนดาวน์โหลด มีชีตที่พร้อมส่งออก {availableSheets.length} ชีต
      </p>

      {issueSummary && (
        <div className="summary-grid">
          <div className="summary-card">
            <div className="num">{issueSummary.totalRows}</div>
            <div className="label">แถวข้อมูลทั้งหมด</div>
          </div>
          <div className={`summary-card ${issueSummary.errorCount > 0 ? "error" : "ok"}`}>
            <div className="num">{issueSummary.errorCount}</div>
            <div className="label">ข้อผิดพลาด (ต้องแก้ไข)</div>
          </div>
          <div className="summary-card">
            <div className="num">{issueSummary.warningCount}</div>
            <div className="label">คำเตือน (ควรตรวจสอบ)</div>
          </div>
        </div>
      )}

      <section className="download-preview-section">
        <div className="download-preview-heading">
          <div>
            <p className="eyebrow">Export Preview</p>
            <h3>ตัวอย่างข้อมูลที่จะส่งออก</h3>
          </div>
          {transformedSheets.length > 0 && (
            <label className="download-preview-selector">
              <span>เลือกชีต</span>
              <select
                value={previewSheet?.sheetName || ""}
                onChange={(event) => setPreviewSheetName(event.target.value)}
              >
                {transformedSheets.map((sheet) => (
                  <option key={sheet.sheetName} value={sheet.sheetName}>
                    {sheet.sheetName} ({sheet.rowCount.toLocaleString("th-TH")} แถว)
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {previewSheet ? (
          <>
            <p className="download-preview-hint">
              แสดง {previewRows.length} แถวตัวอย่างแรกจากทั้งหมด {previewSheet.rowCount.toLocaleString("th-TH")} แถวในชีตนี้
            </p>
            <div className="table-wrap download-preview-table-wrap">
              <table className="download-preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {previewColumns.map((column) => <th key={column}>{column}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.length > 0 ? previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td>{rowIndex + 1}</td>
                      {previewColumns.map((column) => {
                        const value = row[column];
                        return (
                          <td key={column} title={value === undefined || value === null ? "" : String(value)}>
                            {value === undefined || value === null || value === "" ? "—" : String(value)}
                          </td>
                        );
                      })}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={previewColumns.length + 1} className="muted-text">ไม่มีข้อมูลในชีตนี้</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="download-preview-empty">ยังไม่มีข้อมูล Preview สำหรับแสดง</div>
        )}
      </section>

      {issues && issues.length > 0 ? (
        <div className="issue-list">
          {issues.slice(0, 200).map((issue, idx) => (
            <div className={`issue-row ${issue.severity}`} key={idx}>
              <span className="tag">{issueSeverityLabel(issue.severity)}</span>
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
          <button
            className="btn amber"
            disabled={loading || availableSheets.length === 0}
            onClick={openExportDialog}
          >
            {loading
              ? "กำลังสร้างไฟล์..."
              : availableSheets.length > 0
                ? "เลือกชีตและดาวน์โหลด .xlsx"
                : "ไม่มีชีตที่พร้อม Export"}
          </button>
        </div>
      </div>

      {exportDialogOpen && (
        <div
          className="export-dialog-backdrop"
          role="presentation"
          onClick={() => setExportDialogOpen(false)}
        >
          <section
            className="export-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="export-dialog-heading">
              <div>
                <p className="eyebrow">ขั้นตอนสุดท้าย</p>
                <h3 id="export-dialog-title">เลือกชีตที่ต้องการแปลง</h3>
                <p>เลือกได้มากกว่า 1 ชีต ระบบจะรวมไว้ในไฟล์เดียวกัน</p>
              </div>
              <button
                type="button"
                className="export-dialog-close"
                aria-label="ยกเลิกและปิดหน้าต่าง"
                onClick={() => setExportDialogOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="export-dialog-toolbar">
              <strong>เลือกแล้ว {selectedExportCount} จาก {availableSheets.length} ชีต</strong>
              <div>
                <button
                  type="button"
                  onClick={() => setExportSelection(Object.fromEntries(
                    availableSheets.map((sheet) => [sheet.sheetName, true]),
                  ))}
                >
                  เลือกทั้งหมด
                </button>
                <button type="button" onClick={() => setExportSelection({})}>
                  ล้างทั้งหมด
                </button>
              </div>
            </div>

            <div className="export-sheet-options">
              {availableSheets.map((sheet) => (
                <label className="export-sheet-option" key={sheet.sheetName}>
                  <input
                    type="checkbox"
                    checked={exportSelection[sheet.sheetName] === true}
                    onChange={(event) => setExportSelection((current) => ({
                      ...current,
                      [sheet.sheetName]: event.target.checked,
                    }))}
                  />
                  <span>
                    <strong>{sheet.sheetName}</strong>
                    <small>{sheet.rowCount.toLocaleString("th-TH")} แถว</small>
                  </span>
                </label>
              ))}
            </div>

            {selectedExportCount === 0 && (
              <p className="export-dialog-warning">กรุณาเลือกอย่างน้อย 1 ชีต</p>
            )}

            <div className="export-dialog-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={loading}
                onClick={() => setExportDialogOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn amber"
                disabled={loading || selectedExportCount === 0}
                onClick={confirmExport}
              >
                แปลงและดาวน์โหลด {selectedExportCount} ชีต
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
