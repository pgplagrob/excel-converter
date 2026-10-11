import { normalizeThaiDate } from "../date";
import { appendHeaders, buildHeaderKeys, buildRawRow, setNormalizedFields, withCommonMeta } from "../row-builders";
import { cellText, isRowEmpty, isTotalOrSummaryRow, looksLikeAssetCode, rowContainsAny } from "../text";
import { INTERNAL, type DataSourceSheet } from "../types";

export function findTransferHeaderRow(matrix: any[][]): number {
  return matrix.findIndex((row) => rowContainsAny(row, ["เลขที่หนังสือ"]) && rowContainsAny(row, ["รหัสครุภัณฑ์"]));
}

export function parseTransferSheet(sheetName: string, matrix: any[][]): DataSourceSheet {
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
    const sourceAssetType = assetType;
    const assetName = cellText(sourceRow[2]);
    if (!assetName) continue;

    const row = withCommonMeta(
      buildRawRow(headers, sourceRow),
      "TRANSFER_2567",
      sheetName,
      index + 1,
      sourceAssetType,
      undefined,
      "",
      assetName,
    );
    row[INTERNAL.seq] = sourceRow[0] ?? "";
    setNormalizedFields(row, {
      assetCode: cellText(sourceRow[4]),
      assetName,
      assetDetail: "",
      receivedDate: normalizeThaiDate(sourceRow[5], sourceRow[6], sourceRow[7]),
      value: sourceRow[8] ?? "",
      responsibleUnit: sourceRow[9] ?? "",
      acquiredFrom: sourceRow[10] ?? "",
      budgetSource: sourceRow[11] ?? "",
    });
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
    eligibility: "needsReview",
    eligibilityReason: "pending validation",
    confidence: 0,
    groupedAssets: [],
    warnings,
  };
}
