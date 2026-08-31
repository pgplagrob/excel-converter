import { normalizeThaiDate } from "./date";
import {
  INTERNAL,
  NORMALIZED_FIELD_HEADERS,
  SOURCE_ASSET_ITEM_COLUMN,
  SOURCE_ASSET_ITEM_EMIT_ONCE_COLUMN,
  SOURCE_ASSET_NAME_COLUMN,
  SOURCE_ASSET_TYPE_COLUMN,
  SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN,
  SOURCE_EXCEL_ROW_COLUMN,
  SOURCE_PROFILE_COLUMN,
  SOURCE_ROW_INDEX_COLUMN,
  SOURCE_ROW_KEY_COLUMN,
  SOURCE_SHEET_NAME_COLUMN,
  type NormalizedSourceAssetRow,
  type SourceProfile,
} from "./types";
import { normalizeFlexibleStatus } from "./status";
import {
  cellText,
  looksLikeAssetItemGroup,
  looksLikeAssetType,
} from "./text";

function normalizeCell(value: any): any {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return normalizeThaiDate(value);
  return value;
}

export function buildHeaderKeys(rawHeaders: any[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((header, index) => {
    const baseKey = cellText(header) || `__EMPTY_COLUMN_${index + 1}`;
    const count = seen.get(baseKey) || 0;
    seen.set(baseKey, count + 1);
    return count === 0 ? baseKey : `${baseKey}__DUPLICATE_${count + 1}`;
  });
}

export function buildRawRow(headers: string[], sourceRow: any[]): Record<string, any> {
  const row: Record<string, any> = {};
  headers.forEach((header, index) => {
    row[header] = normalizeCell(sourceRow[index]);
  });
  return row;
}

function buildCompositeRowKey(
  sheetName: string,
  sourceRowIndex: number,
  assetCode: string,
  assetName: string,
): string {
  return JSON.stringify([sheetName, sourceRowIndex, assetCode, assetName]);
}

export function updateRowIdentity(row: Record<string, any>): void {
  const excelRow = Number(row[SOURCE_EXCEL_ROW_COLUMN]);
  const sourceRowIndex =
    typeof row[SOURCE_ROW_INDEX_COLUMN] === "number"
      ? row[SOURCE_ROW_INDEX_COLUMN]
      : Number.isFinite(excelRow)
        ? excelRow - 1
        : -1;
  const assetCode = cellText(row.assetCode || row[INTERNAL.assetCode]);
  const assetName = cellText(row.assetName || row[INTERNAL.assetName] || row[SOURCE_ASSET_NAME_COLUMN]);

  row[SOURCE_ROW_INDEX_COLUMN] = sourceRowIndex;
  row[SOURCE_ROW_KEY_COLUMN] = buildCompositeRowKey(
    cellText(row[SOURCE_SHEET_NAME_COLUMN]),
    sourceRowIndex,
    assetCode,
    assetName,
  );
}

export function withCommonMeta(
  row: Record<string, any>,
  profile: SourceProfile,
  sheetName: string,
  excelRow: number,
  sourceAssetType: string,
  sourceAssetTypeEmitOnce: boolean | undefined,
  sourceAssetItem: string,
  sourceAssetName: string,
  sourceAssetItemEmitOnce = false,
): Record<string, any> {
  row[SOURCE_PROFILE_COLUMN] = profile;
  row[SOURCE_SHEET_NAME_COLUMN] = sheetName;
  row[SOURCE_EXCEL_ROW_COLUMN] = excelRow;
  row[SOURCE_ROW_INDEX_COLUMN] = excelRow - 1;
  row[SOURCE_ASSET_TYPE_COLUMN] = sourceAssetType;
  if (sourceAssetTypeEmitOnce !== undefined) {
    row[SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN] = sourceAssetTypeEmitOnce;
  }
  row[SOURCE_ASSET_ITEM_COLUMN] = sourceAssetItem;
  row[SOURCE_ASSET_ITEM_EMIT_ONCE_COLUMN] = sourceAssetItemEmitOnce;
  row[SOURCE_ASSET_NAME_COLUMN] = sourceAssetName;
  updateRowIdentity(row);
  return row;
}

export function setNormalizedFields(
  row: Record<string, any>,
  values: Partial<NormalizedSourceAssetRow> & {
    assetCode: string;
    assetName: string;
  },
): Record<string, any> {
  let assetName = cellText(values.assetName);
  let assetDetail = cellText(values.assetDetail);

  if (!values.assetCode && looksLikeAssetItemGroup(assetName)) {
    if (!cellText(row[SOURCE_ASSET_ITEM_COLUMN])) row[SOURCE_ASSET_ITEM_COLUMN] = assetName;
    assetName = "";
    if (looksLikeAssetItemGroup(assetDetail)) assetDetail = "";
  }

  if (!values.assetCode && looksLikeAssetType(assetName)) {
    if (!cellText(row[SOURCE_ASSET_TYPE_COLUMN])) row[SOURCE_ASSET_TYPE_COLUMN] = assetName;
    assetName = "";
    if (looksLikeAssetType(assetDetail)) assetDetail = "";
  }

  row.assetCode = values.assetCode || "";
  row.assetName = assetName;
  row.assetDetail = assetDetail;
  row.receivedDate = values.receivedDate ?? "";
  row.value = values.value ?? "";
  row.responsibleUnit = values.responsibleUnit || "";
  row.location = values.location || "";
  row.acquiredBy = values.acquiredBy || "";
  row.acquiredFrom = values.acquiredFrom || "";
  row.budgetSource = values.budgetSource || "";
  row.note = values.note || "";
  row.statusNormal = values.statusNormal ?? "";
  row.statusBroken = values.statusBroken ?? "";
  row.statusDeteriorated = values.statusDeteriorated ?? "";
  row.statusLost = values.statusLost ?? "";
  row.statusStoredLong = values.statusStoredLong ?? "";
  row.statusUnnecessary = values.statusUnnecessary ?? "";
  row[INTERNAL.assetCode] = row.assetCode;
  row[INTERNAL.assetName] = row.assetName;
  row[INTERNAL.detail] = row.assetDetail;
  row[INTERNAL.receivedDate] = row.receivedDate;
  row[INTERNAL.value] = row.value;
  row[INTERNAL.responsibleUnit] = row.responsibleUnit;
  row[INTERNAL.location] = row.location;
  row[INTERNAL.acquiredBy] = row.acquiredBy;
  row[INTERNAL.acquiredFrom] = row.acquiredFrom;
  row[INTERNAL.budgetSource] = row.budgetSource;
  row[INTERNAL.note] = row.note;
  updateRowIdentity(row);
  return row;
}

export function appendNormalizedDetail(row: Record<string, any>, detail: string): void {
  row.assetDetail = [row.assetDetail, detail].map(cellText).filter(Boolean).join(" ");
  row[INTERNAL.detail] = row.assetDetail;
}

export function appendNormalizedNote(row: Record<string, any>, note: string): void {
  row.note = [row.note, note].map(cellText).filter(Boolean).join(" ");
  row[INTERNAL.note] = row.note;
}

export function appendHeaders(headers: string[]): string[] {
  const extras = [
    SOURCE_PROFILE_COLUMN,
    SOURCE_SHEET_NAME_COLUMN,
    SOURCE_EXCEL_ROW_COLUMN,
    SOURCE_ROW_INDEX_COLUMN,
    SOURCE_ROW_KEY_COLUMN,
    SOURCE_ASSET_TYPE_COLUMN,
    SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN,
    SOURCE_ASSET_ITEM_COLUMN,
    SOURCE_ASSET_ITEM_EMIT_ONCE_COLUMN,
    SOURCE_ASSET_NAME_COLUMN,
    ...NORMALIZED_FIELD_HEADERS,
  ];
  return [...headers, ...extras.filter((header) => !headers.includes(header))];
}

export function setFlexibleSourceStatus(row: Record<string, any>, status: any): void {
  row[INTERNAL.status] = normalizeFlexibleStatus(status, "");
}
