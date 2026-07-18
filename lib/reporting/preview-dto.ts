// Serializes a CalculatedRow into the shape sent to the client for the
// calculated preview. Strips the bulky `raw` source-row snapshot (kept
// server-side only) so a page of 50-100 rows stays small, while still
// surfacing source / normalized / calculated values and full reason codes.

import type { CalculatedRow } from "./types";

export interface PreviewRowDto {
  rowKey: string;
  sourceFile: string;
  sourceSheet: string;
  sourceExcelRow: number;
  assetCode: string;
  assetName: string;
  unit?: string;
  source: {
    categoryText: string;
  };
  normalized: {
    assetGroup?: string;
    usefulLifeCategoryKey?: string;
    acquisitionDateISO?: string | null;
    costSatang?: number | null;
  };
  categoryMapping: CalculatedRow["categoryMapping"];
  classification: CalculatedRow["classification"];
  depreciation: CalculatedRow["depreciation"];
  appliedOverrides: CalculatedRow["appliedOverrides"];
}

export function toPreviewRowDto(row: CalculatedRow): PreviewRowDto {
  return {
    rowKey: row.rowKey,
    sourceFile: row.sourceFile,
    sourceSheet: row.sourceSheet,
    sourceExcelRow: row.sourceExcelRow,
    assetCode: row.assetCode,
    assetName: row.assetName,
    unit: row.unit,
    source: { categoryText: row.sourceCategoryText || "" },
    normalized: {
      assetGroup: row.normalized.assetGroup,
      usefulLifeCategoryKey: row.normalized.usefulLifeCategoryKey,
      acquisitionDateISO: row.normalized.acquisitionDateISO,
      costSatang: row.normalized.costSatang,
    },
    categoryMapping: row.categoryMapping,
    classification: row.classification,
    depreciation: row.depreciation,
    appliedOverrides: row.appliedOverrides,
  };
}
