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

const SOURCE_PROFILE_COLUMN = "__sourceProfile";
const SOURCE_ASSET_TYPE_COLUMN = "sourceAssetType";
const SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN = "__sourceAssetTypeEmitOnce";

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
  let previousAssetType = "";

  return rows.map((row) => {
    const profile = String(row[SOURCE_PROFILE_COLUMN] || "").trim();
    const sourceAssetType = String(row[SOURCE_ASSET_TYPE_COLUMN] || "").trim();

    if (profile !== "REGISTER_3_ROW_HEADER" || !sourceAssetType) return row;

    const emitFlag = row[SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN];
    const shouldShow =
      emitFlag === true || (emitFlag !== false && sourceAssetType !== previousAssetType);
    previousAssetType = sourceAssetType;

    return shouldShow
      ? row
      : {
          ...row,
          [SOURCE_ASSET_TYPE_COLUMN]: "",
        };
  });
}

export function statusIcon(status: SheetStatus): string {
  if (status === "success") return "✓";
  if (status === "warning") return "!";
  if (status === "error") return "×";
  return "–";
}

export function statusLabel(status: SheetStatus): string {
  if (status === "success") return "พร้อมใช้งาน";
  if (status === "warning") return "มีคำเตือน";
  if (status === "error") return "พบข้อผิดพลาด";
  return "ข้ามชีต";
}

export function summaryText(summary: SheetSummary): string {
  if (summary.status === "skipped") return "ข้าม";
  if (summary.errorCount > 0) return `${summary.errorCount} ข้อผิดพลาด`;
  if (summary.warningCount > 0) return `${summary.warningCount} คำเตือน`;
  return `${summary.rowCount} แถว`;
}

export function issueSeverityLabel(severity: ValidationIssue["severity"]): string {
  return severity === "error" ? "ผิดพลาด" : "เตือน";
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
