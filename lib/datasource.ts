import { getAllKeywords } from "./mapping";
import type { WorkbookRowMeta } from "./excel";

export interface DataSourceSheet {
  sheetName: string;
  headerRowIndex: number;
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
  groupedAssets: GroupedAssetDebug[];
}

export interface DataSourceWorkbook {
  fileName: string;
  sheets: DataSourceSheet[];
  skippedSheets: string[];
}

const ALL_KEYWORDS: string[] = getAllKeywords();
export const SOURCE_ASSET_NAME_COLUMN = "sourceAssetName";
export const SOURCE_ASSET_TYPE_COLUMN = "sourceAssetType";
const LIGHT_BLUE_FILL_COLORS = new Set(["DCE6F2", "D9EAF7", "DAEEF3", "B7DEE8"]);

interface GroupedAssetDebug {
  sourceRowIndex: number;
  excelRow: number;
  sourceAssetName: string;
  sourceAssetType: string;
  firstAssetCode?: string;
  firstSequence?: string;
}

interface GroupHeaderDetection {
  assetName?: string;
  assetType?: string;
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

function nonEmptyCells(row: any[]): { index: number; text: string }[] {
  return row
    .map((cell, index) => ({ index, text: cellText(cell) }))
    .filter((cell) => Boolean(cell.text));
}

function hasLightBlueFill(rowMeta?: WorkbookRowMeta): boolean {
  return Boolean(
    rowMeta?.fillColors?.some((color) => LIGHT_BLUE_FILL_COLORS.has(color.replace(/^FF/, ""))),
  );
}

function looksLikeAssetType(text: string): boolean {
  return /ครุภัณฑ์|สินทรัพย์|สิ่งปลูกสร้าง|อาคาร/.test(text) && !/\(\d+\)/.test(text);
}

function isNumericOnlyText(text: string): boolean {
  return /^[\d\s,.\-฿]+$/.test(text);
}

function isNormalDataRow(sourceRow: any[], sequenceIndex: number, assetCodeIndex: number): boolean {
  const sequence = sequenceIndex >= 0 ? cellText(sourceRow[sequenceIndex]) : "";
  const assetCode = assetCodeIndex >= 0 ? cellText(sourceRow[assetCodeIndex]) : "";
  return Boolean(sequence || assetCode);
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

export function detectGroupHeaderRow(
  sourceRow: any[],
  sequenceIndex: number,
  assetCodeIndex: number,
  rowMeta?: WorkbookRowMeta,
): GroupHeaderDetection | null {
  if (isRowEmpty(sourceRow) || isNormalDataRow(sourceRow, sequenceIndex, assetCodeIndex)) {
    return null;
  }

  const cells = nonEmptyCells(sourceRow);
  if (cells.length === 0) return null;

  const lightBlue = hasLightBlueFill(rowMeta);
  const sparseHeaderShape = cells.length <= 2;
  if (!lightBlue && !sparseHeaderShape) return null;

  const text = cells.map((cell) => cell.text).join(" ").trim();
  if (!text) return null;
  if (isNumericOnlyText(text)) return null;

  if (looksLikeAssetType(text)) {
    return { assetType: text };
  }

  return { assetName: text };
}

function buildRow(headers: string[], sourceRow: any[]): Record<string, any> {
  const row: Record<string, any> = {};
  headers.forEach((header, idx) => {
    row[header] = normalizeCell(sourceRow[idx]);
  });
  return row;
}

export function buildDatasourceRows(
  headers: string[],
  dataRows: any[][],
  headerRowIndex: number,
  rowMeta: WorkbookRowMeta[] = [],
): { rows: Record<string, any>[]; groupedAssets: GroupedAssetDebug[] } {
  return applyGroupHeaderCarryForward(headers, dataRows, headerRowIndex, rowMeta);
}

export function applyGroupHeaderCarryForward(
  headers: string[],
  dataRows: any[][],
  headerRowIndex: number,
  rowMeta: WorkbookRowMeta[] = [],
): { rows: Record<string, any>[]; groupedAssets: GroupedAssetDebug[] } {
  const sequenceIndex = findHeaderIndex(headers, ["ลำดับ", "ลำดับที่", "ที่"]);
  const assetCodeIndex = findHeaderIndex(headers, [
    "รหัสสินทรัพย์",
    "รหัสครุภัณฑ์",
    "รหัสพัสดุ",
    "เลขครุภัณฑ์",
  ]);

  let currentAssetName = "";
  let currentAssetType = "";
  const rows: Record<string, any>[] = [];
  const groupedAssets: GroupedAssetDebug[] = [];

  for (let index = 0; index < dataRows.length; index++) {
    const sourceRow = dataRows[index];
    if (isRowEmpty(sourceRow)) continue;

    const groupHeader = detectGroupHeaderRow(
      sourceRow,
      sequenceIndex,
      assetCodeIndex,
      rowMeta[headerRowIndex + index + 1],
    );
    if (groupHeader) {
      if (groupHeader.assetType) {
        currentAssetType = groupHeader.assetType;
        currentAssetName = "";
      }
      if (groupHeader.assetName) {
        currentAssetName = groupHeader.assetName;
      }
      groupedAssets.push({
        sourceRowIndex: index,
        excelRow: headerRowIndex + index + 2,
        sourceAssetName: currentAssetName || currentAssetType,
        sourceAssetType: currentAssetType,
      });
      console.log("[GROUP HEADER]", {
        excelRow: headerRowIndex + index + 2,
        currentAssetName,
        currentAssetType,
      });
      continue;
    }

    const row = buildRow(headers, sourceRow);
    const sequence = sequenceIndex >= 0 ? cellText(sourceRow[sequenceIndex]) : "";
    const assetCode = assetCodeIndex >= 0 ? cellText(sourceRow[assetCodeIndex]) : "";

    if (sequence || assetCode) {
      row[SOURCE_ASSET_NAME_COLUMN] = currentAssetName || currentAssetType;
      row[SOURCE_ASSET_TYPE_COLUMN] = currentAssetType;
      const currentGroup = groupedAssets[groupedAssets.length - 1];
      if (currentGroup && !currentGroup.firstAssetCode) {
        currentGroup.firstAssetCode = assetCode;
        currentGroup.firstSequence = sequence;
      }
    }

    console.log("[DATASOURCE ROW]", {
      excelRow: headerRowIndex + index + 2,
      sourceAssetName: row[SOURCE_ASSET_NAME_COLUMN],
      sourceAssetType: row[SOURCE_ASSET_TYPE_COLUMN],
    });
    rows.push(row);
  }

  return { rows, groupedAssets };
}

function hasAssetGroupHeaderRows(
  headers: string[],
  dataRows: any[][],
  headerRowIndex: number,
  rowMeta: WorkbookRowMeta[] = [],
): boolean {
  const sequenceIndex = findHeaderIndex(headers, ["ลำดับ", "ลำดับที่", "ที่"]);
  const assetCodeIndex = findHeaderIndex(headers, [
    "รหัสสินทรัพย์",
    "รหัสครุภัณฑ์",
    "รหัสพัสดุ",
    "เลขครุภัณฑ์",
  ]);

  if (sequenceIndex < 0 && assetCodeIndex < 0) return false;
  return dataRows.some((sourceRow, index) =>
    Boolean(detectGroupHeaderRow(sourceRow, sequenceIndex, assetCodeIndex, rowMeta[headerRowIndex + index + 1])),
  );
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

    const headerRowIndex = detectHeaderRow(matrix);
    const headers = buildHeaderKeys(matrix[headerRowIndex] || []);
    const dataRows = matrix.slice(headerRowIndex + 1);
    if (!headers.includes(SOURCE_ASSET_NAME_COLUMN) && hasAssetGroupHeaderRows(headers, dataRows, headerRowIndex, workbookSheet.rowMeta)) {
      headers.push(SOURCE_ASSET_NAME_COLUMN);
    }
    if (!headers.includes(SOURCE_ASSET_TYPE_COLUMN) && hasAssetGroupHeaderRows(headers, dataRows, headerRowIndex, workbookSheet.rowMeta)) {
      headers.push(SOURCE_ASSET_TYPE_COLUMN);
    }
    const { rows, groupedAssets } = buildDatasourceRows(
      headers,
      dataRows,
      headerRowIndex,
      workbookSheet.rowMeta,
    );

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
      groupedAssets,
    });
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
    console.log("[PARSE] detectedHeaderRow", {
      sheetName: sheet.sheetName,
      zeroBased: sheet.headerRowIndex,
      excelRow: sheet.headerRowIndex + 1,
    });
    console.log("[SOURCE] headers", {
      sheetName: sheet.sheetName,
      headers: sheet.headers,
    });
    console.log("[SOURCE] firstRows", {
      sheetName: sheet.sheetName,
      rows: rawSheet?.matrix.slice(0, 10) ?? [],
    });
    console.log("[DATASOURCE] normalizedRows", {
      sheetName: sheet.sheetName,
      rowCount: sheet.rowCount,
      rows: sheet.rows.slice(0, 10),
    });
    console.log("[DATASOURCE] groupedAssetResult", {
      sheetName: sheet.sheetName,
      groups: sheet.groupedAssets,
    });
  }
}
