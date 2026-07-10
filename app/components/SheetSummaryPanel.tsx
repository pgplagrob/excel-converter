import type { SheetSummary } from "@/lib/client-types";
import type { SheetEligibility } from "@/lib/datasource";
import { statusLabel } from "./display";

interface SheetSummaryPanelProps {
  summary: SheetSummary;
  mappedCount: number;
  eligibility?: SheetEligibility;
  eligibilityReason?: string;
  confidence?: number;
}

function eligibilityLabel(eligibility?: SheetEligibility): string {
  if (eligibility === "exportable") return "แปลงได้";
  if (eligibility === "needsReview") return "ต้องตรวจสอบ";
  if (eligibility === "skipped") return "ข้าม";
  return "-";
}

export function SheetSummaryPanel({
  summary,
  mappedCount,
  eligibility,
  eligibilityReason,
  confidence,
}: SheetSummaryPanelProps) {
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
        <div className="sheet-summary-item">
          <span>สถานะแปลง</span>
          <strong>{eligibilityLabel(eligibility)}</strong>
        </div>
        <div className="sheet-summary-item">
          <span>ความมั่นใจ</span>
          <strong>{typeof confidence === "number" ? `${Math.round(confidence * 100)}%` : "-"}</strong>
        </div>
      </div>
      {eligibilityReason && <p className="sheet-decision">{eligibilityReason}</p>}
    </div>
  );
}
