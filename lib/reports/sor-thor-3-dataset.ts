// Pure dataset builder for แบบ อปท.-สท. 3 (below-threshold / fully
// depreciated / pre-FY2560 equipment). Per the manual, this form has no
// useful-life, rate, or accumulated-depreciation columns — only identity and
// cost — and depreciation is never shown as actively accruing here.

import type { CalculatedRow } from "../reporting/types";

export interface SorThor3Row {
  rowKey: string;
  assetName: string;
  unit: string;
  assetCode: string;
  acquisitionDateISO: string;
  costSatang: number;
}

export interface SorThor3Dataset {
  rows: SorThor3Row[];
  totals: {
    costSatang: number;
  };
}

export function buildSorThor3Dataset(calculatedRows: CalculatedRow[]): SorThor3Dataset {
  const rows: SorThor3Row[] = calculatedRows
    .filter((row) => row.classification.classification === "SOR_THOR_3")
    .map((row) => ({
      rowKey: row.rowKey,
      assetName: row.assetName,
      unit: row.unit || "",
      assetCode: row.assetCode,
      acquisitionDateISO: row.normalized.acquisitionDateISO || "",
      costSatang: row.normalized.costSatang ?? 0,
    }))
    .sort((a, b) => a.assetCode.localeCompare(b.assetCode, "th"));

  const totals = rows.reduce((acc, row) => ({ costSatang: acc.costSatang + row.costSatang }), { costSatang: 0 });

  return { rows, totals };
}
