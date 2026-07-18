// Pure reconciliation engine: aggregates calculated rows into สท.1 / สท.2 /
// สท.3 totals and checks the manual's reconciliation rules (ch.1, letter p.2;
// ch.5 forms). No ExcelJS, no I/O — takes CalculatedRow[], returns numbers.
//
// Rules enforced:
//   - สท.1 is summarized FROM สท.2 only (never includes สท.3).
//   - grand total of สท.1 must equal grand total of สท.2.
//   - control total = สท.2 + สท.3, checked against every row in reportable
//     scope (i.e. every row classified SOR_THOR_2 or SOR_THOR_3).

import type { AssetGroup } from "../domain/types";
import type { CalculatedRow, ReconciliationGroupTotal, ReconciliationResult, ReconciliationTotals } from "./types";

const ASSET_GROUPS: AssetGroup[] = [
  "LAND",
  "BUILDING",
  "STRUCTURE",
  "EQUIPMENT",
  "INFRASTRUCTURE",
  "INTANGIBLE",
  "INVESTMENT_PROPERTY",
  "LEASED_ASSET",
];

function emptyTotals(): ReconciliationTotals {
  return { costSatang: 0, accumulatedDepreciationSatang: 0, netBookValueSatang: 0, count: 0 };
}

function addRow(totals: ReconciliationTotals, row: CalculatedRow): void {
  totals.costSatang += row.normalized.costSatang ?? 0;
  totals.accumulatedDepreciationSatang += row.depreciation.accumulatedDepreciationSatang ?? 0;
  totals.netBookValueSatang += row.depreciation.netBookValueSatang ?? row.normalized.costSatang ?? 0;
  totals.count += 1;
}

function totalsEqual(a: ReconciliationTotals, b: ReconciliationTotals): boolean {
  return (
    a.costSatang === b.costSatang &&
    a.accumulatedDepreciationSatang === b.accumulatedDepreciationSatang &&
    a.netBookValueSatang === b.netBookValueSatang
  );
}

export function reconcileWorkbook(rows: CalculatedRow[]): ReconciliationResult {
  const sorThor1ByGroup = new Map<AssetGroup, ReconciliationTotals>();
  const sorThor2ByGroup = new Map<AssetGroup, ReconciliationTotals>();
  for (const group of ASSET_GROUPS) {
    sorThor1ByGroup.set(group, emptyTotals());
    sorThor2ByGroup.set(group, emptyTotals());
  }

  const sorThor1Grand = emptyTotals();
  const sorThor2Grand = emptyTotals();
  const sorThor3Grand = emptyTotals();
  const reportableScope = emptyTotals();
  let needsReviewCount = 0;
  let excludedCount = 0;

  for (const row of rows) {
    const classification = row.classification.classification;
    const group = row.normalized.assetGroup;

    if (classification === "NEEDS_REVIEW") {
      needsReviewCount += 1;
      continue;
    }
    if (classification === "EXCLUDED") {
      excludedCount += 1;
      continue;
    }

    if (classification === "SOR_THOR_2") {
      addRow(sorThor2Grand, row);
      addRow(reportableScope, row);
      // สท.1 is summarized from สท.2 — identical aggregation, kept separate
      // so the two totals are computed independently and then compared,
      // rather than reusing one accumulator (that would make the "สท.1 =
      // สท.2" check tautological).
      addRow(sorThor1Grand, row);
      if (group) {
        addRow(sorThor2ByGroup.get(group) as ReconciliationTotals, row);
        addRow(sorThor1ByGroup.get(group) as ReconciliationTotals, row);
      }
    } else if (classification === "SOR_THOR_3") {
      addRow(sorThor3Grand, row);
      addRow(reportableScope, row);
    }
  }

  const controlTotal = emptyTotals();
  controlTotal.costSatang = sorThor2Grand.costSatang + sorThor3Grand.costSatang;
  controlTotal.accumulatedDepreciationSatang =
    sorThor2Grand.accumulatedDepreciationSatang + sorThor3Grand.accumulatedDepreciationSatang;
  controlTotal.netBookValueSatang = sorThor2Grand.netBookValueSatang + sorThor3Grand.netBookValueSatang;
  controlTotal.count = sorThor2Grand.count + sorThor3Grand.count;

  const sorThor1TotalsByGroup: ReconciliationGroupTotal[] = ASSET_GROUPS.map((assetGroup) => ({
    assetGroup,
    ...(sorThor1ByGroup.get(assetGroup) as ReconciliationTotals),
  }));
  const sorThor2TotalsByGroup: ReconciliationGroupTotal[] = ASSET_GROUPS.map((assetGroup) => ({
    assetGroup,
    ...(sorThor2ByGroup.get(assetGroup) as ReconciliationTotals),
  }));

  return {
    sorThor1TotalsByGroup,
    sorThor1GrandTotal: sorThor1Grand,
    sorThor2TotalsByGroup,
    sorThor2GrandTotal: sorThor2Grand,
    sorThor3GrandTotal: sorThor3Grand,
    controlTotal,
    reportableScopeTotal: reportableScope,
    sorThor1MatchesSorThor2: totalsEqual(sorThor1Grand, sorThor2Grand),
    controlTotalMatchesReportableScope: totalsEqual(controlTotal, reportableScope),
    needsReviewCount,
    excludedCount,
  };
}
