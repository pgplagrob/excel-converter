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
  return (
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
            {sheet.sheetName}
            <span className="count">{summaryText(summary)}</span>
          </button>
        );
      })}
      {(preservedSheetSummaries || []).map((summary) => (
        <span key={summary.sheetName} className="sheet-tab preserved muted">
          <span className="status-dot">{statusIcon("preserved")}</span>
          {summary.sheetName}
          <span className="count">เก็บต้นฉบับ</span>
        </span>
      ))}
      {(skippedSheetSummaries || []).map((summary) => (
        <span key={summary.sheetName} className="sheet-tab skipped muted">
          <span className="status-dot">{statusIcon("skipped")}</span>
          {summary.sheetName}
          <span className="count">skipped</span>
        </span>
      ))}
    </div>
  );
}
