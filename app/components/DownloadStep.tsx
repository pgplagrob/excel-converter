"use client";

import { useEffect, useState } from "react";
import { TEMPLATE_COLUMNS } from "@/lib/mapping";
import type { IssueSummary, ParseResponse, TransformedSheetPreview, ValidationIssue } from "@/lib/client-types";
import { displayIssueMessage, issueSeverityLabel } from "./display";

interface DownloadStepProps {
  parsed: ParseResponse;
  issues: ValidationIssue[] | null;
  issueSummary: IssueSummary | null;
  transformedSheets: TransformedSheetPreview[];
  onBack: () => void;
  onDownload: () => void;
  onDownloadSheet: (sheetName: string) => void;
  onReset: () => void;
  loading: boolean;
  selectedSheetCount: number;
}

export function DownloadStep({
  parsed,
  issues,
  issueSummary,
  transformedSheets,
  onBack,
  onDownload,
  onDownloadSheet,
  onReset,
  loading,
  selectedSheetCount,
}: DownloadStepProps) {
  const [previewSheetName, setPreviewSheetName] = useState("");

  useEffect(() => {
    if (!transformedSheets.some((sheet) => sheet.sheetName === previewSheetName)) {
      setPreviewSheetName(transformedSheets[0]?.sheetName || "");
    }
  }, [previewSheetName, transformedSheets]);

  const previewSheet = transformedSheets.find((sheet) => sheet.sheetName === previewSheetName)
    || transformedSheets[0];
  const previewRows = previewSheet?.sampleRows || [];
  const previewColumns = previewRows.length > 0 ? Object.keys(previewRows[0]) : TEMPLATE_COLUMNS;

  return (
    <>
      <p className="eyebrow">Step 4</p>
      <h2>ผลการตรวจสอบ และดาวน์โหลดเทมเพลต</h2>
      <p className="lead">
        ตรวจสอบรายการที่ต้องแก้ไขก่อนดาวน์โหลด ขณะนี้เลือกส่งออก {selectedSheetCount} ชีต
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
          {previewSheet && (
            <button
              type="button"
              className="btn secondary download-single-sheet-button"
              disabled={loading}
              onClick={() => onDownloadSheet(previewSheet.sheetName)}
            >
              แปลงเฉพาะชีตนี้
            </button>
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
          <button className="btn amber" disabled={loading || selectedSheetCount === 0} onClick={onDownload}>
            {loading
              ? "กำลังสร้างไฟล์..."
              : selectedSheetCount > 0
                ? "⬇ ดาวน์โหลดเทมเพลต .xlsx"
                : "ไม่มีชีตที่พร้อม Export"}
          </button>
        </div>
      </div>
    </>
  );
}
