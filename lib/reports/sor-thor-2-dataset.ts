// Pure dataset builder for แบบ อปท.-สท. 2 (in-scope depreciable assets).
// Only rows classified SOR_THOR_2 contribute; every value here is a
// calculated/reported figure, never a raw guess.

import type { AssetGroup } from "../domain/types";
import { ASSET_GROUP_LABEL_TH, ASSET_GROUP_ORDER } from "./labels";
import type { CalculatedRow } from "../reporting/types";

export interface SorThor2Row {
  rowKey: string;
  assetGroup?: AssetGroup;
  assetGroupLabelTh: string;
  assetName: string;
  unit: string;
  assetCode: string;
  acquisitionDateISO: string;
  usefulLifeYears: number;
  costSatang: number;
  accumulatedDepreciationSatang: number;
}

export interface SorThor2Dataset {
  rows: SorThor2Row[];
  totals: {
    costSatang: number;
    accumulatedDepreciationSatang: number;
  };
}

export function buildSorThor2Dataset(calculatedRows: CalculatedRow[]): SorThor2Dataset {
  const groupOrderIndex = new Map(ASSET_GROUP_ORDER.map((group, index) => [group, index]));

  const rows: SorThor2Row[] = calculatedRows
    .filter((row) => row.classification.classification === "SOR_THOR_2")
    .map((row) => ({
      rowKey: row.rowKey,
      assetGroup: row.normalized.assetGroup,
      assetGroupLabelTh: row.normalized.assetGroup ? ASSET_GROUP_LABEL_TH[row.normalized.assetGroup] : "",
      assetName: row.assetName,
      unit: row.unit || "",
      assetCode: row.assetCode,
      acquisitionDateISO: row.normalized.acquisitionDateISO || "",
      usefulLifeYears: row.depreciation.usefulLifeYearsUsed ?? 0,
      costSatang: row.normalized.costSatang ?? 0,
      accumulatedDepreciationSatang: row.depreciation.accumulatedDepreciationSatang ?? 0,
    }))
    .sort((a, b) => {
      const orderA = a.assetGroup ? groupOrderIndex.get(a.assetGroup) ?? 99 : 99;
      const orderB = b.assetGroup ? groupOrderIndex.get(b.assetGroup) ?? 99 : 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.assetCode.localeCompare(b.assetCode, "th");
    });

  const totals = rows.reduce(
    (acc, row) => ({
      costSatang: acc.costSatang + row.costSatang,
      accumulatedDepreciationSatang: acc.accumulatedDepreciationSatang + row.accumulatedDepreciationSatang,
    }),
    { costSatang: 0, accumulatedDepreciationSatang: 0 },
  );

  return { rows, totals };
}
