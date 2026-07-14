"use client";

import type { IssueSummary, ParseResponse, ValidationIssue } from "@/lib/client-types";
import { displayIssueMessage, issueSeverityLabel } from "./display";

interface DownloadStepProps {
  parsed: ParseResponse;
  issues: ValidationIssue[] | null;
  issueSummary: IssueSummary | null;
  onBack: () => void;
  onDownload: () => void;
  onReset: () => void;
  loading: boolean;
  selectedSheetCount: number;
}

export function DownloadStep({
  parsed,
  issues,
  issueSummary,
  onBack,
  onDownload,
  onReset,
  loading,
  selectedSheetCount,
}: DownloadStepProps) {
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
