import { normalizeThaiDate } from "../date";
import { appendHeaders, buildHeaderKeys, buildRawRow, setNormalizedFields, withCommonMeta } from "../row-builders";
import {
  assetNameFromGroup,
  cellText,
  isNumericSequence,
  isRowEmpty,
  isTotalOrSummaryRow,
  looksLikeAssetItemGroup,
  looksLikeAssetType,
} from "../text";
import { INTERNAL, type DataSourceSheet, type GroupedAssetDebug } from "../types";

export function parseNewAssetSheet(sheetName: string, matrix: any[][]): DataSourceSheet {
  const headerRowIndex = 0;
  const headers = appendHeaders(buildHeaderKeys(matrix[headerRowIndex] || []));
  const rows: Record<string, any>[] = [];
  const groupedAssets: GroupedAssetDebug[] = [];
  const warnings: string[] = [];
  let currentAssetType = "";
  let currentAssetTypeWasEmitted = false;
  let currentAssetItem = "";
  let currentAssetItemWasEmitted = false;

  for (let index = headerRowIndex + 1; index < matrix.length; index += 1) {
    const sourceRow = matrix[index] || [];
    if (isRowEmpty(sourceRow) || isTotalOrSummaryRow(sourceRow)) continue;

    const sequence = cellText(sourceRow[0]);
    const assetCode = cellText(sourceRow[1]);
    const columnC = cellText(sourceRow[2]);
    const assetDetail = cellText(sourceRow[3]);

    if (!sequence && !assetCode && columnC) {
      if (looksLikeAssetType(columnC)) {
        currentAssetType = columnC;
        currentAssetTypeWasEmitted = false;
        currentAssetItem = "";
        currentAssetItemWasEmitted = false;
      } else if (looksLikeAssetItemGroup(columnC)) {
        currentAssetItem = columnC;
        currentAssetItemWasEmitted = false;
      } else {
        continue;
      }
      groupedAssets.push({
        sourceRowIndex: index,
        excelRow: index + 1,
        sourceAssetName: currentAssetItem || currentAssetType,
        sourceAssetType: currentAssetType,
        sourceAssetTypeEmitOnce: Boolean(currentAssetType && !currentAssetTypeWasEmitted),
      });
      continue;
    }

    if (!(isNumericSequence(sequence) && assetCode && assetDetail)) continue;

    const usesCarriedAssetType = !columnC || looksLikeAssetItemGroup(columnC);
    const sourceAssetType = usesCarriedAssetType ? currentAssetType : columnC;
    const sourceAssetTypeEmitOnce = usesCarriedAssetType
      ? Boolean(sourceAssetType && !currentAssetTypeWasEmitted)
      : undefined;
    if (sourceAssetTypeEmitOnce) currentAssetTypeWasEmitted = true;
    const nextAssetItem = looksLikeAssetItemGroup(columnC) ? columnC : currentAssetItem;
    if (nextAssetItem && nextAssetItem !== currentAssetItem) {
      currentAssetItem = nextAssetItem;
      currentAssetItemWasEmitted = false;
    }
    const sourceAssetItem = currentAssetItem;
    const sourceAssetItemEmitOnce = Boolean(sourceAssetItem && !currentAssetItemWasEmitted);
    if (sourceAssetItemEmitOnce) {
      currentAssetItemWasEmitted = true;
    }
    const row = withCommonMeta(
      buildRawRow(headers, sourceRow),
      "NEW_ASSET_2567",
      sheetName,
      index + 1,
      sourceAssetType,
      sourceAssetTypeEmitOnce,
      sourceAssetItem,
      "",
      sourceAssetItemEmitOnce,
    );
    row[INTERNAL.seq] = sequence;
    setNormalizedFields(row, {
      assetCode,
      assetName: assetNameFromGroup(sourceAssetItem) || assetDetail,
      assetDetail,
      receivedDate: normalizeThaiDate(sourceRow[4], sourceRow[5], sourceRow[6]),
      value: sourceRow[7] ?? "",
      acquiredBy: sourceRow[8] ?? "",
      location: sourceRow[9] ?? "",
      responsibleUnit: sourceRow[10] ?? "",
      note: sourceRow[11] ?? "",
    });
    row[INTERNAL.status] = "ปกติ";
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
    eligibility: "needsReview",
    eligibilityReason: "pending validation",
    confidence: 0,
    groupedAssets,
    warnings,
  };
}
