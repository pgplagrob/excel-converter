import type { SheetData } from "@/lib/client-types";
import { displaySourceColumnLabel, previewRowsWithVisibleAssetType } from "./display";

interface SourcePreviewTableProps {
  sheet: SheetData;
}

export function SourcePreviewTable({ sheet }: SourcePreviewTableProps) {
  const previewRows = previewRowsWithVisibleAssetType(sheet.rows).slice(0, 30);

  return (
    <>
      <h3>Source Preview</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {sheet.headers.map((column) => (
                <th key={column} title={column}>
                  <div>{displaySourceColumnLabel(column)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, index) => (
              <tr key={row.__rowKey || `${sheet.sheetName}:${index}`}>
                {sheet.headers.map((column) => (
                  <td key={column}>{row[column] || <span style={{ color: "#ccc" }}>—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        แสดงตัวอย่าง {previewRows.length} แถวแรกจากทั้งหมด {sheet.rowCount} แถว
      </p>
    </>
  );
}
