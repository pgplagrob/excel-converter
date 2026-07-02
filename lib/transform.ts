import { TEMPLATE_COLUMNS } from "./mapping";
import {
  INTERNAL,
  SOURCE_ASSET_ITEM_COLUMN,
  SOURCE_ASSET_NAME_COLUMN,
  SOURCE_ASSET_TYPE_COLUMN,
  SOURCE_PROFILE_COLUMN,
  type SourceProfile,
  normalizeThaiDate,
} from "./datasource";

export type TemplateMapping = Record<string, string | null | undefined>;

export interface TransformSheetInput {
  sheetName: string;
  rows: Record<string, any>[];
  mapping: TemplateMapping;
}

function cellText(value: any): string {
  return value === undefined || value === null ? "" : value.toString().trim();
}

function emptyTemplateRow(): Record<string, any> {
  const row: Record<string, any> = {};
  for (const column of TEMPLATE_COLUMNS) row[column] = "";
  return row;
}

function isKnownProfile(profile: string): profile is SourceProfile {
  return profile === "NEW_ASSET_2567" || profile === "REGISTER_3_ROW_HEADER" || profile === "TRANSFER_2567";
}

function firstText(...values: any[]): string {
  for (const value of values) {
    const text = cellText(value);
    if (text) return text;
  }
  return "";
}

function cleanMoneyValue(value: any): any {
  const text = cellText(value);
  if (!text) return "";
  if (/^[\s\-–—]+$/.test(text)) return "";
  return value;
}

function sourceValue(sourceRow: Record<string, any>, publicField: string, internalField: string): any {
  const publicValue = sourceRow[publicField];
  return cellText(publicValue) ? publicValue : sourceRow[internalField];
}

function deriveAssetCategory(sourceRow: Record<string, any>, sourceAssetType: string): string {
  const explicitCategory = cellText(sourceRow[INTERNAL.assetCategory]);
  if (explicitCategory) return explicitCategory;
  return sourceAssetType.includes("อสังหาริมทรัพย์") || sourceAssetType.includes("อาคาร")
    ? "อสังหาริมทรัพย์"
    : "ครุภัณฑ์";
}

function mapProfileRow(sourceRow: Record<string, any>, profile: SourceProfile): Record<string, any> {
  const row = emptyTemplateRow();
  const sourceAssetType = cellText(sourceRow[SOURCE_ASSET_TYPE_COLUMN]);
  const sourceAssetItem = cellText(sourceRow[SOURCE_ASSET_ITEM_COLUMN]);
  const assetCode = sourceValue(sourceRow, "assetCode", INTERNAL.assetCode) ?? "";
  const assetName = firstText(sourceRow.assetName, sourceRow[INTERNAL.assetName]);
  const assetDetail = firstText(sourceRow.assetDetail, sourceRow[INTERNAL.detail], assetName);

  row["รหัสสินทรัพย์"] = assetCode;
  row["ชื่อสินทรัพย์"] = assetName;
  row["รายละเอียด"] = assetDetail || assetName;
  row["ประเภทสินทรัพย์"] = deriveAssetCategory(sourceRow, sourceAssetType);
  row["ชนิดสินทรัพย์"] = sourceAssetType;
  row["รายการสินทรัพย์"] = sourceAssetItem;
  row["มูลค่า"] = cleanMoneyValue(sourceValue(sourceRow, "value", INTERNAL.value));
  row["วันที่ได้รับ"] = sourceValue(sourceRow, "receivedDate", INTERNAL.receivedDate) ?? "";
  row["งานที่รับผิดชอบ"] = sourceValue(sourceRow, "responsibleUnit", INTERNAL.responsibleUnit) ?? "";
  row["สถานะ"] = sourceRow[INTERNAL.status] ?? "";
  row["ต้องตรวจนับ"] = sourceRow[INTERNAL.needCount] ?? "";
  row["คิดค่าเสื่อม"] = sourceRow[INTERNAL.depreciationFlag] ?? "";
  row["ของสำคัญ"] = sourceRow[INTERNAL.importantFlag] ?? "";

  if (profile === "NEW_ASSET_2567") {
    row["ได้มาโดย"] = sourceValue(sourceRow, "acquiredBy", INTERNAL.acquiredBy) ?? "";
    row["อาคาร"] = sourceValue(sourceRow, "location", INTERNAL.location) ?? "";
    row["ระบุอื่น ๆ"] = sourceValue(sourceRow, "note", INTERNAL.note) ?? "";
  }

  if (profile === "REGISTER_3_ROW_HEADER") {
    row["ระบุอื่น ๆ"] = sourceValue(sourceRow, "note", INTERNAL.note) ?? "";
    row["ประเภทสินทรัพย์"] =
      sourceAssetType.includes("อสังหาริมทรัพย์") ||
      sourceRow[INTERNAL.assetCategory] === "อสังหาริมทรัพย์"
        ? "อสังหาริมทรัพย์"
        : "ครุภัณฑ์";
  }

  if (profile === "TRANSFER_2567") {
    row["รายละเอียด"] = assetDetail || assetName;
    row["ได้มาจาก"] = sourceValue(sourceRow, "acquiredFrom", INTERNAL.acquiredFrom) ?? "";
    row["แหล่งงบประมาณ"] = sourceValue(sourceRow, "budgetSource", INTERNAL.budgetSource) ?? "";
    row["สถานะ"] = "ปกติ";
  }

  return row;
}

function normalizeFullDateText(value: any): string | null {
  const normalized = normalizeThaiDate(value);
  return normalized || null;
}

function buildDateFromSourceColumns(sourceRow: Record<string, any>, sourceColumn: string): any {
  const value = sourceRow[sourceColumn] ?? "";
  const fullDate = normalizeFullDateText(value);
  if (fullDate) return fullDate;

  const keys = Object.keys(sourceRow);
  const sourceIndex = keys.indexOf(sourceColumn);
  if (sourceIndex < 0) return value;

  const combinedDate = normalizeThaiDate(
    sourceRow[keys[sourceIndex]],
    sourceRow[keys[sourceIndex + 1]],
    sourceRow[keys[sourceIndex + 2]],
  );
  return combinedDate || value;
}

const DATE_COLUMNS = new Set([
  "วันที่ได้รับ",
  "วันที่ได้รับโอน",
  "วันที่ออกจำหน่าย",
  "วันที่เริ่มรับประกัน",
  "วันที่หมดประกัน",
  "ณ วันที่ (ค่าเสื่อมยกมา)",
]);

function resolveFallbackValue(
  sourceRow: Record<string, any>,
  templateColumn: string,
  sourceColumn: string | null | undefined,
): any {
  if (!sourceColumn) return "";
  return DATE_COLUMNS.has(templateColumn)
    ? buildDateFromSourceColumns(sourceRow, sourceColumn)
    : sourceRow[sourceColumn] ?? "";
}

function mapFallbackRow(sourceRow: Record<string, any>, mapping: TemplateMapping): Record<string, any> {
  const templateRow = emptyTemplateRow();
  for (const templateColumn of TEMPLATE_COLUMNS) {
    templateRow[templateColumn] = resolveFallbackValue(
      sourceRow,
      templateColumn,
      mapping[templateColumn],
    );
  }

  const sourceAssetType = cellText(sourceRow[SOURCE_ASSET_TYPE_COLUMN]);
  if (!cellText(templateRow["ชนิดสินทรัพย์"]) && sourceAssetType) {
    templateRow["ชนิดสินทรัพย์"] = sourceAssetType;
  }

  const sourceAssetItem = cellText(sourceRow[SOURCE_ASSET_ITEM_COLUMN]);
  if (!cellText(templateRow["รายการสินทรัพย์"]) && sourceAssetItem) {
    templateRow["รายการสินทรัพย์"] = sourceAssetItem;
  }

  const assetCode = cellText(sourceRow.assetCode);
  const assetName = cellText(sourceRow.assetName);
  const assetDetail = firstText(sourceRow.assetDetail, assetName);
  if (assetCode || assetName || assetDetail || sourceAssetType || sourceAssetItem) {
    templateRow["รหัสสินทรัพย์"] = assetCode || templateRow["รหัสสินทรัพย์"] || "";
    templateRow["ชื่อสินทรัพย์"] = assetName || "";
    templateRow["รายละเอียด"] = assetDetail || assetName || "";
    templateRow["ประเภทสินทรัพย์"] = deriveAssetCategory(sourceRow, sourceAssetType);
    templateRow["ชนิดสินทรัพย์"] = sourceAssetType;
    templateRow["รายการสินทรัพย์"] = sourceAssetItem;
    templateRow["มูลค่า"] = cleanMoneyValue(sourceRow.value ?? templateRow["มูลค่า"]);
    templateRow["วันที่ได้รับ"] = sourceRow.receivedDate ?? templateRow["วันที่ได้รับ"] ?? "";
  }

  return templateRow;
}

export function transformRowsToTemplateDataset(
  rows: Record<string, any>[],
  mapping: TemplateMapping,
): Record<string, any>[] {
  return rows.map((sourceRow) => {
    const profile = cellText(sourceRow[SOURCE_PROFILE_COLUMN]);
    if (isKnownProfile(profile)) return mapProfileRow(sourceRow, profile);
    return mapFallbackRow(sourceRow, mapping);
  });
}

export function logTemplateDataset(
  sheetName: string,
  rows: Record<string, any>[],
  mapping: TemplateMapping,
): void {
  console.log("[TRANSFORM] templateDataset", {
    sheetName,
    rowCount: rows.length,
    mappedColumns: Object.entries(mapping)
      .filter(([, sourceColumn]) => Boolean(sourceColumn))
      .map(([templateColumn, sourceColumn]) => ({ templateColumn, sourceColumn })),
    sampleRows: rows.slice(0, 5),
  });
}
