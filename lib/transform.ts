import { TEMPLATE_COLUMNS } from "./mapping";
import {
  INTERNAL,
  SOURCE_ASSET_ITEM_EMIT_ONCE_COLUMN,
  SOURCE_ASSET_ITEM_COLUMN,
  SOURCE_ASSET_NAME_COLUMN,
  SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN,
  SOURCE_ASSET_TYPE_COLUMN,
  SOURCE_PROFILE_COLUMN,
  type SourceProfile,
  looksLikeAssetItemGroup,
  looksLikeAssetTypeGroup,
  normalizeThaiDate,
} from "./datasource";

export type TemplateMapping = Record<string, string | null | undefined>;

export interface TransformSheetInput {
  sheetName: string;
  rows: Record<string, any>[];
  mapping: TemplateMapping;
  manualMapping?: TemplateMapping;
}

function cellText(value: any): string {
  return value === undefined || value === null ? "" : value.toString().trim();
}

const ASSET_NAME_COLUMN = "ชื่อสินทรัพย์";
const ASSET_DETAIL_COLUMN = "รายละเอียด";
const ASSET_TYPE_COLUMN = "ชนิดสินทรัพย์";
const ASSET_ITEM_COLUMN = "รายการสินทรัพย์";
const AUTHORITATIVE_TEMPLATE_COLUMNS = new Set([
  ASSET_NAME_COLUMN,
  ASSET_DETAIL_COLUMN,
  ASSET_TYPE_COLUMN,
  ASSET_ITEM_COLUMN,
]);

const FUND_COLUMNS = [
  "เงินงบประมาณ",
  "เงินสะสม/เงินทุนสำรองเงินสะสม",
  "เงินอุดหนุนระบุวัตถุประสงค์/เฉพาะกิจ",
  "เงินรับฝาก",
  "รับโอน/รับบริจาค",
  "เงินกู้",
  "รายได้สะสม",
  "ทุนดำเนินการ",
] as const;

function emptyTemplateRow(): Record<string, any> {
  const row: Record<string, any> = {};
  for (const column of TEMPLATE_COLUMNS) row[column] = "";
  return row;
}

function isKnownProfile(profile: string): profile is SourceProfile {
  return (
    profile === "NEW_ASSET_2567" ||
    profile === "REGISTER_3_ROW_HEADER" ||
    profile === "TRANSFER_2567" ||
    profile === "ASSET_DATA"
  );
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

function fundColumnForSource(value: any): (typeof FUND_COLUMNS)[number] | undefined {
  const source = cellText(value).toLowerCase().replace(/\s+/g, "");
  if (!source) return undefined;
  if (source.includes("เงินงบประมาณ")) return "เงินงบประมาณ";
  if (source.includes("เงินสะสม") || source.includes("เงินทุนสำรองเงินสะสม")) {
    return "เงินสะสม/เงินทุนสำรองเงินสะสม";
  }
  if (source.includes("เงินอุดหนุน") || source.includes("เฉพาะกิจ")) {
    return "เงินอุดหนุนระบุวัตถุประสงค์/เฉพาะกิจ";
  }
  if (source.includes("เงินรับฝาก")) return "เงินรับฝาก";
  if (source.includes("รับโอน") || source.includes("รับบริจาค")) return "รับโอน/รับบริจาค";
  if (source.includes("เงินกู้")) return "เงินกู้";
  if (source.includes("รายได้สะสม") || source.includes("เงินรายได้")) return "รายได้สะสม";
  if (source.includes("ทุนดำเนินการ")) return "ทุนดำเนินการ";
  return undefined;
}

function sourceValue(sourceRow: Record<string, any>, publicField: string, internalField: string): any {
  const publicValue = sourceRow[publicField];
  return cellText(publicValue) ? publicValue : sourceRow[internalField];
}

function applyBudgetAllocation(
  templateRow: Record<string, any>,
  sourceRow: Record<string, any>,
): Record<string, any> {
  const hasFundAllocation = FUND_COLUMNS.some((column) => {
    const value = cellText(templateRow[column]);
    if (!value) return false;
    const numericValue = Number(value.replace(/,/g, ""));
    return Number.isFinite(numericValue) ? numericValue !== 0 : true;
  });
  if (hasFundAllocation) return templateRow;

  const fundColumn = fundColumnForSource(
    sourceValue(sourceRow, "budgetSource", INTERNAL.budgetSource),
  );
  const value = cleanMoneyValue(sourceValue(sourceRow, "value", INTERNAL.value));
  if (fundColumn && value !== "") templateRow[fundColumn] = value;
  return templateRow;
}

function startsWithMainAssetType(value: any): boolean {
  const text = cellText(value);
  return (
    looksLikeAssetTypeGroup(text) ||
    text.startsWith("สินทรัพย์") ||
    text.startsWith("à¸„à¸£à¸¸à¸ à¸±à¸“à¸‘à¹Œ") ||
    text.startsWith("à¸­à¸ªà¸±à¸‡à¸«à¸²à¸£à¸´à¸¡à¸—à¸£à¸±à¸žà¸¢à¹Œ")
  );
}

function isGroupOrCategoryLabel(value: any): boolean {
  return looksLikeAssetItemGroup(value) || startsWithMainAssetType(value);
}

function normalizedAssetFields(sourceRow: Record<string, any>): {
  assetName: string;
  assetDetail: string;
  sourceAssetType: string;
  sourceAssetItem: string;
} {
  let sourceAssetType = cellText(sourceRow[SOURCE_ASSET_TYPE_COLUMN]);
  let sourceAssetItem = cellText(sourceRow[SOURCE_ASSET_ITEM_COLUMN]);
  const assetCode = firstText(sourceRow.assetCode, sourceRow[INTERNAL.assetCode]);
  let assetName = firstText(sourceRow.assetName, sourceRow[INTERNAL.assetName], sourceRow[SOURCE_ASSET_NAME_COLUMN]);
  let assetDetail = firstText(sourceRow.assetDetail, sourceRow[INTERNAL.detail]);

  // Do not reinterpret a real asset name from a coded data row as a group label.
  if (!assetCode && looksLikeAssetItemGroup(assetName)) {
    if (!sourceAssetItem) {
      sourceAssetItem = assetName;
      sourceRow[SOURCE_ASSET_ITEM_COLUMN] = sourceAssetItem;
    }
    assetName = "";
  }

  if (!assetCode && startsWithMainAssetType(assetName)) {
    if (!sourceAssetType) {
      sourceAssetType = assetName;
      sourceRow[SOURCE_ASSET_TYPE_COLUMN] = sourceAssetType;
    }
    assetName = "";
  }

  if (assetName && sourceAssetItem && assetName === sourceAssetItem) {
    assetName = "";
  }

  if (
    isGroupOrCategoryLabel(assetDetail) ||
    (sourceAssetItem && assetDetail === sourceAssetItem) ||
    (sourceAssetType && assetDetail === sourceAssetType)
  ) {
    assetDetail = "";
  }

  return {
    assetName,
    assetDetail,
    sourceAssetType,
    sourceAssetItem,
  };
}

function sourceAssetItemShouldEmit(sourceRow: Record<string, any>): boolean {
  return sourceRow[SOURCE_ASSET_ITEM_EMIT_ONCE_COLUMN] === true;
}

function sourceAssetTypeShouldEmit(sourceRow: Record<string, any>): boolean {
  // Keep the type visible on every asset row when the parser carried a
  // non-empty group/type value forward. This is also how NEW_ASSET_2567
  // behaves and keeps the exported sheets consistent with one another.
  return Boolean(cellText(sourceRow[SOURCE_ASSET_TYPE_COLUMN]));
}

function hasAssetTypeEmitFlag(sourceRow: Record<string, any>): boolean {
  const emitOnce = sourceRow[SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN];
  return emitOnce === true || emitOnce === false;
}

function backfillRegisterAssetTypeEmitFlags(rows: Record<string, any>[]): Record<string, any>[] {
  let previousAssetType = "";

  return rows.map((sourceRow) => {
    const profile = cellText(sourceRow[SOURCE_PROFILE_COLUMN]);
    const sourceAssetType = cellText(sourceRow[SOURCE_ASSET_TYPE_COLUMN]);

    if (profile !== "REGISTER_3_ROW_HEADER" || !sourceAssetType) return sourceRow;

    if (hasAssetTypeEmitFlag(sourceRow)) {
      previousAssetType = sourceAssetType;
      return sourceRow;
    }

    const shouldEmit = sourceAssetType !== previousAssetType;
    previousAssetType = sourceAssetType;

    return {
      ...sourceRow,
      [SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN]: shouldEmit,
    };
  });
}

function sourceAssetCategory(sourceRow: Record<string, any>): string {
  return cellText(sourceRow[INTERNAL.assetCategory]);
}

function applyAuthoritativeAssetFields(templateRow: Record<string, any>, sourceRow: Record<string, any>): void {
  const normalized = normalizedAssetFields(sourceRow);
  const visibleSourceAssetType = sourceAssetTypeShouldEmit(sourceRow) ? normalized.sourceAssetType : "";
  templateRow[ASSET_NAME_COLUMN] = normalized.assetName || "";
  templateRow[ASSET_DETAIL_COLUMN] = normalized.assetDetail || "";
  templateRow[ASSET_TYPE_COLUMN] = visibleSourceAssetType;
  templateRow[ASSET_ITEM_COLUMN] = sourceAssetItemShouldEmit(sourceRow) ? normalized.sourceAssetItem || "" : "";
}

function mapProfileRow(sourceRow: Record<string, any>, profile: SourceProfile): Record<string, any> {
  const row = emptyTemplateRow();
  const normalized = normalizedAssetFields(sourceRow);
  const sourceAssetType = normalized.sourceAssetType;
  const sourceAssetItem = normalized.sourceAssetItem;
  const visibleSourceAssetType = sourceAssetTypeShouldEmit(sourceRow) ? sourceAssetType : "";
  const assetCode = sourceValue(sourceRow, "assetCode", INTERNAL.assetCode) ?? "";
  const assetName = normalized.assetName;
  const assetDetail = normalized.assetDetail;

  row["รหัสสินทรัพย์"] = assetCode;
  row[ASSET_NAME_COLUMN] = assetName;
  row[ASSET_DETAIL_COLUMN] = assetDetail;
  row["ประเภทสินทรัพย์"] = sourceAssetCategory(sourceRow);
  row[ASSET_TYPE_COLUMN] = visibleSourceAssetType;
  row[ASSET_ITEM_COLUMN] = sourceAssetItemShouldEmit(sourceRow) ? sourceAssetItem : "";
  row["มูลค่า"] = cleanMoneyValue(sourceValue(sourceRow, "value", INTERNAL.value));
  row["วันที่ได้รับ"] = sourceValue(sourceRow, "receivedDate", INTERNAL.receivedDate) ?? "";
  row["งาน"] = sourceValue(sourceRow, "responsibleUnit", INTERNAL.responsibleUnit) ?? "";
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
    row["ประเภทสินทรัพย์"] = sourceAssetCategory(sourceRow);
  }

  if (profile === "TRANSFER_2567" || profile === "ASSET_DATA") {
    row[ASSET_DETAIL_COLUMN] = assetDetail;
    row["ได้มาจาก"] = sourceValue(sourceRow, "acquiredFrom", INTERNAL.acquiredFrom) ?? "";
    row["อาคาร"] = sourceValue(sourceRow, "location", INTERNAL.location) ?? "";
    row["สถานะ"] = sourceRow[INTERNAL.status] || "";
  }

  applyAuthoritativeAssetFields(row, sourceRow);
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
  "วันที่ยกมา",
  "วันหมดอายุ (ส่วนประกอบ)",
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

function applyManualMapping(
  templateRow: Record<string, any>,
  sourceRow: Record<string, any>,
  manualMapping: TemplateMapping,
): Record<string, any> {
  for (const [templateColumn, sourceColumn] of Object.entries(manualMapping)) {
    if (!TEMPLATE_COLUMNS.includes(templateColumn)) continue;
    // A manual mapping is an explicit instruction to copy one source cell.
    // Do not normalize dates, split text, or otherwise change the source value.
    templateRow[templateColumn] = sourceColumn ? sourceRow[sourceColumn] ?? "" : "";
  }
  return templateRow;
}

// The parser's normalized `responsibleUnit` field and the auto-mapped
// "งานที่รับผิดชอบ" template column can both originate from the very same
// source cell (e.g. a header literally named "งานที่รับผิดชอบ"). Copying
// `responsibleUnit` into "งาน" unconditionally therefore duplicated that one
// source value into two template columns. This only backfills "งาน" when it
// is genuinely still empty (no source header actually mapped to "งาน" itself,
// as happens for headerless/positional layouts) AND doing so would not repeat
// a value already placed in "งานที่รับผิดชอบ" by the mapping loop above.
function resolveResponsibleWorkFallback(
  templateRow: Record<string, any>,
  sourceRow: Record<string, any>,
): any {
  const existingWork = cellText(templateRow["งาน"]);
  if (existingWork) return templateRow["งาน"];

  const responsibleUnit = sourceRow.responsibleUnit;
  const responsibleUnitText = cellText(responsibleUnit);
  if (!responsibleUnitText) return templateRow["งาน"] ?? "";

  const mappedResponsibleWork = cellText(templateRow["งานที่รับผิดชอบ"]);
  if (mappedResponsibleWork && mappedResponsibleWork === responsibleUnitText) {
    // Already surfaced verbatim in "งานที่รับผิดชอบ" via the source header
    // mapping; leave "งาน" empty rather than duplicating the same value.
    return templateRow["งาน"] ?? "";
  }

  return responsibleUnit;
}

function mapFallbackRow(sourceRow: Record<string, any>, mapping: TemplateMapping): Record<string, any> {
  const templateRow = emptyTemplateRow();
  for (const templateColumn of TEMPLATE_COLUMNS) {
    if (AUTHORITATIVE_TEMPLATE_COLUMNS.has(templateColumn)) continue;
    templateRow[templateColumn] = resolveFallbackValue(
      sourceRow,
      templateColumn,
      mapping[templateColumn],
    );
  }

  const normalized = normalizedAssetFields(sourceRow);
  const sourceAssetType = normalized.sourceAssetType;
  const sourceAssetItem = normalized.sourceAssetItem;
  const visibleSourceAssetType = sourceAssetTypeShouldEmit(sourceRow) ? sourceAssetType : "";

  const assetCode = cellText(sourceRow.assetCode);
  const assetName = normalized.assetName;
  const assetDetail = normalized.assetDetail;
  if (assetCode || assetName || assetDetail || sourceAssetType || sourceAssetItem) {
    templateRow["รหัสสินทรัพย์"] = assetCode || templateRow["รหัสสินทรัพย์"] || "";
    templateRow["ประเภทสินทรัพย์"] = sourceAssetCategory(sourceRow);
    templateRow["มูลค่า"] = cleanMoneyValue(sourceRow.value ?? templateRow["มูลค่า"]);
    templateRow["วันที่ได้รับ"] = sourceRow.receivedDate ?? templateRow["วันที่ได้รับ"] ?? "";
    templateRow["งาน"] = resolveResponsibleWorkFallback(templateRow, sourceRow);
    templateRow["อาคาร"] = sourceRow.location ?? templateRow["อาคาร"] ?? "";
    templateRow["ได้มาโดย"] = sourceRow.acquiredBy ?? templateRow["ได้มาโดย"] ?? "";
    templateRow["ได้มาจาก"] = sourceRow.acquiredFrom ?? templateRow["ได้มาจาก"] ?? "";
    templateRow["ระบุอื่น ๆ"] = sourceRow.note ?? templateRow["ระบุอื่น ๆ"] ?? "";
    templateRow["สถานะ"] = sourceRow[INTERNAL.status] ?? templateRow["สถานะ"] ?? "";
    templateRow["ต้องตรวจนับ"] = sourceRow[INTERNAL.needCount] ?? templateRow["ต้องตรวจนับ"] ?? "";
    templateRow["คิดค่าเสื่อม"] =
      sourceRow[INTERNAL.depreciationFlag] ?? templateRow["คิดค่าเสื่อม"] ?? "";
    templateRow["ของสำคัญ"] = sourceRow[INTERNAL.importantFlag] ?? templateRow["ของสำคัญ"] ?? "";
  }

  applyAuthoritativeAssetFields(templateRow, sourceRow);
  return templateRow;
}

function forceFlagColumns(templateRow: Record<string, any>): Record<string, any> {
  templateRow["ต้องตรวจนับ"] = "True";
  templateRow["คิดค่าเสื่อม"] = cellText(templateRow["คิดค่าเสื่อม"]) || "False";
  templateRow["ดึงอายุจากค่ากลาง"] = cellText(templateRow["ดึงอายุจากค่ากลาง"]) || "False";
  templateRow["ของสำคัญ"] = cellText(templateRow["ของสำคัญ"]) || "False";
  templateRow["ส่งคืนสินทรัพย์"] = cellText(templateRow["ส่งคืนสินทรัพย์"]) || "false";
  return templateRow;
}

export function transformRowsToTemplateDataset(
  rows: Record<string, any>[],
  mapping: TemplateMapping,
  manualMapping: TemplateMapping = {},
): Record<string, any>[] {
  const rowsWithEmitFlags = backfillRegisterAssetTypeEmitFlags(rows);
  return rowsWithEmitFlags.map((sourceRow) => {
    const profile = cellText(sourceRow[SOURCE_PROFILE_COLUMN]);
    const templateRow = isKnownProfile(profile)
      ? mapProfileRow(sourceRow, profile)
      : mapFallbackRow(sourceRow, mapping);
    return forceFlagColumns(
      applyManualMapping(
        applyBudgetAllocation(templateRow, sourceRow),
        sourceRow,
        manualMapping,
      ),
    );
  });
}

