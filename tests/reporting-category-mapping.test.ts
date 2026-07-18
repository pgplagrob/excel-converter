import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOverrideIndex,
  countCategoryOccurrences,
  resolveCategoryMapping,
} from "../lib/reporting/category-mapping";
import type { CategoryMappingOverride } from "../lib/reporting/types";

test("exact canonical mapping resolves group + useful-life key", () => {
  const result = resolveCategoryMapping("ครุภัณฑ์สำนักงาน", new Map());
  assert.equal(result.status, "canonical");
  assert.equal(result.assetGroup, "EQUIPMENT");
  assert.equal(result.usefulLifeCategoryKey, "EQUIP_OFFICE");
});

test("land resolves canonically with no useful-life key (non-depreciable)", () => {
  const result = resolveCategoryMapping("ที่ดิน", new Map());
  assert.equal(result.status, "canonical");
  assert.equal(result.assetGroup, "LAND");
  assert.equal(result.usefulLifeCategoryKey, undefined);
});

test("ambiguous group (e.g. สิ่งปลูกสร้าง, no useful-life table row) is unresolved, not guessed", () => {
  const result = resolveCategoryMapping("สิ่งปลูกสร้าง", new Map());
  assert.equal(result.status, "unresolved");
  assert.equal(result.assetGroup, "STRUCTURE"); // group known, but life key ambiguous
  assert.equal(result.usefulLifeCategoryKey, undefined);
});

test("unknown label with no canonical entry and no override is unresolved", () => {
  const result = resolveCategoryMapping("ของไม่ทราบประเภท", new Map());
  assert.equal(result.status, "unresolved");
  assert.equal(result.assetGroup, undefined);
});

test("fuzzy/partial text does NOT match (exact match only)", () => {
  const result = resolveCategoryMapping("ครุภัณฑ์สำนักงานชั้น 3", new Map());
  assert.equal(result.status, "unresolved");
});

test("a user-approved override resolves an otherwise-ambiguous value", () => {
  const overrides: CategoryMappingOverride[] = [
    { sourceValue: "สิ่งปลูกสร้าง", assetGroup: "STRUCTURE", usefulLifeCategoryKey: "STRUCTURE_CONCRETE_STEEL", approvedBy: "tester" },
  ];
  const result = resolveCategoryMapping("สิ่งปลูกสร้าง", buildOverrideIndex(overrides));
  assert.equal(result.status, "override");
  assert.equal(result.usefulLifeCategoryKey, "STRUCTURE_CONCRETE_STEEL");
});

test("override takes precedence over a canonical match (explicit user action wins)", () => {
  const overrides: CategoryMappingOverride[] = [
    { sourceValue: "ครุภัณฑ์สำนักงาน", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_COMPUTER", approvedBy: "tester" },
  ];
  const result = resolveCategoryMapping("ครุภัณฑ์สำนักงาน", buildOverrideIndex(overrides));
  assert.equal(result.status, "override");
  assert.equal(result.usefulLifeCategoryKey, "EQUIP_COMPUTER");
});

test("normalization trims and collapses whitespace but does not fuzz-match", () => {
  const result = resolveCategoryMapping("  ครุภัณฑ์สำนักงาน  ", new Map());
  assert.equal(result.status, "canonical");
  assert.equal(result.assetGroup, "EQUIPMENT");
});

test("countCategoryOccurrences groups and counts non-empty values", () => {
  const counts = countCategoryOccurrences(["A", "A", "", undefined, "B"]);
  assert.equal(counts.get("A"), 2);
  assert.equal(counts.get("B"), 1);
  assert.equal(counts.has(""), false);
});
