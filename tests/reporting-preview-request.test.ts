import assert from "node:assert/strict";
import test from "node:test";
import { parsePreviewRequest } from "../lib/reporting/request-validation";
import { PolicyValidationError } from "../lib/reporting/policy-validation";
import { toPreviewRowDto } from "../lib/reporting/preview-dto";
import type { CalculatedRow } from "../lib/reporting/types";

const validPolicy = {
  fiscalYearBE: 2561,
  cutoffDateISO: "2018-09-30",
  usefulLifeSelectionPolicy: "minimum",
  residualBookValueSatang: 100,
  roundingMode: "half-up",
  roundingStage: "final-only",
  classificationVersion: "v1",
  depreciationRuleVersion: "v1",
};

test("parsePreviewRequest requires analysisId and a valid reportingPolicy", () => {
  const parsed = parsePreviewRequest({ analysisId: "abc", reportingPolicy: validPolicy });
  assert.equal(parsed.analysisId, "abc");
  assert.equal(parsed.policy.fiscalYearBE, 2561);
  assert.deepEqual(parsed.categoryMappings, []);
  assert.deepEqual(parsed.rowOverrides, []);
});

test("parsePreviewRequest validates pagination, classification, severity, search", () => {
  const parsed = parsePreviewRequest({
    analysisId: "abc",
    reportingPolicy: validPolicy,
    page: 2,
    pageSize: 25,
    classification: ["SOR_THOR_2", "NEEDS_REVIEW"],
    severity: ["needsReview"],
    search: "A001",
  });
  assert.equal(parsed.page, 2);
  assert.equal(parsed.pageSize, 25);
  assert.deepEqual(parsed.classification, ["SOR_THOR_2", "NEEDS_REVIEW"]);
  assert.deepEqual(parsed.severity, ["needsReview"]);
  assert.equal(parsed.search, "A001");
});

test("parsePreviewRequest rejects an out-of-range pageSize and unknown classification/severity", () => {
  assert.throws(() => parsePreviewRequest({ analysisId: "a", reportingPolicy: validPolicy, pageSize: 500 }), PolicyValidationError);
  assert.throws(() => parsePreviewRequest({ analysisId: "a", reportingPolicy: validPolicy, classification: ["MADE_UP"] }), PolicyValidationError);
  assert.throws(() => parsePreviewRequest({ analysisId: "a", reportingPolicy: validPolicy, severity: ["critical"] }), PolicyValidationError);
});

test("parsePreviewRequest requires reportingPolicy (no silent default)", () => {
  assert.throws(() => parsePreviewRequest({ analysisId: "a" }), PolicyValidationError);
});

test("toPreviewRowDto strips the bulky raw source snapshot but keeps source/normalized/calculated values", () => {
  const row: CalculatedRow = {
    rowKey: "r1",
    sourceFile: "f.xlsx",
    sourceSheet: "Sheet1",
    sourceExcelRow: 3,
    assetCode: "A001",
    assetName: "โต๊ะทำงาน",
    sourceCategoryText: "ครุภัณฑ์สำนักงาน",
    categoryMapping: { sourceValue: "ครุภัณฑ์สำนักงาน", normalizedKey: "ครุภัณฑ์สำนักงาน", status: "canonical", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_OFFICE", occurrences: 1 },
    normalized: {
      rowKey: "r1",
      sourceFile: "f.xlsx",
      sourceSheet: "Sheet1",
      sourceExcelRow: 3,
      assetCode: "A001",
      assetName: "โต๊ะทำงาน",
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2017-04-01",
      costSatang: 4_800_000,
      raw: { hugeOriginalRow: "should not appear in dto" },
    },
    classification: { rowKey: "r1", classification: "SOR_THOR_2", reasonCodes: ["IN_SCOPE_SOR_THOR_2"], explanation: "", evaluatedRules: [], missingFields: [], classificationVersion: "v1" },
    depreciation: { rowKey: "r1", shouldDepreciate: true, reasonCodes: ["IN_SCOPE_SOR_THOR_2"], explanation: "", calculationSteps: [], blockingIssues: [], depreciationRuleVersion: "v1" },
    appliedOverrides: [],
  };
  const dto = toPreviewRowDto(row);
  assert.equal(dto.assetCode, "A001");
  assert.equal(dto.source.categoryText, "ครุภัณฑ์สำนักงาน");
  assert.equal(dto.normalized.costSatang, 4_800_000);
  assert.equal((dto.normalized as any).raw, undefined);
  assert.equal(JSON.stringify(dto).includes("hugeOriginalRow"), false);
});
