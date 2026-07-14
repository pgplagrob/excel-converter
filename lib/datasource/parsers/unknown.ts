import type { WorkbookRowMeta } from "../../excel";
import { detectHeaderRow } from "../header-detection";
import { appendHeaders, buildHeaderKeys, buildRawRow, withCommonMeta } from "../row-builders";
import { isRowEmpty, isTotalOrSummaryRow } from "../text";
import type { DataSourceSheet } from "../types";

export function parseUnknownSheet(
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
        undefined,
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
    eligibility: "needsReview",
    eligibilityReason: "unknown asset-like sheet requires manual mapping and validation",
    confidence: 0,
    groupedAssets: [],
    warnings: rowMeta.length ? [] : [],
  };
}
