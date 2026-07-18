// Pure dataset builder for แบบ อปท.-สท. 1 (summary by asset group).
// Sourced exclusively from the reconciliation result's สท.1 aggregation
// (which is itself built only from SOR_THOR_2 rows — สท.3 never contributes).

import type { AssetGroup } from "../domain/types";
import type { ReconciliationResult } from "../reporting/types";
import { ASSET_GROUP_LABEL_TH, ASSET_GROUP_ORDER } from "./labels";

export interface SorThor1Row {
  assetGroup: AssetGroup;
  labelTh: string;
  costSatang: number;
  accumulatedDepreciationSatang: number;
  netBookValueSatang: number;
}

export interface SorThor1Dataset {
  rows: SorThor1Row[]; // always all 8 groups, in manual order, zero-filled when empty
  grandTotal: {
    costSatang: number;
    accumulatedDepreciationSatang: number;
    netBookValueSatang: number;
  };
}

export function buildSorThor1Dataset(reconciliation: ReconciliationResult): SorThor1Dataset {
  const byGroup = new Map(reconciliation.sorThor1TotalsByGroup.map((entry) => [entry.assetGroup, entry]));
  const rows: SorThor1Row[] = ASSET_GROUP_ORDER.map((assetGroup) => {
    const totals = byGroup.get(assetGroup);
    return {
      assetGroup,
      labelTh: ASSET_GROUP_LABEL_TH[assetGroup],
      costSatang: totals?.costSatang ?? 0,
      accumulatedDepreciationSatang: totals?.accumulatedDepreciationSatang ?? 0,
      netBookValueSatang: totals?.netBookValueSatang ?? 0,
    };
  });

  return {
    rows,
    grandTotal: {
      costSatang: reconciliation.sorThor1GrandTotal.costSatang,
      accumulatedDepreciationSatang: reconciliation.sorThor1GrandTotal.accumulatedDepreciationSatang,
      netBookValueSatang: reconciliation.sorThor1GrandTotal.netBookValueSatang,
    },
  };
}
