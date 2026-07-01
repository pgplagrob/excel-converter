import { getAllKeywords } from "./mapping";

export interface DataSourceSheet {
  sheetName: string;
  headerRowIndex: number;
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
}

export interface DataSourceWorkbook {
  fileName: string;
  sheets: DataSourceSheet[];
  skippedSheets: string[];
}

const ALL_KEYWORDS: string[] = getAllKeywords();
const ASSET_GROUP_NAME_COLUMN = "ชื่อสินทรัพย์";

function normalizeForScore(s: string): string {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\n/g, "")
    .replace(/\s+/g, "")
    .replace(/[()/.\-_,]/g, "");
}

function scoreRowAsHeader(row: any[]): number {
  let score = 0;
  for (const cell of row) {
    if (cell === null || cell === undefined || cell === "") continue;
    const text = normalizeForScore(cell.toString());
    if (!text || text.length < 2) continue;

    const isKeyword =
      text.length >= 4 &&
      ALL_KEYWORDS.some(
        (kw) => kw.length >= 4 && (text.includes(kw) || kw.includes(text)),
      );

    if (isKeyword) {
      score += 5;
    } else if (typeof cell === "string" && text.length >= 2) {
      score += 0.2;
    }
  }
  return score;
}

function detectHeaderRow(matrix: any[][]): number {
  const scanLimit = Math.min(matrix.length, 15);
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < scanLimit; i++) {
    const score = scoreRowAsHeader(matrix[i] || []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function isSheetEffectivelyEmpty(matrix: any[][]): boolean {
  const nonEmptyRows = matrix.filter((row) =>
    row.some((cell) => cell !== null && cell !== undefined && cell.toString().trim() !== ""),
  );
  return nonEmptyRows.length < 2;
}

function isRowEmpty(row: any[]): boolean {
  return row.every(
    (cell) => cell === null || cell === undefined || cell.toString().trim() === "",
  );
}

function cellText(value: any): string {
  return value === undefined || value === null ? "" : value.toString().trim();
}

function normalizeCell(value: any): any {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}`;
  }
  return value;
}

function buildHeaderKeys(rawHeaders: any[]): string[] {
  const seen = new Map<string, number>();

  return rawHeaders.map((header, idx) => {
    const sourceHeader = header === null || header === undefined ? "" : header.toString();
    const baseKey = sourceHeader || `__EMPTY_COLUMN_${idx + 1}`;
    const count = seen.get(baseKey) || 0;
    seen.set(baseKey, count + 1);
    return count === 0 ? baseKey : `${baseKey}__DUPLICATE_${count + 1}`;
  });
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const normalizedCandidates = new Set(candidates.map(normalizeForScore));
  return headers.findIndex((header) => normalizedCandidates.has(normalizeForScore(header)));
}

function isAssetGroupHeaderRow(
  sourceRow: any[],
  sequenceIndex: number,
  assetCodeIndex: number,
  assetTypeIndex: number,
): boolean {
  if (assetTypeIndex < 0) return false;

  const assetGroupName = cellText(sourceRow[assetTypeIndex]);
  if (!assetGroupName) return false;

  const sequence = sequenceIndex >= 0 ? cellText(sourceRow[sequenceIndex]) : "";
  const assetCode = assetCodeIndex >= 0 ? cellText(sourceRow[assetCodeIndex]) : "";
  return !sequence && !assetCode;
}

function buildRow(headers: string[], sourceRow: any[]): Record<string, any> {
  const row: Record<string, any> = {};
  headers.forEach((header, idx) => {
    row[header] = normalizeCell(sourceRow[idx]);
  });
  return row;
}

function applyAssetGroupNames(headers: string[], dataRows: any[][]): Record<string, any>[] {
  const sequenceIndex = findHeaderIndex(headers, ["ลำดับ", "ลำดับที่"]);
  const assetCodeIndex = findHeaderIndex(headers, [
    "รหัสสินทรัพย์",
    "รหัสครุภัณฑ์",
    "รหัสพัสดุ",
    "เลขครุภัณฑ์",
  ]);
  const assetTypeIndex = findHeaderIndex(headers, [
    "*ชนิดสินทรัพย์",
    "ชนิดสินทรัพย์",
    "หมวดสินทรัพย์",
    "หมวดครุภัณฑ์",
  ]);

  const hasAssetGroupColumns = sequenceIndex >= 0 && assetCodeIndex >= 0 && assetTypeIndex >= 0;
  let currentAssetName = "";
  const rows: Record<string, any>[] = [];

  for (const sourceRow of dataRows) {
    if (isRowEmpty(sourceRow)) continue;

    if (hasAssetGroupColumns && isAssetGroupHeaderRow(sourceRow, sequenceIndex, assetCodeIndex, assetTypeIndex)) {
      currentAssetName = cellText(sourceRow[assetTypeIndex]);
      continue;
    }

    const row = buildRow(headers, sourceRow);
    const sequence = sequenceIndex >= 0 ? cellText(sourceRow[sequenceIndex]) : "";
    const assetCode = assetCodeIndex >= 0 ? cellText(sourceRow[assetCodeIndex]) : "";

    if (currentAssetName && sequence && assetCode && !cellText(row[ASSET_GROUP_NAME_COLUMN])) {
      row[ASSET_GROUP_NAME_COLUMN] = currentAssetName;
    }

    rows.push(row);
  }

  return rows;
}

function hasAssetGroupHeaderRows(headers: string[], dataRows: any[][]): boolean {
  const sequenceIndex = findHeaderIndex(headers, ["ลำดับ", "ลำดับที่"]);
  const assetCodeIndex = findHeaderIndex(headers, [
    "รหัสสินทรัพย์",
    "รหัสครุภัณฑ์",
    "รหัสพัสดุ",
    "เลขครุภัณฑ์",
  ]);
  const assetTypeIndex = findHeaderIndex(headers, [
    "*ชนิดสินทรัพย์",
    "ชนิดสินทรัพย์",
    "หมวดสินทรัพย์",
    "หมวดครุภัณฑ์",
  ]);

  if (sequenceIndex < 0 || assetCodeIndex < 0 || assetTypeIndex < 0) return false;
  return dataRows.some((sourceRow) =>
    isAssetGroupHeaderRow(sourceRow, sequenceIndex, assetCodeIndex, assetTypeIndex),
  );
}

export function createDataSourceWorkbook(
  fileName: string,
  workbookSheets: { sheetName: string; matrix: any[][] }[],
): DataSourceWorkbook {
  const sheets: DataSourceSheet[] = [];
  const skippedSheets: string[] = [];

  for (const workbookSheet of workbookSheets) {
    const { sheetName, matrix } = workbookSheet;

    if (isSheetEffectivelyEmpty(matrix)) {
      skippedSheets.push(sheetName);
      continue;
    }

    const headerRowIndex = detectHeaderRow(matrix);
    const headers = buildHeaderKeys(matrix[headerRowIndex] || []);
    const dataRows = matrix.slice(headerRowIndex + 1);
    if (!headers.includes(ASSET_GROUP_NAME_COLUMN) && hasAssetGroupHeaderRows(headers, dataRows)) {
      headers.push(ASSET_GROUP_NAME_COLUMN);
    }
    const rows = applyAssetGroupNames(headers, dataRows);

    if (rows.length === 0) {
      skippedSheets.push(sheetName);
      continue;
    }

    sheets.push({
      sheetName,
      headerRowIndex,
      headers,
      rows,
      rowCount: rows.length,
    });
  }

  return { fileName, sheets, skippedSheets };
}

export function logDataSourceWorkbook(workbook: DataSourceWorkbook): void {
  console.log("[DataSource] workbook", {
    fileName: workbook.fileName,
    sheetCount: workbook.sheets.length,
    skippedSheets: workbook.skippedSheets,
  });

  for (const sheet of workbook.sheets) {
    console.log("[DataSource] sheet", {
      sheetName: sheet.sheetName,
      headerRowIndex: sheet.headerRowIndex,
      headers: sheet.headers,
      rowCount: sheet.rowCount,
      sampleRows: sheet.rows.slice(0, 5),
    });
  }
}
