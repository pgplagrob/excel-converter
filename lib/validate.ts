import { TEMPLATE_COLUMNS } from "./mapping";

export interface ValidationIssue {
  sheetName: string;
  rowIndex: number; // 0-based within sheet's data rows
  column: string;
  message: string;
  severity: "error" | "warning";
}

// Columns that should not be left blank for a usable asset record
const REQUIRED_COLUMNS = ["ชื่อสินทรัพย์", "ประเภทสินทรัพย์", "สถานะ"];

// Columns expected to look like dates (loose check, not strict)
const DATE_COLUMNS = [
  "วันที่ได้รับ",
  "วันที่ได้รับโอน",
  "วันที่ออกจำหน่าย",
  "วันที่เริ่มรับประกัน",
  "วันที่หมดประกัน",
  "ณ วันที่ (ค่าเสื่อมยกมา)",
];

// Columns expected to be numeric
const NUMERIC_COLUMNS = ["มูลค่า", "ค่าเสื่อมสะสมยกมา"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/;

export function validateMappedRows(
  sheetName: string,
  rows: Record<string, any>[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  rows.forEach((row, idx) => {
    for (const col of REQUIRED_COLUMNS) {
      const v = (row[col] ?? "").toString().trim();
      if (!v) {
        issues.push({
          sheetName,
          rowIndex: idx,
          column: col,
          message: `ไม่พบข้อมูลในคอลัมน์ที่จำเป็น "${col}"`,
          severity: "error",
        });
      }
    }

    for (const col of DATE_COLUMNS) {
      const v = (row[col] ?? "").toString().trim();
      if (v && !DATE_RE.test(v)) {
        issues.push({
          sheetName,
          rowIndex: idx,
          column: col,
          message: `รูปแบบวันที่ไม่ถูกต้องในคอลัมน์ "${col}" (พบค่า: ${v})`,
          severity: "warning",
        });
      }
    }

    for (const col of NUMERIC_COLUMNS) {
      const v = (row[col] ?? "").toString().trim().replace(/,/g, "");
      if (v && isNaN(Number(v))) {
        issues.push({
          sheetName,
          rowIndex: idx,
          column: col,
          message: `ค่าควรเป็นตัวเลขในคอลัมน์ "${col}" (พบค่า: ${row[col]})`,
          severity: "warning",
        });
      }
    }
  });

  return issues;
}

export function getTemplateColumns(): string[] {
  return TEMPLATE_COLUMNS;
}
