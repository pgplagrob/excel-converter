// Shared fixtures for the domain (P0) unit tests. Not a test file itself
// (the runner only loads *.test.js), just importable helpers.

import { toSatang } from "../lib/domain/money";
import type { NormalizedAsset, ReportingPolicy } from "../lib/domain/types";
import type { UsefulLifeCategoryKey } from "../lib/domain/useful-life";

// Cutoff = 30 September 2561 BE = 2018-09-30 CE (matches the manual examples).
export function basePolicy(overrides: Partial<ReportingPolicy> = {}): ReportingPolicy {
  return {
    fiscalYearBE: 2561,
    cutoffDateISO: "2018-09-30",
    acquisitionDay15Rule: undefined,
    usefulLifeSelectionPolicy: "explicit-per-category",
    usefulLifeOverridesByCategory: {},
    residualBookValueSatang: 100, // 1 baht
    roundingMode: "half-up",
    roundingStage: "final-only",
    classificationVersion: "test-classify-v1",
    depreciationRuleVersion: "test-dep-v1",
    ...overrides,
  };
}

export function withUsefulLife(
  policy: ReportingPolicy,
  key: UsefulLifeCategoryKey,
  years: number,
  rangeMin: number,
  rangeMax: number,
): ReportingPolicy {
  return {
    ...policy,
    usefulLifeOverridesByCategory: {
      ...policy.usefulLifeOverridesByCategory,
      [key]: { years, rangeMin, rangeMax, source: "test" },
    },
  };
}

export function baseAsset(overrides: Partial<NormalizedAsset> = {}): NormalizedAsset {
  return {
    rowKey: "r1",
    sourceFile: "f.xlsx",
    sourceSheet: "s",
    sourceExcelRow: 2,
    assetCode: "A001",
    assetName: "สินทรัพย์ทดสอบ",
    ...overrides,
  };
}

/** Convenience: a baht amount as integer satang. */
export function baht(value: number): number {
  return toSatang(value);
}
