import { getAllKeywords } from "./mapping";
import type { WorkbookRowMeta } from "./excel";

export type SourceProfile =
  | "NEW_ASSET_2567"
  | "REGISTER_3_ROW_HEADER"
  | "TRANSFER_2567"
  | "SUMMARY_SKIP"
  | "UNKNOWN";

export interface DataSourceSheet {
  sheetName: string;
  sourceProfile: SourceProfile;
  headerRowIndex: number;
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
  groupedAssets: GroupedAssetDebug[];
  warnings: string[];
}

export interface DataSourceWorkbook {
  fileName: string;
  sheets: DataSourceSheet[];
  skippedSheets: string[];
}

export const SOURCE_PROFILE_COLUMN = "__sourceProfile";
export const SOURCE_SHEET_NAME_COLUMN = "__sheetName";
export const SOURCE_EXCEL_ROW_COLUMN = "__excelRow";
export const SOURCE_ASSET_TYPE_COLUMN = "sourceAssetType";
export const SOURCE_ASSET_ITEM_COLUMN = "sourceAssetItem";
export const SOURCE_ASSET_NAME_COLUMN = "sourceAssetName";

export type NormalizedSourceAssetRow = {
  __sourceProfile: string;
  __sheetName: string;
  __excelRow: number;
  assetCode: string;
  assetName: string;
  assetDetail?: string;
  sourceAssetType?: string;
  sourceAssetItem?: string;
  receivedDate?: unknown;
  value?: unknown;
  responsibleUnit?: string;
  location?: string;
  acquiredBy?: string;
  acquiredFrom?: string;
  budgetSource?: string;
  note?: string;
  statusNormal?: unknown;
  statusBroken?: unknown;
  statusDeteriorated?: unknown;
  statusLost?: unknown;
  statusStoredLong?: unknown;
  statusUnnecessary?: unknown;
};

export const INTERNAL = {
  seq: "__seq",
  assetCode: "__assetCode",
  assetName: "__assetName",
  detail: "__detail",
  receivedDate: "__receivedDate",
  value: "__value",
  acquiredBy: "__acquiredBy",
  acquiredFrom: "__acquiredFrom",
  budgetSource: "__budgetSource",
  location: "__location",
  responsibleUnit: "__responsibleUnit",
  note: "__note",
  status: "__status",
  assetCategory: "__assetCategory",
  depreciationFlag: "__depreciationFlag",
  needCount: "__needCount",
  importantFlag: "__importantFlag",
} as const;

const NORMALIZED_FIELD_HEADERS = [
  "assetCode",
  "assetName",
  "assetDetail",
  "receivedDate",
  "value",
  "responsibleUnit",
  "location",
  "acquiredBy",
  "acquiredFrom",
  "budgetSource",
  "note",
  "statusNormal",
  "statusBroken",
  "statusDeteriorated",
  "statusLost",
  "statusStoredLong",
  "statusUnnecessary",
];

const ALL_KEYWORDS: string[] = getAllKeywords();
const REGISTER_HEADERS = [
  "seq",
  "itemName",
  "assetCode",
  "receivedDate",
  "value",
  "responsibleUnit",
  "statusNormal",
  "statusBroken",
  "statusDeteriorated",
  "statusLost",
  "statusStoredLong",
  "statusUnnecessary",
  "note",
];

interface GroupedAssetDebug {
  sourceRowIndex: number;
  excelRow: number;
  sourceAssetName: string;
  sourceAssetType: string;
  firstAssetCode?: string;
  firstSequence?: string;
}

function cellText(value: any): string {
  return value === undefined || value === null ? "" : value.toString().trim();
}

function compactText(value: any): string {
  return cellText(value).replace(/\s+/g, "");
}

function normalizeForScore(s: string): string {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\n/g, "")
    .replace(/\s+/g, "")
    .replace(/[()/.\-_,]/g, "");
}

function isRowEmpty(row: any[]): boolean {
  return row.every((cell) => !cellText(cell));
}

function rowText(row: any[]): string {
  return row.map(cellText).filter(Boolean).join(" ");
}

function rowContainsAny(row: any[], tokens: string[]): boolean {
  const text = rowText(row).replace(/\s+/g, "");
  return tokens.some((token) => text.includes(token));
}

function isTotalOrSummaryRow(row: any[]): boolean {
  const cells = row.map((cell) => compactText(cell)).filter(Boolean);
  return cells.some((cell) => cell === "รวม" || cell.includes("รวมทั้งสิ้น"));
}

function isNumericSequence(value: any): boolean {
  return /^\d+$/.test(compactText(value));
}

function looksLikeAssetCode(value: any): boolean {
  const text = compactText(value);
  if (!text || /^(รหัส|เลข|รวม)/.test(text)) return false;
  return /\d/.test(text) && /[-/]/.test(text);
}

function looksLikeAssetType(text: string): boolean {
  return (
    /(ครุภัณฑ์|อสังหาริมทรัพย์|สิ่งปลูกสร้าง|อาคาร|สินทรัพย์)/.test(text) &&
    !/\(\d+\)/.test(text)
  );
}

function looksLikeAssetItem(text: string): boolean {
  return /\(\d+\)/.test(text);
}

function hasStatusMark(value: any): boolean {
  const text = compactText(value).toLowerCase();
  if (!text || text === "-") return false;
  return true;
}

export function deriveStatus(
  statusNormal: any,
  statusBroken: any,
  statusDeteriorated: any,
  statusLost: any,
  statusStoredLong: any,
  statusUnnecessary: any,
  defaultStatus = "",
): string {
  if (hasStatusMark(statusNormal)) return "ปกติ";
  if (hasStatusMark(statusBroken)) return "ชำรุด";
  if (hasStatusMark(statusDeteriorated)) return "รอจำหน่าย";
  if (hasStatusMark(statusLost)) return "สูญหาย";
  if (hasStatusMark(statusStoredLong)) return "ไม่ได้ใช้งาน";
  if (hasStatusMark(statusUnnecessary)) return "รอจำหน่าย";
  return defaultStatus;
}

const THAI_MONTHS: Record<string, number> = {
  "ม.ค.": 1,
  "มค": 1,
  มกราคม: 1,
  "ก.พ.": 2,
  "กพ": 2,
  กุมภาพันธ์: 2,
  "มี.ค.": 3,
  "มีค": 3,
  มีนาคม: 3,
  "เม.ย.": 4,
  "เมย": 4,
  เมษายน: 4,
  "พ.ค.": 5,
  "พค": 5,
  พฤษภาคม: 5,
  "มิ.ย.": 6,
  "มิย": 6,
  มิถุนายน: 6,
  "ก.ค.": 7,
  "กค": 7,
  กรกฎาคม: 7,
  "ส.ค.": 8,
  "สค": 8,
  สิงหาคม: 8,
  "ก.ย.": 9,
  "กย": 9,
  กันยายน: 9,
  "ต.ค.": 10,
  "ตค": 10,
  ตุลาคม: 10,
  "พ.ย.": 11,
  "พย": 11,
  พฤศจิกายน: 11,
  "ธ.ค.": 12,
  "ธค": 12,
  ธันวาคม: 12,
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function normalizeMonth(value: any): number | null {
  const text = compactText(value);
  if (!text) return null;
  if (/^\d{1,2}$/.test(text)) {
    const month = Number(text);
    return month >= 1 && month <= 12 ? month : null;
  }
  const normalized = text.replace(/\s+/g, "").toLowerCase();
  return THAI_MONTHS[normalized] ?? THAI_MONTHS[normalized.replace(/\./g, "")] ?? null;
}

function normalizeYear(value: any): number | null {
  const text = compactText(value);
  if (!/^\d{2,4}$/.test(text)) return null;
  let year = Number(text);
  if (year < 100) year += 2500;
  if (year > 2400) year -= 543;
  if (year < 1800 || year > 2100) return null;
  return year;
}

function excelSerialToDate(value: number): string {
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + value * 86400000);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

function formatDate(day: number, month: number, year: number): string {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export function normalizeThaiDate(dayOrValue: any, monthValue?: any, yearValue?: any): string {
  if (dayOrValue instanceof Date) {
    return formatDate(dayOrValue.getDate(), dayOrValue.getMonth() + 1, dayOrValue.getFullYear());
  }

  if (monthValue !== undefined || yearValue !== undefined) {
    const day = Number(compactText(dayOrValue));
    const month = normalizeMonth(monthValue);
    const year = normalizeYear(yearValue);
    if (day >= 1 && day <= 31 && month && year) return formatDate(day, month, year);
    return "";
  }

  if (typeof dayOrValue === "number" && dayOrValue > 20000 && dayOrValue < 80000) {
    return excelSerialToDate(dayOrValue);
  }

  const text = cellText(dayOrValue);
  if (!text) return "";
  if (/^\d{5}$/.test(text)) return excelSerialToDate(Number(text));

  const numericDate = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (numericDate) {
    const day = Number(numericDate[1]);
    const month = Number(numericDate[2]);
    const year = normalizeYear(numericDate[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year) {
      return formatDate(day, month, year);
    }
    return "";
  }

  const yearFirstDate = text.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (yearFirstDate) {
    const year = normalizeYear(yearFirstDate[1]);
    const month = Number(yearFirstDate[2]);
    const day = Number(yearFirstDate[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year) {
      return formatDate(day, month, year);
    }
    return "";
  }

  const thaiTextDate = text.match(/(\d{1,2})[\s\-/]*([A-Za-zก-๙.]+)[\s\-/]*(\d{2,4})/);
  if (thaiTextDate) {
    const day = Number(thaiTextDate[1]);
    const month = normalizeMonth(thaiTextDate[2]);
    const year = normalizeYear(thaiTextDate[3]);
    if (day >= 1 && day <= 31 && month && year) return formatDate(day, month, year);
  }

  return "";
}

function normalizeCell(value: any): any {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return normalizeThaiDate(value);
  return value;
}

function buildHeaderKeys(rawHeaders: any[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((header, index) => {
    const baseKey = cellText(header) || `__EMPTY_COLUMN_${index + 1}`;
    const count = seen.get(baseKey) || 0;
    seen.set(baseKey, count + 1);
    return count === 0 ? baseKey : `${baseKey}__DUPLICATE_${count + 1}`;
  });
}

function buildRawRow(headers: string[], sourceRow: any[]): Record<string, any> {
  const row: Record<string, any> = {};
  headers.forEach((header, index) => {
    row[header] = normalizeCell(sourceRow[index]);
  });
  return row;
}

function withCommonMeta(
  row: Record<string, any>,
  profile: SourceProfile,
  sheetName: string,
  excelRow: number,
  sourceAssetType: string,
  sourceAssetItem: string,
  sourceAssetName: string,
): Record<string, any> {
  row[SOURCE_PROFILE_COLUMN] = profile;
  row[SOURCE_SHEET_NAME_COLUMN] = sheetName;
  row[SOURCE_EXCEL_ROW_COLUMN] = excelRow;
  row[SOURCE_ASSET_TYPE_COLUMN] = sourceAssetType;
  row[SOURCE_ASSET_ITEM_COLUMN] = sourceAssetItem;
  row[SOURCE_ASSET_NAME_COLUMN] = sourceAssetName;
  return row;
}

function setNormalizedFields(
  row: Record<string, any>,
  values: Partial<NormalizedSourceAssetRow> & {
    assetCode: string;
    assetName: string;
  },
): Record<string, any> {
  row.assetCode = values.assetCode || "";
  row.assetName = values.assetName || "";
  row.assetDetail = values.assetDetail || values.assetName || "";
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
  return row;
}

function appendNormalizedDetail(row: Record<string, any>, detail: string): void {
  row.assetDetail = [row.assetDetail, detail].map(cellText).filter(Boolean).join(" ");
  row[INTERNAL.detail] = row.assetDetail;
}

function appendNormalizedNote(row: Record<string, any>, note: string): void {
  row.note = [row.note, note].map(cellText).filter(Boolean).join(" ");
  row[INTERNAL.note] = row.note;
}

function appendHeaders(headers: string[]): string[] {
  const extras = [
    SOURCE_PROFILE_COLUMN,
    SOURCE_SHEET_NAME_COLUMN,
    SOURCE_EXCEL_ROW_COLUMN,
    SOURCE_ASSET_TYPE_COLUMN,
    SOURCE_ASSET_ITEM_COLUMN,
    SOURCE_ASSET_NAME_COLUMN,
    ...NORMALIZED_FIELD_HEADERS,
  ];
  return [...headers, ...extras.filter((header) => !headers.includes(header))];
}

function scoreRowAsHeader(row: any[]): number {
  let score = 0;
  for (const cell of row) {
    const text = normalizeForScore(cellText(cell));
    if (!text || text.length < 2) continue;
    if (
      text.length >= 4 &&
      ALL_KEYWORDS.some((kw) => kw.length >= 4 && (text.includes(kw) || kw.includes(text)))
    ) {
      score += 5;
    } else {
      score += 0.2;
    }
  }
  return score;
}

function detectHeaderRow(matrix: any[][]): number {
  const scanLimit = Math.min(matrix.length, 15);
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < scanLimit; i += 1) {
    const score = scoreRowAsHeader(matrix[i] || []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function isSheetEffectivelyEmpty(matrix: any[][]): boolean {
  const nonEmptyRows = matrix.filter((row) => !isRowEmpty(row));
  return nonEmptyRows.length < 2;
}

function findTransferHeaderRow(matrix: any[][]): number {
  return matrix.findIndex((row) => rowContainsAny(row, ["เลขที่หนังสือ"]) && rowContainsAny(row, ["รหัสครุภัณฑ์"]));
}

function detectSourceProfile(sheetName: string, matrix: any[][]): SourceProfile {
  const compactSheet = compactText(sheetName);
  if (compactSheet.includes("แบบกข")) return "SUMMARY_SKIP";
  if (compactSheet.includes("ครุภัณฑ์ใหม่2567")) return "NEW_ASSET_2567";
  if (compactSheet.includes("โอน2567") || compactSheet.includes("โอนอาคาร2567")) {
    return "TRANSFER_2567";
  }
  if (findTransferHeaderRow(matrix) >= 0) return "TRANSFER_2567";

  const firstRows = matrix.slice(0, 8);
  if (firstRows.some((row) => rowContainsAny(row, ["รหัสสินทรัพย์"]) && rowContainsAny(row, ["รายละเอียดสินทรัพย์"]))) {
    return "NEW_ASSET_2567";
  }
  if (firstRows.some((row) => rowContainsAny(row, ["รหัสครุภัณฑ์"]) && rowContainsAny(row, ["สภาพครุภัณฑ์"]))) {
    return "REGISTER_3_ROW_HEADER";
  }
  if (matrix.some((row) => looksLikeAssetCode(row[2]) && cellText(row[1]))) {
    return "REGISTER_3_ROW_HEADER";
  }
  return "UNKNOWN";
}

function parseNewAssetSheet(sheetName: string, matrix: any[][]): DataSourceSheet {
  const headerRowIndex = 0;
  const headers = appendHeaders(buildHeaderKeys(matrix[headerRowIndex] || []));
  const rows: Record<string, any>[] = [];
  const groupedAssets: GroupedAssetDebug[] = [];
  const warnings: string[] = [];
  let currentAssetType = "";
  let currentAssetItem = "";

  for (let index = headerRowIndex + 1; index < matrix.length; index += 1) {
    const sourceRow = matrix[index] || [];
    if (isRowEmpty(sourceRow) || isTotalOrSummaryRow(sourceRow)) continue;

    const sequence = cellText(sourceRow[0]);
    const assetCode = cellText(sourceRow[1]);
    const columnC = cellText(sourceRow[2]);
    const assetName = cellText(sourceRow[3]);

    if (!sequence && !assetCode && columnC) {
      if (looksLikeAssetType(columnC)) currentAssetType = columnC;
      else currentAssetItem = columnC;
      groupedAssets.push({
        sourceRowIndex: index,
        excelRow: index + 1,
        sourceAssetName: currentAssetItem || currentAssetType,
        sourceAssetType: currentAssetType,
      });
      continue;
    }

    if (!(isNumericSequence(sequence) && assetCode && assetName)) continue;

    const sourceAssetType = columnC || currentAssetType;
    const row = withCommonMeta(
      buildRawRow(headers, sourceRow),
      "NEW_ASSET_2567",
      sheetName,
      index + 1,
      sourceAssetType,
      currentAssetItem,
      assetName,
    );
    row[INTERNAL.seq] = sequence;
    setNormalizedFields(row, {
      assetCode,
      assetName,
      assetDetail: assetName,
      receivedDate: normalizeThaiDate(sourceRow[4], sourceRow[5], sourceRow[6]),
      value: sourceRow[7] ?? "",
      acquiredBy: sourceRow[8] ?? "",
      location: sourceRow[9] ?? "",
      responsibleUnit: sourceRow[10] ?? "",
      note: sourceRow[11] ?? "",
    });
    row[INTERNAL.status] = "ปกติ";
    row[INTERNAL.assetCategory] = "ครุภัณฑ์";
    row[INTERNAL.needCount] = "True";
    row[INTERNAL.importantFlag] = "False";
    row[INTERNAL.depreciationFlag] = sheetName.includes("ต่ำกว่าเกณฑ์") ? "False" : "True";
    rows.push(row);

    const currentGroup = groupedAssets[groupedAssets.length - 1];
    if (currentGroup && !currentGroup.firstAssetCode) {
      currentGroup.firstAssetCode = assetCode;
      currentGroup.firstSequence = sequence;
    }
  }

  if (!rows.length) warnings.push("ไม่พบแถวข้อมูลสินทรัพย์ในชีตครุภัณฑ์ใหม่");
  return {
    sheetName,
    sourceProfile: "NEW_ASSET_2567",
    headerRowIndex,
    headers,
    rows,
    rowCount: rows.length,
    groupedAssets,
    warnings,
  };
}

function parseRegisterSheet(sheetName: string, matrix: any[][]): DataSourceSheet {
  const headerRowIndex = Math.max(
    0,
    matrix.findIndex((row) => rowContainsAny(row, ["รหัสครุภัณฑ์"]) && rowContainsAny(row, ["สภาพครุภัณฑ์"])),
  );
  const headers = appendHeaders(REGISTER_HEADERS);
  const rows: Record<string, any>[] = [];
  const groupedAssets: GroupedAssetDebug[] = [];
  const warnings: string[] = [];
  let currentAssetType = "";
  let currentAssetItem = "";
  let previousDataRow: Record<string, any> | null = null;

  for (let index = headerRowIndex + 3; index < matrix.length; index += 1) {
    const sourceRow = matrix[index] || [];
    if (isRowEmpty(sourceRow) || isTotalOrSummaryRow(sourceRow)) continue;

    const sequence = cellText(sourceRow[0]);
    const itemName = cellText(sourceRow[1]);
    const assetCode = cellText(sourceRow[2]);
    const note = cellText(sourceRow[12]);

    if (!sequence && !assetCode && itemName) {
      if (looksLikeAssetType(itemName)) {
        currentAssetType = itemName;
        currentAssetItem = "";
        previousDataRow = null;
        groupedAssets.push({
          sourceRowIndex: index,
          excelRow: index + 1,
          sourceAssetName: currentAssetType,
          sourceAssetType: currentAssetType,
        });
        continue;
      }
      if (looksLikeAssetItem(itemName) || !previousDataRow) {
        currentAssetItem = itemName;
        previousDataRow = null;
        groupedAssets.push({
          sourceRowIndex: index,
          excelRow: index + 1,
          sourceAssetName: currentAssetItem,
          sourceAssetType: currentAssetType,
        });
        continue;
      }

      appendNormalizedDetail(previousDataRow, itemName);
      previousDataRow[SOURCE_ASSET_NAME_COLUMN] = previousDataRow[INTERNAL.assetName];
      if (note) {
        appendNormalizedNote(previousDataRow, note);
      }
      continue;
    }

    if (!sequence && !assetCode && !itemName && note && previousDataRow) {
      appendNormalizedNote(previousDataRow, note);
      continue;
    }

    const isDataRow = (isNumericSequence(sequence) || looksLikeAssetCode(assetCode)) && itemName;
    if (!isDataRow) continue;

    const row = withCommonMeta(
      buildRawRow(headers, sourceRow),
      "REGISTER_3_ROW_HEADER",
      sheetName,
      index + 1,
      currentAssetType,
      currentAssetItem,
      itemName,
    );
    row[INTERNAL.seq] = sequence;
    setNormalizedFields(row, {
      assetCode,
      assetName: itemName,
      assetDetail: itemName,
      receivedDate: normalizeThaiDate(sourceRow[3]),
      value: sourceRow[4] ?? "",
      responsibleUnit: sourceRow[5] ?? "",
      note: sourceRow[12] ?? "",
      statusNormal: sourceRow[6],
      statusBroken: sourceRow[7],
      statusDeteriorated: sourceRow[8],
      statusLost: sourceRow[9],
      statusStoredLong: sourceRow[10],
      statusUnnecessary: sourceRow[11],
    });
    row[INTERNAL.status] = deriveStatus(
      sourceRow[6],
      sourceRow[7],
      sourceRow[8],
      sourceRow[9],
      sourceRow[10],
      sourceRow[11],
      "",
    );
    row[INTERNAL.assetCategory] =
      currentAssetType.includes("อสังหาริมทรัพย์") ||
      sheetName === "อาคาร" ||
      sheetName === "สิ่งปลูกสร้าง"
        ? "อสังหาริมทรัพย์"
        : "ครุภัณฑ์";
    row[INTERNAL.needCount] = "True";
    row[INTERNAL.importantFlag] = "False";
    row[INTERNAL.depreciationFlag] =
      sheetName.includes("(ต)") || sheetName.includes("ต่ำกว่าเกณฑ์") ? "False" : "True";
    rows.push(row);
    previousDataRow = row;

    const currentGroup = groupedAssets[groupedAssets.length - 1];
    if (currentGroup && !currentGroup.firstAssetCode) {
      currentGroup.firstAssetCode = assetCode;
      currentGroup.firstSequence = sequence;
    }
  }

  if (!rows.length) warnings.push("ไม่พบแถวข้อมูลสินทรัพย์ในชีตทะเบียน");
  return {
    sheetName,
    sourceProfile: "REGISTER_3_ROW_HEADER",
    headerRowIndex,
    headers,
    rows,
    rowCount: rows.length,
    groupedAssets,
    warnings,
  };
}

function parseTransferSheet(sheetName: string, matrix: any[][]): DataSourceSheet {
  const detectedHeaderIndex = findTransferHeaderRow(matrix);
  const headerRowIndex = detectedHeaderIndex >= 0 ? detectedHeaderIndex : 3;
  const headers = appendHeaders(buildHeaderKeys(matrix[headerRowIndex] || []));
  const rows: Record<string, any>[] = [];
  const warnings: string[] = [];

  for (let index = headerRowIndex + 1; index < matrix.length; index += 1) {
    const sourceRow = matrix[index] || [];
    if (isRowEmpty(sourceRow) || isTotalOrSummaryRow(sourceRow)) continue;
    if (!looksLikeAssetCode(sourceRow[4])) continue;

    const assetType = cellText(sourceRow[3]);
    const sourceAssetType =
      assetType || (sheetName.includes("อาคาร") ? "อสังหาริมทรัพย์" : "ครุภัณฑ์");
    const assetName = cellText(sourceRow[2]);
    if (!assetName) continue;

    const row = withCommonMeta(
      buildRawRow(headers, sourceRow),
      "TRANSFER_2567",
      sheetName,
      index + 1,
      sourceAssetType,
      "",
      assetName,
    );
    row[INTERNAL.seq] = sourceRow[0] ?? "";
    setNormalizedFields(row, {
      assetCode: cellText(sourceRow[4]),
      assetName,
      assetDetail: assetName,
      receivedDate: normalizeThaiDate(sourceRow[5], sourceRow[6], sourceRow[7]),
      value: sourceRow[8] ?? "",
      responsibleUnit: sourceRow[9] ?? "",
      acquiredFrom: sourceRow[10] ?? "",
      budgetSource: sourceRow[11] ?? "",
    });
    row[INTERNAL.status] = "ปกติ";
    row[INTERNAL.assetCategory] = sourceAssetType.includes("อาคาร") || sourceAssetType.includes("อสังหาริมทรัพย์") ? "อสังหาริมทรัพย์" : "ครุภัณฑ์";
    row[INTERNAL.needCount] = "True";
    row[INTERNAL.importantFlag] = "False";
    row[INTERNAL.depreciationFlag] = "True";
    rows.push(row);
  }

  if (!rows.length) warnings.push("ไม่พบแถวข้อมูลรับโอน/โอนออกที่มีรหัสครุภัณฑ์");
  return {
    sheetName,
    sourceProfile: "TRANSFER_2567",
    headerRowIndex,
    headers,
    rows,
    rowCount: rows.length,
    groupedAssets: [],
    warnings,
  };
}

function parseUnknownSheet(
  sheetName: string,
  matrix: any[][],
  rowMeta: WorkbookRowMeta[] = [],
): DataSourceSheet {
  const headerRowIndex = detectHeaderRow(matrix);
  const headers = appendHeaders(buildHeaderKeys(matrix[headerRowIndex] || []));
  const rows = matrix
    .slice(headerRowIndex + 1)
    .map((sourceRow, index) => ({ sourceRow, index }))
    .filter(({ sourceRow }) => !isRowEmpty(sourceRow) && !isTotalOrSummaryRow(sourceRow))
    .map(({ sourceRow, index }) =>
      withCommonMeta(
        buildRawRow(headers, sourceRow),
        "UNKNOWN",
        sheetName,
        headerRowIndex + index + 2,
        "",
        "",
        "",
      ),
    );

  return {
    sheetName,
    sourceProfile: "UNKNOWN",
    headerRowIndex,
    headers,
    rows,
    rowCount: rows.length,
    groupedAssets: [],
    warnings: rowMeta.length ? [] : [],
  };
}

export function createDataSourceWorkbook(
  fileName: string,
  workbookSheets: { sheetName: string; matrix: any[][]; rowMeta?: WorkbookRowMeta[] }[],
): DataSourceWorkbook {
  const sheets: DataSourceSheet[] = [];
  const skippedSheets: string[] = [];

  for (const workbookSheet of workbookSheets) {
    const { sheetName, matrix } = workbookSheet;
    if (isSheetEffectivelyEmpty(matrix)) {
      skippedSheets.push(sheetName);
      continue;
    }

    const profile = detectSourceProfile(sheetName, matrix);
    if (profile === "SUMMARY_SKIP") {
      skippedSheets.push(sheetName);
      continue;
    }

    const sheet =
      profile === "NEW_ASSET_2567"
        ? parseNewAssetSheet(sheetName, matrix)
        : profile === "REGISTER_3_ROW_HEADER"
          ? parseRegisterSheet(sheetName, matrix)
          : profile === "TRANSFER_2567"
            ? parseTransferSheet(sheetName, matrix)
            : parseUnknownSheet(sheetName, matrix, workbookSheet.rowMeta);

    if (sheet.rows.length === 0) {
      skippedSheets.push(sheetName);
      continue;
    }
    sheets.push(sheet);
  }

  return { fileName, sheets, skippedSheets };
}

export function logDataSourceWorkbook(
  workbook: DataSourceWorkbook,
  rawSheets: { sheetName: string; matrix: any[][] }[] = [],
): void {
  console.log("[PARSE] workbook", {
    fileName: workbook.fileName,
    sheetCount: workbook.sheets.length,
    skippedSheets: workbook.skippedSheets,
  });

  for (const sheet of workbook.sheets) {
    const rawSheet = rawSheets.find((item) => item.sheetName === sheet.sheetName);
    console.log("[PARSE] sheet", {
      sheetName: sheet.sheetName,
      sourceProfile: sheet.sourceProfile,
      headerRow: sheet.headerRowIndex + 1,
      rowCount: sheet.rowCount,
      warnings: sheet.warnings,
    });
    console.log("[SOURCE] firstRows", {
      sheetName: sheet.sheetName,
      rows: rawSheet?.matrix.slice(0, 8) ?? [],
    });
    console.log("[DATASOURCE] normalizedRows", {
      sheetName: sheet.sheetName,
      rows: sheet.rows.slice(0, 3),
    });
  }
}
