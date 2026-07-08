import type { SheetData } from "@/lib/client-types";
import { displaySourceColumnLabel, previewRowsWithVisibleAssetType } from "./display";

interface SourcePreviewTableProps {
  sheet: SheetData;
}

export function SourcePreviewTable({ sheet }: SourcePreviewTableProps) {
  const previewRows = previewRowsWithVisibleAssetType(sheet.rows).slice(0, 30);
  const visibleColumns = sheet.headers.filter((column) => !column.startsWith("__"));

  return (
    <>
      <h3>Source Preview</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th key={column} title={column}>
                  <div>{displaySourceColumnLabel(column)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, index) => (
              <tr key={row.__rowKey || `${sheet.sheetName}:${index}`}>
                {visibleColumns.map((column) => {
                  const value = row[column];
                  const isEmpty = value === "" || value === undefined || value === null;
                  return (
                    <td key={column}>
                      {isEmpty ? <span style={{ color: "#ccc" }}>—</span> : String(value)}
                    </td>
                  );
                })}
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
