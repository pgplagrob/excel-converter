import { cellText } from "./text";
import { INTERNAL, SOURCE_EXCEL_ROW_COLUMN, type DataSourceSheet } from "./types";

// ตรวจคุณภาพข้อมูลหลัง parse แล้วแปะ warning ที่ต้นตอมาจากไฟล์ต้นฉบับ
// (รหัสซ้ำ / ยอดรวมในไฟล์ไม่ตรง / ชื่อกรอกไม่ครบ) — จะไปโผล่บนหน้าเว็บผ่าน sheet.warnings
export function appendDataQualityWarnings(sheet: DataSourceSheet, matrix: any[][]): void {
  // 1) รหัสครุภัณฑ์ซ้ำ
  const codeRows = new Map<string, number[]>();
  for (const row of sheet.rows) {
    const code = cellText(row[INTERNAL.assetCode]);
    if (!code) continue;
    const excelRow = Number(row[SOURCE_EXCEL_ROW_COLUMN]) || 0;
    (codeRows.get(code) ?? codeRows.set(code, []).get(code)!).push(excelRow);
  }
  const dupes = [...codeRows.entries()].filter(([, r]) => r.length > 1);
  if (dupes.length) {
    const preview = dupes
      .slice(0, 5)
      .map(([code, r]) => `${code} (แถว ${r.join(", ")})`)
      .join("; ");
    const more = dupes.length > 5 ? ` และอีก ${dupes.length - 5} รหัส` : "";
    sheet.warnings.push(`พบรหัสครุภัณฑ์ซ้ำ ${dupes.length} รหัส: ${preview}${more}`);
  }

  // 2) ยอดรวมในไฟล์ (แถว "รวมทั้งสิ้น") ไม่ตรงกับจำนวนที่อ่านได้
  //    อ่านจำนวนจากคอลัมน์ลำดับ (col 0) เท่านั้น กันไปหยิบคอลัมน์มูลค่า (ยอดเงินรวม)
  for (const row of matrix) {
    if (!row.some((cell) => /รวมทั้งสิ้น/.test(cellText(cell)))) continue;
    const stated = parseInt(cellText(row[0]).replace(/[,\s]/g, ""), 10);
    if (!Number.isNaN(stated) && stated !== sheet.rowCount) {
      sheet.warnings.push(
        `ยอดรวมในไฟล์ (รวมทั้งสิ้น = ${stated}) ไม่ตรงกับจำนวนที่อ่านได้ (${sheet.rowCount}) ต่าง ${Math.abs(stated - sheet.rowCount)} แถว`,
      );
    }
    break;
  }

  // 3) ชื่อสินทรัพย์สั้นผิดปกติ (มักกรอกไม่ครบ)
  const shortNames = sheet.rows
    .map((row) => ({ name: cellText(row[INTERNAL.assetName]), code: cellText(row[INTERNAL.assetCode]) }))
    .filter((r) => r.name.length > 0 && r.name.length <= 4);
  if (shortNames.length) {
    const preview = shortNames
      .slice(0, 5)
      .map((r) => `"${r.name}"${r.code ? ` (${r.code})` : ""}`)
      .join(", ");
    const more = shortNames.length > 5 ? ` และอีก ${shortNames.length - 5} แถว` : "";
    sheet.warnings.push(`พบ ${shortNames.length} แถวที่ชื่อสินทรัพย์สั้นผิดปกติ อาจกรอกไม่ครบ: ${preview}${more}`);
  }
}
