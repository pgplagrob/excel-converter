import assert from "node:assert/strict";
import test from "node:test";
import { groupWarnings, normalizePageSize, queryCalculatedRows } from "../lib/reporting/preview-query";
import type { CalculatedRow } from "../lib/reporting/types";

function row(overrides: Partial<CalculatedRow> = {}): CalculatedRow {
  return {
    rowKey: overrides.rowKey || `row-${Math.random()}`,
    sourceFile: "test.xlsx",
    sourceSheet: "Sheet1",
    sourceExcelRow: 2,
    assetCode: "A001",
    assetName: "โต๊ะทำงาน",
    categoryMapping: { sourceValue: "x", normalizedKey: "x", status: "canonical", occurrences: 1 },
    normalized: { rowKey: "r", sourceFile: "f", sourceSheet: "s", sourceExcelRow: 1, assetCode: "A001", assetName: "โต๊ะทำงาน" },
    classification: {
      rowKey: "r",
      classification: "SOR_THOR_2",
      reasonCodes: ["IN_SCOPE_SOR_THOR_2"],
      explanation: "",
      evaluatedRules: [],
      missingFields: [],
      classificationVersion: "v1",
    },
    depreciation: {
      rowKey: "r",
      shouldDepreciate: true,
      reasonCodes: ["IN_SCOPE_SOR_THOR_2"],
      explanation: "",
      calculationSteps: [],
      blockingIssues: [],
      depreciationRuleVersion: "v1",
    },
    appliedOverrides: [],
    ...overrides,
  };
}

test("normalizePageSize clamps to [1, 100] and defaults to 50", () => {
  assert.equal(normalizePageSize(undefined), 50);
  assert.equal(normalizePageSize(1000), 100);
  assert.equal(normalizePageSize(0), 1);
  assert.equal(normalizePageSize(-5), 1);
  assert.equal(normalizePageSize(75), 75);
});

test("pagination returns exactly one page's worth of rows, never the full set", () => {
  const rows = Array.from({ length: 15000 }, (_, i) => row({ rowKey: `r${i}`, assetCode: `A${i}` }));
  const result = queryCalculatedRows(rows, { page: 1, pageSize: 50 });
  assert.equal(result.rows.length, 50);
  assert.equal(result.total, 15000);
  assert.equal(result.totalPages, 300);
});

test("filter by classification", () => {
  const rows = [
    row({ rowKey: "r1", classification: { rowKey: "r1", classification: "SOR_THOR_2", reasonCodes: [], explanation: "", evaluatedRules: [], missingFields: [], classificationVersion: "v1" } }),
    row({ rowKey: "r2", classification: { rowKey: "r2", classification: "SOR_THOR_3", reasonCodes: [], explanation: "", evaluatedRules: [], missingFields: [], classificationVersion: "v1" } }),
  ];
  const result = queryCalculatedRows(rows, { classification: ["SOR_THOR_3"] });
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].rowKey, "r2");
});

test("filter by needsReview severity", () => {
  const rows = [
    row({ rowKey: "r1" }),
    row({
      rowKey: "r2",
      classification: { rowKey: "r2", classification: "NEEDS_REVIEW", reasonCodes: ["MISSING_COST"], explanation: "", evaluatedRules: [], missingFields: ["cost"], classificationVersion: "v1" },
    }),
  ];
  const result = queryCalculatedRows(rows, { severity: ["needsReview"] });
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].rowKey, "r2");
});

test("search matches assetCode or assetName, case-insensitive", () => {
  const rows = [row({ rowKey: "r1", assetCode: "A001", assetName: "โต๊ะทำงาน" }), row({ rowKey: "r2", assetCode: "B002", assetName: "เก้าอี้" })];
  assert.equal(queryCalculatedRows(rows, { search: "a001" }).total, 1);
  assert.equal(queryCalculatedRows(rows, { search: "เก้าอี้" }).total, 1);
  assert.equal(queryCalculatedRows(rows, { search: "zzz" }).total, 0);
});

test("groupWarnings aggregates reason codes with sample row keys", () => {
  const rows = [
    row({
      rowKey: "r1",
      classification: { rowKey: "r1", classification: "NEEDS_REVIEW", reasonCodes: ["MISSING_COST"], explanation: "", evaluatedRules: [], missingFields: [], classificationVersion: "v1" },
    }),
    row({
      rowKey: "r2",
      classification: { rowKey: "r2", classification: "NEEDS_REVIEW", reasonCodes: ["MISSING_COST"], explanation: "", evaluatedRules: [], missingFields: [], classificationVersion: "v1" },
    }),
  ];
  const groups = groupWarnings(rows);
  const missingCost = groups.find((g) => g.reasonCode === "MISSING_COST");
  assert.equal(missingCost?.count, 2);
  assert.deepEqual(missingCost?.sampleRowKeys, ["r1", "r2"]);
});
