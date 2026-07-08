import type { SheetSummary } from "@/lib/client-types";
import { statusLabel } from "./display";

interface SheetSummaryPanelProps {
  summary: SheetSummary;
  mappedCount: number;
}

export function SheetSummaryPanel({ summary, mappedCount }: SheetSummaryPanelProps) {
  return (
    <div className={`sheet-summary-panel ${summary.status}`}>
      <div className="sheet-summary-heading">
        <div>
          <span className="summary-kicker">สรุปชีตปัจจุบัน</span>
          <strong>{summary.sheetName}</strong>
        </div>
        <span className={`status-badge ${summary.status}`}>{statusLabel(summary.status)}</span>
      </div>
      <div className="sheet-summary-grid">
        <div className="sheet-summary-item">
          <span>จำนวนแถว</span>
          <strong>{summary.rowCount.toLocaleString("th-TH")}</strong>
        </div>
        <div className="sheet-summary-item">
          <span>ข้อผิดพลาด</span>
          <strong>{summary.errorCount.toLocaleString("th-TH")}</strong>
        </div>
        <div className="sheet-summary-item">
          <span>คำเตือน</span>
          <strong>{summary.warningCount.toLocaleString("th-TH")}</strong>
        </div>
        <div className="sheet-summary-item">
          <span>จับคู่คอลัมน์แล้ว</span>
          <strong>{mappedCount.toLocaleString("th-TH")}/44</strong>
        </div>
      </div>
    </div>
  );
}
