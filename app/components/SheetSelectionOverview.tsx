"use client";

import type { SheetOverview } from "@/lib/client-types";
import type { SheetSelection } from "@/lib/sheet-selection";

interface SheetSelectionOverviewProps {
  sheets: SheetOverview[];
  selection: SheetSelection;
  onToggle: (sheetName: string, selected: boolean) => void;
  onOpenSheet: (parsedSheetIndex: number) => void;
}

function eligibilityLabel(sheet: SheetOverview): string {
  if (sheet.eligibility === "exportable") {
    return sheet.warningCount > 0 ? "พร้อมใช้ · มีคำเตือน" : "พร้อมใช้";
  }
  if (sheet.eligibility === "needsReview") return "ต้องตรวจสอบ";
  if (sheet.eligibility === "unsupported") return "ยังไม่รองรับ";
  return "ข้าม";
}

export function SheetSelectionOverview({
  sheets,
  selection,
  onToggle,
  onOpenSheet,
}: SheetSelectionOverviewProps) {
  return (
    <section className="sheet-selection-section" aria-labelledby="sheet-selection-title">
      <div className="sheet-selection-heading">
        <div>
          <h3 id="sheet-selection-title">เลือกชีตสำหรับตรวจสอบและ Export</h3>
          <p>ระบบเลือกเริ่มต้นเฉพาะชีตที่พร้อมใช้ ชีต review/unsupported/skipped จะไม่ถูกส่งออก</p>
        </div>
        <strong>{Object.values(selection).filter(Boolean).length} ชีตที่เลือก</strong>
      </div>
      <div className="sheet-selection-table-wrap">
        <table className="sheet-selection-table">
          <thead>
            <tr>
              <th>เลือก</th>
              <th>ชีต</th>
              <th>Profile</th>
              <th>สถานะ</th>
              <th>แถว</th>
              <th>ผิดพลาด / เตือน</th>
              <th>เหตุผล</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((sheet) => {
              const canSelect = sheet.eligibility === "exportable" && sheet.rowCount > 0;
              return (
                <tr key={sheet.sheetName} className={!canSelect ? "disabled" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(selection[sheet.sheetName])}
                      disabled={!canSelect}
                      onChange={(event) => onToggle(sheet.sheetName, event.target.checked)}
                      aria-label={`เลือกชีต ${sheet.sheetName}`}
                    />
                  </td>
                  <td>
                    {sheet.parsedSheetIndex !== undefined ? (
                      <button
                        type="button"
                        className="sheet-link"
                        onClick={() => onOpenSheet(sheet.parsedSheetIndex!)}
                      >
                        {sheet.sheetName}
                      </button>
                    ) : (
                      sheet.sheetName
                    )}
                  </td>
                  <td><code>{sheet.sourceProfile}</code></td>
                  <td><span className={`eligibility-pill ${sheet.eligibility}`}>{eligibilityLabel(sheet)}</span></td>
                  <td>{sheet.rowCount.toLocaleString("th-TH")}</td>
                  <td>{sheet.errorCount.toLocaleString("th-TH")} / {sheet.warningCount.toLocaleString("th-TH")}</td>
                  <td className="reason-cell">{sheet.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
