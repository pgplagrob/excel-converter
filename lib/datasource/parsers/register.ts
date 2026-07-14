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
  for (let index = 3; index <= Math.min(sourceRow.length - 1, 8); index += 1) {
    const value = sourceRow[index];
    const text = cellText(value);
    if (normalizeThaiDate(value)) return index;
    if (/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}/.test(text)) {
      return index;
    }
  }
  return -1;
}

function composeRegisterAssetCode(sourceRow: any[], dateIndex: number): string {
  const fullCode = cellText(sourceRow[2]);
  if (looksLikeAssetCode(fullCode)) return fullCode;

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

function normalizeRegisterDate(value: any, assetCode: string): string {
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

  for (let index = headerRowIndex + 3; index < matrix.length; index += 1) {
    const sourceRow = matrix[index] || [];
    if (isRowEmpty(sourceRow) || isTotalOrSummaryRow(sourceRow)) continue;

    const sequence = cellText(sourceRow[0]);
    const itemName = cellText(sourceRow[1]);
    const detectedDateIndex = findRegisterDateIndex(sourceRow);
    const assetCode = composeRegisterAssetCode(sourceRow, detectedDateIndex);
    const dateIndex = detectedDateIndex >= 0 ? detectedDateIndex : 3;
    const statusStartIndex = dateIndex + 3;
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
    const isDataRow =
      looksLikeAssetCode(assetCode) &&
      Boolean(itemName) &&
      !looksLikeAssetType(itemName) &&
      !looksLikeAssetItemGroup(itemName);
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
      receivedDate: normalizeRegisterDate(sourceRow[dateIndex], assetCode),
      value: sourceRow[dateIndex + 1] ?? "",
      responsibleUnit: sourceRow[dateIndex + 2] ?? "",
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
