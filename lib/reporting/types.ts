// Types for the reporting integration layer (P1). This layer bridges the
// existing parser/datasource pipeline to the pure lib/domain engines. Unlike
// lib/domain, these modules MAY depend on lib/datasource and lib/domain, but
// still never import React, Next.js route handlers, or ExcelJS.

import type {
  AssetGroup,
  ClassificationResult,
  DepreciationResult,
  NormalizedAsset,
  OrganizationMetadata,
  ReportingPolicy,
} from "../domain/types";
import type { UsefulLifeCategoryKey } from "../domain/useful-life";

export type { AssetGroup, NormalizedAsset, OrganizationMetadata, ReportingPolicy };

/** Output artifacts a user may request from a single export request. */
export type SelectedOutput = "TEMPLATE_50" | "SOR_THOR_1" | "SOR_THOR_2" | "SOR_THOR_3" | "AUDIT_ASSUMPTIONS";

export const ALL_SELECTED_OUTPUTS: SelectedOutput[] = [
  "TEMPLATE_50",
  "SOR_THOR_1",
  "SOR_THOR_2",
  "SOR_THOR_3",
  "AUDIT_ASSUMPTIONS",
];

/**
 * A user-approved mapping from a raw source category/type value to a
 * canonical AssetGroup + (usually) UsefulLifeCategoryKey. Recorded verbatim in
 * Audit/Assumptions. LAND entries omit usefulLifeCategoryKey (non-depreciable).
 */
export interface CategoryMappingOverride {
  sourceValue: string;
  assetGroup: AssetGroup;
  usefulLifeCategoryKey?: UsefulLifeCategoryKey;
  approvedBy?: string;
  note?: string;
}

export type CategoryMappingStatus = "canonical" | "override" | "unresolved";

export interface CategoryMappingResult {
  sourceValue: string;
  normalizedKey: string;
  status: CategoryMappingStatus;
  assetGroup?: AssetGroup;
  usefulLifeCategoryKey?: UsefulLifeCategoryKey;
  canonicalLabelTh?: string;
  occurrences: number;
}

/** A row-level correction that overrides a resolved field without touching source. */
export type RowOverrideField = "assetGroup" | "usefulLifeCategoryKey" | "acquisitionDateISO" | "costSatang";

export interface RowOverride {
  rowKey: string;
  field: RowOverrideField;
  overrideValue: string | number;
  reason?: string;
  timestamp: string; // ISO 8601, set by the server when the override is applied
}

/** The wire shape a client sends — no `timestamp` (the server stamps it). */
export type RowOverrideInput = Omit<RowOverride, "timestamp">;

/** Explicit user-approved fix for a Reference-column mismatch (not a blanket alias). */
export interface ReferenceOverride {
  templateColumn: string;
  sourceValue: string;
  canonicalValue: string;
  approvedBy?: string;
}

export interface CalculatedRow {
  rowKey: string;
  sourceFile: string;
  sourceSheet: string;
  sourceExcelRow: number;
  assetCode: string;
  assetName: string;
  unit?: string;
  sourceCategoryText?: string;
  categoryMapping: CategoryMappingResult;
  normalized: NormalizedAsset;
  classification: ClassificationResult;
  depreciation: DepreciationResult;
  appliedOverrides: RowOverride[];
}

export interface ReconciliationTotals {
  costSatang: number;
  accumulatedDepreciationSatang: number;
  netBookValueSatang: number;
  count: number;
}

export interface ReconciliationGroupTotal extends ReconciliationTotals {
  assetGroup: AssetGroup;
}

export interface ReconciliationResult {
  sorThor1TotalsByGroup: ReconciliationGroupTotal[];
  sorThor1GrandTotal: ReconciliationTotals;
  sorThor2TotalsByGroup: ReconciliationGroupTotal[];
  sorThor2GrandTotal: ReconciliationTotals;
  sorThor3GrandTotal: ReconciliationTotals;
  controlTotal: ReconciliationTotals; // สท.2 + สท.3 for the reportable scope
  reportableScopeTotal: ReconciliationTotals; // all rows classified SOR_THOR_2 or SOR_THOR_3
  sorThor1MatchesSorThor2: boolean;
  controlTotalMatchesReportableScope: boolean;
  needsReviewCount: number;
  excludedCount: number;
}

export interface CalculatedWorkbookResult {
  rows: CalculatedRow[];
  reconciliation: ReconciliationResult;
  blockingRowKeys: string[]; // rows whose classification/depreciation is NEEDS_REVIEW
  unresolvedCategoryValues: CategoryMappingResult[]; // status !== "canonical"|"override", grouped
}

/** Whether an export is allowed to be produced as an "official" report. */
export interface ExportGateResult {
  officialAllowed: boolean;
  blockingReasons: string[];
}
