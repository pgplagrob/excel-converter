import type { SheetData, ValidationIssue } from "@/lib/client-types";
import {
  displayIssueMessage,
  displaySourceColumnLabel,
  previewRowsWithVisibleAssetType,
  TEMPLATE_TO_SOURCE_COLUMN,
} from "./display";

interface SourcePreviewTableProps {
  sheet: SheetData;
  issues?: ValidationIssue[];
}

const PREVIEW_LIMIT = 30;

export function SourcePreviewTable({ sheet, issues = [] }: SourcePreviewTableProps) {
  const previewRows = previewRowsWithVisibleAssetType(sheet.rows).slice(0, PREVIEW_LIMIT);
  const visibleColumns = sheet.headers.filter((column) => !column.startsWith("__"));

  // จัดกลุ่ม issue ตาม index แถว (เฉพาะ issue ที่ผูกกับแถว ไม่เอา issue ระดับชีต)
  const issuesByRow = new Map<number, ValidationIssue[]>();
  for (const issue of issues) {
    if (issue.rowIndex < 0) continue;
    const list = issuesByRow.get(issue.rowIndex);
    if (list) list.push(issue);
    else issuesByRow.set(issue.rowIndex, [issue]);
  }
  // นับแถวที่มีปัญหาแต่อยู่นอกช่วงพรีวิว (ผู้ใช้ต้องดูจากรายการด้านล่างแทน)
  const hiddenIssueRows = [...issuesByRow.keys()].filter((rowIndex) => rowIndex >= PREVIEW_LIMIT).length;

  return (
    <>
      <h3>Source Preview</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="issue-marker-col" title="สถานะการตรวจ">!</th>
              {visibleColumns.map((column) => (
                <th key={column} title={column}>
                  <div>{displaySourceColumnLabel(column)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, index) => {
              const rowIssues = issuesByRow.get(index) ?? [];
              const hasError = rowIssues.some((issue) => issue.severity === "error");
              const hasWarning = rowIssues.some((issue) => issue.severity === "warning");
              const rowClass = hasError ? "row-error" : hasWarning ? "row-warning" : "";
              // ช่องต้นทางที่เป็นต้นตอของ issue ในแถวนี้
              const flaggedColumns = new Set(
                rowIssues
                  .map((issue) => TEMPLATE_TO_SOURCE_COLUMN[issue.column])
                  .filter(Boolean),
              );
              const tooltip = rowIssues.map((issue) => displayIssueMessage(issue.message)).join("\n");

              return (
                <tr key={row.__rowKey || `${sheet.sheetName}:${index}`} className={rowClass}>
                  <td className="issue-marker" title={tooltip || undefined}>
                    {hasError ? "✕" : hasWarning ? "⚠" : ""}
                  </td>
                  {visibleColumns.map((column) => {
                    const value = row[column];
                    const isEmpty = value === "" || value === undefined || value === null;
                    const flagged = flaggedColumns.has(column);
                    const cellClass = flagged
                      ? `cell-flag ${hasError ? "cell-error" : "cell-warning"}`
                      : undefined;
                    return (
                      <td key={column} className={cellClass} title={flagged ? tooltip : undefined}>
                        {isEmpty ? <span style={{ color: "#ccc" }}>—</span> : String(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">
        แสดงตัวอย่าง {previewRows.length} แถวแรกจากทั้งหมด {sheet.rowCount} แถว
        {issuesByRow.size > 0 && " · แถวที่ไฮไลต์คือแถวที่มีคำเตือน/ข้อผิดพลาด (วางเมาส์บนไอคอนเพื่อดูรายละเอียด)"}
        {hiddenIssueRows > 0 &&
          ` · อีก ${hiddenIssueRows} แถวที่มีปัญหาอยู่นอกช่วงพรีวิว ดูรายการด้านล่าง`}
      </p>
    </>
  );
}
