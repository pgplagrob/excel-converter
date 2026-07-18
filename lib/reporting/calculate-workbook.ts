// Orchestrator: runs the pure lib/domain engines over a set of normalized
// assets, applying category mapping and row overrides first. This is the one
// place that wires normalize-asset.ts + category-mapping.ts + lib/domain
// together; it never mutates its inputs.

import type { DataSourceWorkbook } from "../datasource";
import { classifyReport } from "../domain/classify";
import { calculateDepreciation } from "../domain/depreciation";
import type { AssetGroup, NormalizedAsset, ReportingPolicy } from "../domain/types";
import type { UsefulLifeCategoryKey } from "../domain/useful-life";
import { mappingSuggestionsToRecord, suggestMapping } from "../mapping";
import {
  buildOverrideIndex,
  countCategoryOccurrences,
  resolveCategoryMapping,
} from "./category-mapping";
import { normalizeSheetRows } from "./normalize-asset";
import type {
  CalculatedRow,
  CalculatedWorkbookResult,
  CategoryMappingOverride,
  CategoryMappingResult,
  RowOverride,
} from "./types";
import { reconcileWorkbook } from "./reconcile";

function applyRowOverrides(asset: NormalizedAsset, overrides: RowOverride[]): {
  asset: NormalizedAsset;
  applied: RowOverride[];
} {
  const applicable = overrides.filter((override) => override.rowKey === asset.rowKey);
  if (!applicable.length) return { asset, applied: [] };

  // Never mutate the input — build a new object with overridden fields layered on top.
  const next: NormalizedAsset = { ...asset };
  for (const override of applicable) {
    switch (override.field) {
      case "assetGroup":
        next.assetGroup = override.overrideValue as AssetGroup;
        break;
      case "usefulLifeCategoryKey":
        next.usefulLifeCategoryKey = override.overrideValue as UsefulLifeCategoryKey;
        break;
      case "acquisitionDateISO":
        next.acquisitionDateISO = String(override.overrideValue);
        break;
      case "costSatang":
        next.costSatang = Number(override.overrideValue);
        break;
      default:
        break;
    }
  }
  return { asset: next, applied: applicable };
}

export interface CalculateWorkbookInput {
  normalizedAssets: NormalizedAsset[];
  policy: ReportingPolicy;
  categoryMappingOverrides: CategoryMappingOverride[];
  rowOverrides: RowOverride[];
}

export function calculateWorkbook(input: CalculateWorkbookInput): CalculatedWorkbookResult {
  const overrideIndex = buildOverrideIndex(input.categoryMappingOverrides);
  const occurrenceCounts = countCategoryOccurrences(
    input.normalizedAssets.map((asset) => (asset.raw?.sourceCategoryText as string) || ""),
  );

  const rows: CalculatedRow[] = [];
  const unresolvedByKey = new Map<string, CategoryMappingResult>();

  for (const baseAsset of input.normalizedAssets) {
    const sourceCategoryText = (baseAsset.raw?.sourceCategoryText as string) || "";
    const occurrences = occurrenceCounts.get(sourceCategoryText) || 1;
    const categoryMapping = resolveCategoryMapping(sourceCategoryText, overrideIndex, occurrences);

    const assetWithCategory: NormalizedAsset = {
      ...baseAsset,
      assetGroup: categoryMapping.assetGroup,
      usefulLifeCategoryKey: categoryMapping.usefulLifeCategoryKey,
    };
    const { asset, applied } = applyRowOverrides(assetWithCategory, input.rowOverrides);

    const classification = classifyReport(asset, input.policy);
    const depreciation = calculateDepreciation(asset, input.policy);

    rows.push({
      rowKey: asset.rowKey,
      sourceFile: asset.sourceFile,
      sourceSheet: asset.sourceSheet,
      sourceExcelRow: asset.sourceExcelRow,
      assetCode: asset.assetCode,
      assetName: asset.assetName,
      unit: asset.unit,
      sourceCategoryText,
      categoryMapping,
      normalized: asset,
      classification,
      depreciation,
      appliedOverrides: applied,
    });

    if (categoryMapping.status === "unresolved" && sourceCategoryText) {
      unresolvedByKey.set(categoryMapping.normalizedKey, categoryMapping);
    }
  }

  const reconciliation = reconcileWorkbook(rows);
  const blockingRowKeys = rows
    .filter(
      (row) =>
        row.classification.classification === "NEEDS_REVIEW" || row.depreciation.blockingIssues.length > 0,
    )
    .map((row) => row.rowKey);

  return {
    rows,
    reconciliation,
    blockingRowKeys,
    unresolvedCategoryValues: [...unresolvedByKey.values()].sort((a, b) => b.occurrences - a.occurrences),
  };
}

/**
 * Bridges the existing parser/datasource pipeline to calculateWorkbook(),
 * without modifying any parser. Only sheets already eligible for the
 * Template-50 pipeline (exportable / needsReview) are included — preserved,
 * skipped, and unsupported sheets carry no per-row asset data to calculate.
 */
export function calculateWorkbookFromDataSource(
  dataSource: DataSourceWorkbook,
  sourceFileName: string,
  policy: ReportingPolicy,
  categoryMappingOverrides: CategoryMappingOverride[],
  rowOverrides: RowOverride[],
): CalculatedWorkbookResult {
  const normalizedAssets: NormalizedAsset[] = [];
  for (const sheet of dataSource.sheets) {
    if (sheet.eligibility === "preserved" || sheet.eligibility === "skipped" || sheet.eligibility === "unsupported") {
      continue;
    }
    const mapping = mappingSuggestionsToRecord(suggestMapping(sheet.headers));
    normalizedAssets.push(...normalizeSheetRows(sheet.rows, { sourceFile: sourceFileName, mapping }));
  }
  return calculateWorkbook({ normalizedAssets, policy, categoryMappingOverrides, rowOverrides });
}

/**
 * Whether an "official" (non-draft) report may be generated. Per spec: any
 * NEEDS_REVIEW row, or an unresolved category mapping, blocks official
 * output. Reconciliation mismatches also block — a mismatched report would
 * misrepresent the organization's finances.
 */
export function evaluateExportGate(result: CalculatedWorkbookResult): { officialAllowed: boolean; blockingReasons: string[] } {
  const reasons: string[] = [];
  if (result.blockingRowKeys.length > 0) {
    reasons.push(`${result.blockingRowKeys.length} รายการยังเป็น NEEDS_REVIEW หรือมี blocking issue`);
  }
  if (result.unresolvedCategoryValues.length > 0) {
    reasons.push(`${result.unresolvedCategoryValues.length} ค่าประเภทสินทรัพย์ยังไม่ได้ mapping`);
  }
  if (!result.reconciliation.sorThor1MatchesSorThor2) {
    reasons.push("ยอด อปท.-สท. 1 ไม่ตรงกับผลรวม อปท.-สท. 2");
  }
  if (!result.reconciliation.controlTotalMatchesReportableScope) {
    reasons.push("control total (สท.2 + สท.3) ไม่ตรงกับรายการทั้งหมดใน reportable scope");
  }
  return { officialAllowed: reasons.length === 0, blockingReasons: reasons };
}
