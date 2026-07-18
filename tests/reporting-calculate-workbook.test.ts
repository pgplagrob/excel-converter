import assert from "node:assert/strict";
import test from "node:test";
import { calculateWorkbook, evaluateExportGate } from "../lib/reporting/calculate-workbook";
import type { NormalizedAsset, ReportingPolicy } from "../lib/domain/types";
import type { CategoryMappingOverride, RowOverride } from "../lib/reporting/types";

function policy(overrides: Partial<ReportingPolicy> = {}): ReportingPolicy {
  return {
    fiscalYearBE: 2561,
    cutoffDateISO: "2018-09-30",
    acquisitionDay15Rule: undefined,
    usefulLifeSelectionPolicy: "explicit-per-category",
    usefulLifeOverridesByCategory: {
      EQUIP_OFFICE: { years: 8, rangeMin: 3, rangeMax: 12, source: "test" },
      EQUIP_SPORTS: { years: 5, rangeMin: 2, rangeMax: 5, source: "test" },
    },
    residualBookValueSatang: 100,
    roundingMode: "half-up",
    roundingStage: "final-only",
    classificationVersion: "v1",
    depreciationRuleVersion: "v1",
    ...overrides,
  };
}

function asset(overrides: Partial<NormalizedAsset> & { sourceCategoryText?: string } = {}): NormalizedAsset {
  const { sourceCategoryText, ...rest } = overrides;
  return {
    rowKey: overrides.rowKey || `row-${Math.random()}`,
    sourceFile: "test.xlsx",
    sourceSheet: "Sheet1",
    sourceExcelRow: 2,
    assetCode: "A001",
    assetName: "สินทรัพย์ทดสอบ",
    acquisitionDateISO: "2017-10-01",
    costSatang: 4_800_000,
    raw: { sourceCategoryText: sourceCategoryText ?? "ครุภัณฑ์สำนักงาน" },
    ...rest,
  };
}

test("exact category mapping resolves assetGroup/usefulLifeCategoryKey before classification", () => {
  const result = calculateWorkbook({
    normalizedAssets: [asset({ rowKey: "r1", sourceCategoryText: "ครุภัณฑ์สำนักงาน" })],
    policy: policy(),
    categoryMappingOverrides: [],
    rowOverrides: [],
  });
  assert.equal(result.rows[0].categoryMapping.status, "canonical");
  assert.equal(result.rows[0].normalized.assetGroup, "EQUIPMENT");
  assert.equal(result.rows[0].classification.classification, "SOR_THOR_2");
});

test("ambiguous/unresolved category mapping produces NEEDS_REVIEW, never a guess", () => {
  const result = calculateWorkbook({
    normalizedAssets: [asset({ rowKey: "r1", sourceCategoryText: "สิ่งปลูกสร้าง" })],
    policy: policy(),
    categoryMappingOverrides: [],
    rowOverrides: [],
  });
  assert.equal(result.rows[0].categoryMapping.status, "unresolved");
  assert.equal(result.rows[0].classification.classification, "NEEDS_REVIEW");
  assert.ok(result.blockingRowKeys.includes("r1"));
  assert.equal(result.unresolvedCategoryValues.length, 1);
  assert.equal(result.unresolvedCategoryValues[0].sourceValue, "สิ่งปลูกสร้าง");
});

test("missing useful-life policy for an in-scope category blocks (NEEDS_REVIEW)", () => {
  const result = calculateWorkbook({
    normalizedAssets: [asset({ rowKey: "r1", sourceCategoryText: "ครุภัณฑ์คอมพิวเตอร์" })],
    policy: policy({ usefulLifeOverridesByCategory: {} }), // no override for EQUIP_COMPUTER
    categoryMappingOverrides: [],
    rowOverrides: [],
  });
  assert.equal(result.rows[0].classification.classification, "NEEDS_REVIEW");
  assert.ok(result.blockingRowKeys.includes("r1"));
});

test("day-15 acquisition without a policy blocks; both policies unblock", () => {
  const day15Asset = asset({ rowKey: "r1", acquisitionDateISO: "2018-04-15" });

  const blocked = calculateWorkbook({
    normalizedAssets: [day15Asset],
    policy: policy(), // acquisitionDay15Rule undefined
    categoryMappingOverrides: [],
    rowOverrides: [],
  });
  assert.equal(blocked.rows[0].classification.classification, "NEEDS_REVIEW");
  assert.ok(blocked.rows[0].classification.reasonCodes.includes("DAY15_POLICY_REQUIRED"));

  const countMonth = calculateWorkbook({
    normalizedAssets: [day15Asset],
    policy: policy({ acquisitionDay15Rule: "count-month" }),
    categoryMappingOverrides: [],
    rowOverrides: [],
  });
  assert.equal(countMonth.rows[0].classification.classification, "SOR_THOR_2");

  const excludeMonth = calculateWorkbook({
    normalizedAssets: [day15Asset],
    policy: policy({ acquisitionDay15Rule: "exclude-month" }),
    categoryMappingOverrides: [],
    rowOverrides: [],
  });
  assert.equal(excludeMonth.rows[0].classification.classification, "SOR_THOR_2");
});

test("row override corrects a wrong category assignment without touching source, with provenance recorded", () => {
  const rowOverrides: RowOverride[] = [
    { rowKey: "r1", field: "assetGroup", overrideValue: "LAND", reason: "corrected by reviewer", timestamp: "2018-01-01T00:00:00Z" },
  ];
  const result = calculateWorkbook({
    normalizedAssets: [asset({ rowKey: "r1", sourceCategoryText: "ของไม่ทราบประเภท", costSatang: 5_000_000 })],
    policy: policy(),
    categoryMappingOverrides: [],
    rowOverrides,
  });
  assert.equal(result.rows[0].normalized.assetGroup, "LAND");
  assert.equal(result.rows[0].classification.classification, "SOR_THOR_2");
  assert.equal(result.rows[0].appliedOverrides.length, 1);
  assert.equal(result.rows[0].appliedOverrides[0].field, "assetGroup");
  // The raw source snapshot is untouched.
  assert.equal(result.rows[0].normalized.raw?.sourceCategoryText, "ของไม่ทราบประเภท");
});

test("category mapping override resolves an otherwise-unresolved value for every matching row", () => {
  const overrides: CategoryMappingOverride[] = [
    { sourceValue: "สิ่งปลูกสร้าง", assetGroup: "STRUCTURE", usefulLifeCategoryKey: "STRUCTURE_CONCRETE_STEEL", approvedBy: "tester" },
  ];
  const result = calculateWorkbook({
    normalizedAssets: [
      asset({ rowKey: "r1", sourceCategoryText: "สิ่งปลูกสร้าง" }),
      asset({ rowKey: "r2", sourceCategoryText: "สิ่งปลูกสร้าง" }),
    ],
    policy: policy({ usefulLifeOverridesByCategory: { STRUCTURE_CONCRETE_STEEL: { years: 20, rangeMin: 15, rangeMax: 25, source: "test" } } }),
    categoryMappingOverrides: overrides,
    rowOverrides: [],
  });
  assert.ok(result.rows.every((row) => row.categoryMapping.status === "override"));
  assert.ok(result.rows.every((row) => row.classification.classification === "SOR_THOR_2"));
});

test("reconciliation: สท.1 equals สท.2, สท.3 is excluded from สท.1", () => {
  const result = calculateWorkbook({
    normalizedAssets: [
      asset({ rowKey: "r1", sourceCategoryText: "ครุภัณฑ์สำนักงาน", costSatang: 4_800_000 }), // 48,000 baht -> สท.2
      asset({ rowKey: "r2", sourceCategoryText: "ครุภัณฑ์สำนักงาน", costSatang: 1_000_000, acquisitionDateISO: "2018-03-01" }), // exactly 10,000 baht -> สท.2
      asset({ rowKey: "r3", sourceCategoryText: "ครุภัณฑ์สำนักงาน", costSatang: 90_000 }), // 900 baht -> สท.3
    ],
    policy: policy(),
    categoryMappingOverrides: [],
    rowOverrides: [],
  });
  const recon = result.reconciliation;
  assert.equal(recon.sorThor1MatchesSorThor2, true);
  assert.equal(recon.sorThor1GrandTotal.costSatang, recon.sorThor2GrandTotal.costSatang);
  assert.equal(recon.sorThor3GrandTotal.count, 1);
  // สท.3's cost must not have leaked into สท.1's total.
  assert.notEqual(recon.sorThor1GrandTotal.costSatang, recon.sorThor2GrandTotal.costSatang + recon.sorThor3GrandTotal.costSatang);
});

test("control total = สท.2 + สท.3 for the full reportable scope", () => {
  const result = calculateWorkbook({
    normalizedAssets: [
      asset({ rowKey: "r1", sourceCategoryText: "ครุภัณฑ์สำนักงาน", costSatang: 4_800_000 }),
      asset({ rowKey: "r2", sourceCategoryText: "ครุภัณฑ์สำนักงาน", costSatang: 90_000 }),
    ],
    policy: policy(),
    categoryMappingOverrides: [],
    rowOverrides: [],
  });
  const recon = result.reconciliation;
  assert.equal(recon.controlTotalMatchesReportableScope, true);
  assert.equal(recon.controlTotal.count, recon.sorThor2GrandTotal.count + recon.sorThor3GrandTotal.count);
});

test("export gate blocks official export when there are NEEDS_REVIEW rows or unresolved categories", () => {
  const blockedByNeedsReview = calculateWorkbook({
    normalizedAssets: [asset({ rowKey: "r1", costSatang: undefined })],
    policy: policy(),
    categoryMappingOverrides: [],
    rowOverrides: [],
  });
  const gate1 = evaluateExportGate(blockedByNeedsReview);
  assert.equal(gate1.officialAllowed, false);
  assert.ok(gate1.blockingReasons.length > 0);

  const clean = calculateWorkbook({
    normalizedAssets: [asset({ rowKey: "r1", costSatang: 4_800_000 })],
    policy: policy(),
    categoryMappingOverrides: [],
    rowOverrides: [],
  });
  const gate2 = evaluateExportGate(clean);
  assert.equal(gate2.officialAllowed, true);
  assert.equal(gate2.blockingReasons.length, 0);
});
