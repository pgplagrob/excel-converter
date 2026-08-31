"use client";

import type { SheetData, SheetSummary, ValidationIssue } from "@/lib/client-types";
import { createRuntimeSheetSummary, statusIcon, summaryText } from "./display";

interface SheetTabsProps {
  sheets: SheetData[];
  preservedSheetSummaries: SheetSummary[];
  skippedSheetSummaries: SheetSummary[];
  activeSheetIdx: number;
  issues: ValidationIssue[] | null;
  onSelectSheet: (index: number) => void;
}

export function SheetTabs({
  sheets,
  preservedSheetSummaries,
  skippedSheetSummaries,
  activeSheetIdx,
  issues,
  onSelectSheet,
}: SheetTabsProps) {
  const preserved = preservedSheetSummaries || [];
  const skipped = skippedSheetSummaries || [];

  return (
    <div className="sheet-select">
      <div className="sheet-select-row">
        <span className="sheet-select-title">เลือกชีตเพื่อตรวจสอบ</span>
        <span className="sheet-select-hint">
          {sheets.length} ชีตข้อมูล
          {preserved.length > 0 && ` · ${preserved.length} เก็บต้นฉบับ`}
          {skipped.length > 0 && ` · ${skipped.length} ข้าม`}
        </span>
      </div>

      <div className="sheet-tabs">
        {sheets.map((sheet, idx) => {
          const summary = createRuntimeSheetSummary(
            sheet,
            (issues || []).filter((issue) => issue.sheetName === sheet.sheetName),
          );
          return (
            <button
              key={sheet.sheetName}
              className={`sheet-tab ${summary.status} ${idx === activeSheetIdx ? "active" : ""}`}
              onClick={() => onSelectSheet(idx)}
              title={`แถวหัวตาราง ${summary.headerRow || "-"} · ${summary.errorCount} ข้อผิดพลาด · ${summary.warningCount} คำเตือน`}
            >
              <span className="status-dot">{statusIcon(summary.status)}</span>
              <span className="sheet-tab-name">{sheet.sheetName}</span>
              <span className="count">{summaryText(summary)}</span>
            </button>
          );
        })}
      </div>

      {preserved.length > 0 && (
        <div className="sheet-tabs sheet-tabs-secondary">
          {preserved.map((summary) => (
            <span key={summary.sheetName} className="sheet-tab preserved">
              <span className="status-dot">{statusIcon("preserved")}</span>
              <span className="sheet-tab-name">{summary.sheetName}</span>
              <span className="count">เก็บต้นฉบับ</span>
            </span>
          ))}
        </div>
      )}

      {skipped.length > 0 && (
        <details className="sheet-skip-group">
          <summary>ชีตที่ข้าม ({skipped.length})</summary>
          <div className="sheet-tabs sheet-tabs-secondary">
            {skipped.map((summary) => (
              <span key={summary.sheetName} className="sheet-tab skipped">
                <span className="status-dot">{statusIcon("skipped")}</span>
                <span className="sheet-tab-name">{summary.sheetName}</span>
                <span className="count">ข้าม</span>
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
