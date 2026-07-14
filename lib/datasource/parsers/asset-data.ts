import { normalizeThaiDate } from "../date";
import { detectHeaderRow } from "../header-detection";
import { appendHeaders, buildHeaderKeys, buildRawRow, setNormalizedFields, withCommonMeta } from "../row-builders";
import {
  cellText,
  deriveAssetCategoryFromText,
  findColumnIndex,
  findHeaderRowByTokens,
  isRowEmpty,
  isTotalOrSummaryRow,
  valueAt,
} from "../text";
import { INTERNAL, type DataSourceSheet } from "../types";

export function parseAssetDataSheet(sheetName: string, matrix: any[][]): DataSourceSheet {
  const detectedHeaderIndex = findHeaderRowByTokens(matrix, ["AssetCode", "ModelName"]);
  const headerRowIndex = detectedHeaderIndex >= 0 ? detectedHeaderIndex : detectHeaderRow(matrix);
  const rawHeaders = buildHeaderKeys(matrix[headerRowIndex] || []);
  const headers = appendHeaders(rawHeaders);
  const rows: Record<string, any>[] = [];
  const warnings: string[] = [];

  const assetCodeIndex = findColumnIndex(rawHeaders, ["AssetCode"]);
  const modelNameIndex = findColumnIndex(rawHeaders, ["ModelName"]);
  const assetTypeIndex = findColumnIndex(rawHeaders, ["AssetTypeName"]);
  const purchaseDateIndex = findColumnIndex(rawHeaders, ["PurchaseDate"]);
  const purchasePriceIndex = findColumnIndex(rawHeaders, ["PurchasePrice"]);
  const priceIndex = findColumnIndex(rawHeaders, ["Price"]);
  const locationIndex = findColumnIndex(rawHeaders, ["LocationName"]);
  const statusIndex = findColumnIndex(rawHeaders, ["StatusName", "Status"]);

  if (purchasePriceIndex >= 0 && priceIndex >= 0) {
    warnings.push("ใช้ PurchasePrice เป็นมูลค่าหลัก และใช้ Price เฉพาะกรณี PurchasePrice ว่าง");
  }

  for (let index = headerRowIndex + 1; index < matrix.length; index += 1) {
    const sourceRow = matrix[index] || [];
    if (isRowEmpty(sourceRow) || isTotalOrSummaryRow(sourceRow)) continue;

    const assetCode = cellText(valueAt(sourceRow, assetCodeIndex));
    const assetName = cellText(valueAt(sourceRow, modelNameIndex));
    if (!assetCode && !assetName) continue;

    const purchasePrice = valueAt(sourceRow, purchasePriceIndex);
    const fallbackPrice = valueAt(sourceRow, priceIndex);
    const value = cellText(purchasePrice) && cellText(purchasePrice) !== "0" ? purchasePrice : fallbackPrice;
    const sourceAssetType = cellText(valueAt(sourceRow, assetTypeIndex));

    const row = withCommonMeta(
      buildRawRow(headers, sourceRow),
      "ASSET_DATA",
      sheetName,
      index + 1,
      sourceAssetType,
      Boolean(sourceAssetType),
      "",
      assetName,
    );
    setNormalizedFields(row, {
      assetCode,
      assetName,
      assetDetail: "",
      receivedDate: normalizeThaiDate(valueAt(sourceRow, purchaseDateIndex)),
      value,
      location: valueAt(sourceRow, locationIndex),
    });
    row[INTERNAL.status] = cellText(valueAt(sourceRow, statusIndex)) || "ปกติ";
    row[INTERNAL.assetCategory] = deriveAssetCategoryFromText(sourceAssetType);
    row[INTERNAL.needCount] = "True";
    row[INTERNAL.importantFlag] = "False";
    row[INTERNAL.depreciationFlag] = "True";
    rows.push(row);
  }

  if (!rows.length) warnings.push("ไม่พบแถว AssetData ที่มี AssetCode หรือ ModelName");
  return {
    sheetName,
    sourceProfile: "ASSET_DATA",
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
