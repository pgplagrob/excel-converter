import type { SheetData, SheetStatus, SheetSummary, ValidationIssue } from "@/lib/client-types";

const SOURCE_COLUMN_LABELS: Record<string, string> = {
  __sourceProfile: "รูปแบบไฟล์ที่ระบบตรวจพบ",
  __sheetName: "ชื่อชีตต้นทาง",
  __excelRow: "แถวในไฟล์ Excel",
  __sourceRowIndex: "Source row index",
  __rowKey: "Stable row key",
  sourceAssetType: "ชนิดสินทรัพย์จากต้นทาง",
  __sourceAssetTypeEmitOnce: "แสดงชนิดสินทรัพย์จากต้นทางครั้งเดียว",
  sourceAssetItem: "รายการสินทรัพย์จากต้นทาง",
  sourceAssetName: "ชื่อสินทรัพย์ที่ระบบอ่านได้",
  assetCode: "รหัสสินทรัพย์",
  assetName: "ชื่อสินทรัพย์",
  assetDetail: "รายละเอียดสินทรัพย์",
  receivedDate: "วันที่ได้รับ",
  value: "มูลค่า",
  responsibleUnit: "งานที่รับผิดชอบ",
  location: "สถานที่ตั้ง",
  acquiredBy: "ได้มาโดย",
  acquiredFrom: "ได้มาจาก",
  budgetSource: "แหล่งงบประมาณ",
  note: "หมายเหตุ",
  statusNormal: "สถานะ: ปกติ",
  statusBroken: "สถานะ: ชำรุด",
  statusDeteriorated: "สถานะ: เสื่อมสภาพ",
  statusLost: "สถานะ: สูญหาย",
  statusStoredLong: "สถานะ: เก็บไว้นาน",
  statusUnnecessary: "สถานะ: ไม่จำเป็นต้องใช้",
  seq: "ลำดับ",
  itemName: "รายการ",
  __seq: "ลำดับที่ระบบอ่านได้",
  __assetCode: "รหัสสินทรัพย์ที่ระบบอ่านได้",
  __assetName: "ชื่อสินทรัพย์ที่ระบบอ่านได้",
  __detail: "รายละเอียดที่ระบบอ่านได้",
  __receivedDate: "วันที่ได้รับที่ระบบอ่านได้",
  __value: "มูลค่าที่ระบบอ่านได้",
  __acquiredBy: "ได้มาโดยที่ระบบอ่านได้",
  __acquiredFrom: "ได้มาจากที่ระบบอ่านได้",
  __budgetSource: "แหล่งงบประมาณที่ระบบอ่านได้",
  __location: "สถานที่ตั้งที่ระบบอ่านได้",
  __responsibleUnit: "งานที่รับผิดชอบที่ระบบอ่านได้",
  __note: "หมายเหตุที่ระบบอ่านได้",
  __status: "สถานะที่ระบบอ่านได้",
  __assetCategory: "ประเภทสินทรัพย์ที่ระบบอ่านได้",
  __depreciationFlag: "คิดค่าเสื่อมที่ระบบอ่านได้",
  __needCount: "ต้องตรวจนับที่ระบบอ่านได้",
  __importantFlag: "ของสำคัญที่ระบบอ่านได้",
};

const SOURCE_ASSET_ITEM_COLUMN = "sourceAssetItem";

// จับคู่ชื่อคอลัมน์เทมเพลต (ที่ issue อ้างถึง) -> คอลัมน์ต้นทางในตาราง Source Preview
// ใช้ไฮไลต์ช่องที่เป็นต้นตอของคำเตือน/ข้อผิดพลาด
export const TEMPLATE_TO_SOURCE_COLUMN: Record<string, string> = {
  รหัสสินทรัพย์: "assetCode",
  ชื่อสินทรัพย์: "assetName",
  รายละเอียด: "assetDetail",
  ชนิดสินทรัพย์: "sourceAssetType",
  รายการสินทรัพย์: "sourceAssetItem",
  มูลค่า: "value",
  วันที่ได้รับ: "receivedDate",
};

export function displaySourceColumnLabel(column: string | null | undefined): string {
  if (!column) return "";
  const emptyColumn = column.match(/^__EMPTY_COLUMN_(\d+)$/);
  if (emptyColumn) return `คอลัมน์ว่าง ${emptyColumn[1]}`;
  return SOURCE_COLUMN_LABELS[column] || column;
}

export function displaySourceColumnWithOriginal(column: string): string {
  const label = displaySourceColumnLabel(column);
  return label === column ? label : `${label} (${column})`;
}

export function previewRowsWithVisibleAssetType(
  rows: Record<string, any>[],
): Record<string, any>[] {
  let previousAssetItem = "";

  return rows.map((row) => {
    const sourceAssetItem = String(row[SOURCE_ASSET_ITEM_COLUMN] || "").trim();

    let nextRow = row;

    if (sourceAssetItem) {
      // Export intentionally stamps this value onto every row of the group
      // (see lib/transform.ts), so the emit-once flag no longer distinguishes
      // "first row" from the rest. Preview grouping instead dedupes purely by
      // comparing consecutive values, independent of what export does.
      const shouldShowItem = sourceAssetItem !== previousAssetItem;
      previousAssetItem = sourceAssetItem;

      if (!shouldShowItem) {
        nextRow = {
          ...nextRow,
          [SOURCE_ASSET_ITEM_COLUMN]: "",
        };
      }
    }

    return nextRow;
  });
}

export function statusIcon(status: SheetStatus): string {
  if (status === "success") return "✓";
  if (status === "warning") return "!";
  if (status === "error") return "×";
  if (status === "preserved") return "↳";
  return "–";
}

export function statusLabel(status: SheetStatus): string {
  if (status === "success") return "พร้อมใช้งาน";
  if (status === "warning") return "มีคำเตือน";
  if (status === "error") return "พบข้อผิดพลาด";
  if (status === "preserved") return "เก็บชีตต้นฉบับ";
  return "ข้ามชีต";
}

export function summaryText(summary: SheetSummary): string {
  if (summary.status === "preserved") return "เก็บต้นฉบับ";
  if (summary.status === "skipped") return "ข้าม";
  if (summary.errorCount > 0) return `${summary.errorCount} ข้อผิดพลาด`;
  if (summary.warningCount > 0) return `${summary.warningCount} คำเตือน`;
  return `${summary.rowCount} แถว`;
}

export function issueSeverityLabel(severity: ValidationIssue["severity"]): string {
  return severity === "error" ? "ผิดพลาด" : "เตือน";
}

// Columns validated against the template's Reference sheet (lib/validate.ts
// REFERENCE_COLUMNS). Mismatches here usually mean the Reference sheet is
// missing a real value the municipality actually uses (e.g. a department
// name not yet added as a dropdown option) - not a conversion defect - so
// the UI groups/counts them separately from structural issues instead of
// listing every row.
const REFERENCE_MISMATCH_COLUMNS = new Set([
  "ประเภทสินทรัพย์",
  "ชนิดสินทรัพย์",
  "รายการสินทรัพย์",
  "หน่วยนับ",
  "อาคาร",
  "ห้อง",
  "ผู้ถือครอง",
  "สำนัก",
  "ฝ่าย",
  "งาน",
  "งานที่รับผิดชอบ",
]);

export function isReferenceMismatchIssue(issue: ValidationIssue): boolean {
  return REFERENCE_MISMATCH_COLUMNS.has(issue.column) && issue.message.includes("ไม่อยู่ใน Reference");
}

export function splitIssuesByReferenceMismatch(issues: ValidationIssue[]): {
  referenceIssues: ValidationIssue[];
  otherIssues: ValidationIssue[];
} {
  const referenceIssues: ValidationIssue[] = [];
  const otherIssues: ValidationIssue[] = [];
  for (const issue of issues) {
    if (isReferenceMismatchIssue(issue)) referenceIssues.push(issue);
    else otherIssues.push(issue);
  }
  return { referenceIssues, otherIssues };
}

export function displayIssueColumn(column: string): string {
  if (column === "row") return "ทั้งแถว";
  if (column === "sheet") return "ระดับชีต";
  if (column === "header") return "หัวตาราง";
  return column;
}

export function displayIssueMessage(message: string): string {
  const exactDuplicate = message.match(
    /^Exact duplicate exported row matches row (\d+)\. Duplicate asset codes are allowed when other fields differ\.$/,
  );
  if (exactDuplicate) {
    return `แถวส่งออกซ้ำกับแถวที่ ${exactDuplicate[1]} แบบทั้งแถว ระบบอนุญาตให้รหัสสินทรัพย์ซ้ำได้เฉพาะกรณีที่ข้อมูลช่องอื่นแตกต่างกัน`;
  }
  return message;
}

export function createRuntimeSheetSummary(
  sheet: SheetData,
  sheetIssues: ValidationIssue[],
): SheetSummary {
  if (sheet.eligibility === "preserved") {
    return {
      sheetName: sheet.sheetName,
      status: "preserved",
      rowCount: sheet.rowCount,
      headerRow: sheet.headerRowIndex + 1,
      errorCount: 0,
      warningCount: 0,
      reason: sheet.eligibilityReason,
    };
  }
  const errorCount = sheetIssues.filter((issue) => issue.severity === "error").length;
  const warningCount =
    sheetIssues.filter((issue) => issue.severity === "warning").length +
    (sheet.summary?.warningCount || 0);
  return {
    sheetName: sheet.sheetName,
    status: errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "success",
    rowCount: sheet.rowCount,
    headerRow: sheet.headerRowIndex + 1,
    errorCount,
    warningCount,
  };
}
