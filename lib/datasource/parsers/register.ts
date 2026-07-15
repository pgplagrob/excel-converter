import { normalizeThaiDate } from "../date";
import {
  appendHeaders,
  appendNormalizedDetail,
  appendNormalizedNote,
  buildRawRow,
  setNormalizedFields,
  withCommonMeta,
} from "../row-builders";
import { deriveStatus } from "../status";
import {
  cellText,
  compactText,
  isNumericSequence,
  isRowEmpty,
  isTotalOrSummaryRow,
  looksLikeAssetCode,
  looksLikeAssetItemGroup,
  looksLikeAssetType,
  rowContainsAny,
} from "../text";
import {
  INTERNAL,
  REGISTER_HEADERS,
  SOURCE_ASSET_NAME_COLUMN,
  type DataSourceSheet,
  type GroupedAssetDebug,
} from "../types";

function findRegisterDateIndex(sourceRow: any[]): number {
  const hasFullAssetCode = looksLikeAssetCode(sourceRow[2]);

  if (hasFullAssetCode) {
    for (let index = 3; index <= Math.min(sourceRow.length - 3, 8); index += 1) {
      if (normalizeThaiDate(sourceRow[index], sourceRow[index + 1], sourceRow[index + 2])) {
        return index;
      }
    }
  }

  for (let index = 3; index <= Math.min(sourceRow.length - 1, 8); index += 1) {
    const value = sourceRow[index];
    const text = cellText(value);
    const isFiveDigitCodePart = /^\d{5}$/.test(compactText(value));
    if (!isFiveDigitCodePart && normalizeThaiDate(value)) return index;
    if (/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}/.test(text)) {
      return index;
    }
  }

  if (hasFullAssetCode) {
    for (let index = 3; index <= Math.min(sourceRow.length - 1, 8); index += 1) {
      if (normalizeThaiDate(sourceRow[index])) return index;
    }
  }
  return -1;
}

function registerDateSpan(sourceRow: any[], dateIndex: number): number {
  return normalizeThaiDate(
    sourceRow[dateIndex],
    sourceRow[dateIndex + 1],
    sourceRow[dateIndex + 2],
  )
    ? 3
    : 1;
}

function composeRegisterAssetCode(sourceRow: any[], dateIndex: number): string {
  const fullCode = cellText(sourceRow[2]);
  if (looksLikeAssetCode(fullCode)) return fullCode;
  if (!compactText(sourceRow[2])) return "";
  if (!isNumericSequence(sourceRow[0])) return "";

  const endIndex = dateIndex > 2 ? dateIndex : Math.min(sourceRow.length, 6);
  const parts = sourceRow
    .slice(2, endIndex)
    .map(compactText)
    .filter(Boolean);
  if (
    parts.length >= 3 &&
    parts.every((part) => /^\d{1,6}(?:\(ต\))?$/.test(part))
  ) {
    return parts.join("-");
  }
  return "";
}

function normalizeRegisterDate(sourceRow: any[], dateIndex: number, assetCode: string): string {
  const combined = normalizeThaiDate(
    sourceRow[dateIndex],
    sourceRow[dateIndex + 1],
    sourceRow[dateIndex + 2],
  );
  if (combined) return combined;

  const value = sourceRow[dateIndex];
  const normalized = normalizeThaiDate(value);
  if (normalized) return normalized;

  const text = cellText(value);
  const jsDate = text.match(
    /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4})/,
  );
  if (!jsDate) return "";

  const codeParts = assetCode.split("-");
  const codeYear = codeParts.length >= 2 ? codeParts[codeParts.length - 2].match(/\d{2}/)?.[0] : "";
  return normalizeThaiDate(jsDate[2], jsDate[1], codeYear || jsDate[3]);
}

function findRegisterDataStartIndex(matrix: any[][], headerRowIndex: number): number {
  const hasEarlyAssetRow = [1, 2].some((offset) => {
    const sourceRow = matrix[headerRowIndex + offset] || [];
    const dateIndex = findRegisterDateIndex(sourceRow);
    const assetCode = composeRegisterAssetCode(sourceRow, dateIndex);
    return Boolean(cellText(sourceRow[1])) && looksLikeAssetCode(assetCode);
  });

  return headerRowIndex + (hasEarlyAssetRow ? 1 : 3);
}

export function parseRegisterSheet(sheetName: string, matrix: any[][]): DataSourceSheet {
  const headerRowIndex = Math.max(
    0,
    matrix.findIndex((row) => rowContainsAny(row, ["รหัสครุภัณฑ์"]) && rowContainsAny(row, ["สภาพครุภัณฑ์"])),
  );
  const headers = appendHeaders(REGISTER_HEADERS);
  const rows: Record<string, any>[] = [];
  const groupedAssets: GroupedAssetDebug[] = [];
  const warnings: string[] = [];
  let currentAssetType = "";
  let currentAssetTypeWasEmitted = false;
  let currentAssetItem = "";
  let currentAssetItemWasEmitted = false;
  let previousDataRow: Record<string, any> | null = null;
  let skippedIncompleteRows = 0;
  const dataStartIndex = findRegisterDataStartIndex(matrix, headerRowIndex);

  for (let index = dataStartIndex; index < matrix.length; index += 1) {
    const sourceRow = matrix[index] || [];
    if (isRowEmpty(sourceRow) || isTotalOrSummaryRow(sourceRow)) continue;

    const sequence = cellText(sourceRow[0]);
    const itemName = cellText(sourceRow[1]);
    const detectedDateIndex = findRegisterDateIndex(sourceRow);
    const assetCode = composeRegisterAssetCode(sourceRow, detectedDateIndex);
    const dateIndex = detectedDateIndex >= 0 ? detectedDateIndex : 3;
    const dateSpan = registerDateSpan(sourceRow, dateIndex);
    const valueIndex = dateIndex + dateSpan;
    const responsibleUnitIndex = valueIndex + 1;
    const statusStartIndex = responsibleUnitIndex + 1;
    const noteIndex = statusStartIndex + 6;
    const note = cellText(sourceRow[noteIndex]);

    if (!sequence && !assetCode && itemName) {
      if (looksLikeAssetType(itemName)) {
        currentAssetType = itemName;
        currentAssetTypeWasEmitted = false;
        currentAssetItem = "";
        currentAssetItemWasEmitted = false;
        previousDataRow = null;
        groupedAssets.push({
          sourceRowIndex: index,
          excelRow: index + 1,
          sourceAssetName: currentAssetType,
          sourceAssetType: currentAssetType,
          sourceAssetTypeEmitOnce: Boolean(currentAssetType && !currentAssetTypeWasEmitted),
        });
        continue;
      }
      if (looksLikeAssetItemGroup(itemName)) {
        currentAssetItem = itemName;
        currentAssetItemWasEmitted = false;
        previousDataRow = null;
        groupedAssets.push({
          sourceRowIndex: index,
          excelRow: index + 1,
          sourceAssetName: currentAssetItem,
          sourceAssetType: currentAssetType,
          sourceAssetTypeEmitOnce: Boolean(currentAssetType && !currentAssetTypeWasEmitted),
        });
        continue;
      }

      if (previousDataRow) {
        appendNormalizedDetail(previousDataRow, itemName);
        previousDataRow[SOURCE_ASSET_NAME_COLUMN] = previousDataRow[INTERNAL.assetName];
        if (note) {
          appendNormalizedNote(previousDataRow, note);
        }
      }
      continue;
      
    }

    if (!sequence && !assetCode && !itemName && note && previousDataRow) {
      appendNormalizedNote(previousDataRow, note);
      continue;
    }

    const looksLikeIncompleteDataRow = isNumericSequence(sequence) && Boolean(itemName);
    // A valid row structure wins over words inside the asset name.  Names such as
    // "อาคารหอปูมละกอน" are assets when the row has a sequence and asset code;
    // category detection is only used by the no-sequence/no-code branch above.
    const isDataRow = looksLikeAssetCode(assetCode) && Boolean(itemName);
    if (!isDataRow && looksLikeIncompleteDataRow) {
      skippedIncompleteRows += 1;
    }
    if (!isDataRow) continue;
    const sourceAssetTypeEmitOnce = Boolean(currentAssetType && !currentAssetTypeWasEmitted);
    if (sourceAssetTypeEmitOnce) currentAssetTypeWasEmitted = true;
    const sourceAssetItemEmitOnce = Boolean(currentAssetItem && !currentAssetItemWasEmitted);
    if (sourceAssetItemEmitOnce) currentAssetItemWasEmitted = true;

    const row = withCommonMeta(
      buildRawRow(headers, sourceRow),
      "REGISTER_3_ROW_HEADER",
      sheetName,
      index + 1,
      currentAssetType,
      sourceAssetTypeEmitOnce,
      currentAssetItem,
      itemName,
      sourceAssetItemEmitOnce,
    );
    row[INTERNAL.seq] = sequence;
    setNormalizedFields(row, {
      assetCode,
      assetName: itemName,
      assetDetail: "",
      receivedDate: normalizeRegisterDate(sourceRow, dateIndex, assetCode),
      value: sourceRow[valueIndex] ?? "",
      responsibleUnit: sourceRow[responsibleUnitIndex] ?? "",
      note: sourceRow[noteIndex] ?? "",
      statusNormal: sourceRow[statusStartIndex],
      statusBroken: sourceRow[statusStartIndex + 1],
      statusDeteriorated: sourceRow[statusStartIndex + 2],
      statusLost: sourceRow[statusStartIndex + 3],
      statusStoredLong: sourceRow[statusStartIndex + 4],
      statusUnnecessary: sourceRow[statusStartIndex + 5],
    });
    row[INTERNAL.status] = deriveStatus(
      sourceRow[statusStartIndex],
      sourceRow[statusStartIndex + 1],
      sourceRow[statusStartIndex + 2],
      sourceRow[statusStartIndex + 3],
      sourceRow[statusStartIndex + 4],
      sourceRow[statusStartIndex + 5],
      "",
    );
    rows.push(row);
    previousDataRow = row;

    const currentGroup = groupedAssets[groupedAssets.length - 1];
    if (currentGroup && !currentGroup.firstAssetCode) {
      currentGroup.firstAssetCode = assetCode;
      currentGroup.firstSequence = sequence;
    }
  }

  if (skippedIncompleteRows) {
    warnings.push(
      `ข้าม ${skippedIncompleteRows} แถวที่มีลำดับ/ชื่อ แต่ไม่มีรหัสสินทรัพย์ที่สมบูรณ์`,
    );
  }
  if (!rows.length) warnings.push("ไม่พบแถวข้อมูลสินทรัพย์ในชีตทะเบียน");
  return {
    sheetName,
    sourceProfile: "REGISTER_3_ROW_HEADER",
    headerRowIndex,
    headers,
    rows,
    rowCount: rows.length,
    eligibility: "needsReview",
    eligibilityReason: "pending validation",
    confidence: 0,
    groupedAssets,
    warnings,
  };
}
