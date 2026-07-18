import assert from "node:assert/strict";
import test from "node:test";
import { classifyReport } from "../lib/domain/classify";
import type { AssetGroup } from "../lib/domain/types";
import { USEFUL_LIFE_TABLE, type UsefulLifeCategoryKey } from "../lib/domain/useful-life";
import { baht, baseAsset, basePolicy, withUsefulLife } from "./domain-fixtures";

// A policy that can classify an in-scope equipment item (has a useful life).
const officePolicy = withUsefulLife(basePolicy(), "EQUIP_OFFICE", 8, 3, 12);

function equipment(overrides = {}) {
  return baseAsset({
    assetGroup: "EQUIPMENT",
    usefulLifeCategoryKey: "EQUIP_OFFICE",
    acquisitionDateISO: "2017-10-01", // FY2561, well within life
    ...overrides,
  });
}

test("threshold: below / equal / above 10,000 baht", () => {
  assert.equal(classifyReport(equipment({ costSatang: baht(9999) }), officePolicy).classification, "SOR_THOR_3");
  assert.equal(classifyReport(equipment({ costSatang: baht(10000) }), officePolicy).classification, "SOR_THOR_2");
  assert.equal(classifyReport(equipment({ costSatang: baht(10001) }), officePolicy).classification, "SOR_THOR_2");
});

test("equal to 10,000 counts as 'from 10,000 up'", () => {
  const result = classifyReport(equipment({ costSatang: baht(10000) }), officePolicy);
  assert.equal(result.classification, "SOR_THOR_2");
  assert.ok(result.reasonCodes.includes("IN_SCOPE_SOR_THOR_2"));
});

test("equipment fiscal-year gate: before / in / after FY2560", () => {
  const before = classifyReport(equipment({ costSatang: baht(52000), acquisitionDateISO: "2012-06-01" }), officePolicy);
  assert.equal(before.classification, "SOR_THOR_3");
  assert.ok(before.reasonCodes.includes("EQUIPMENT_BEFORE_FY2560"));

  const inFy = classifyReport(equipment({ costSatang: baht(52000), acquisitionDateISO: "2016-10-01" }), officePolicy);
  assert.equal(inFy.classification, "SOR_THOR_2");

  const after = classifyReport(equipment({ costSatang: baht(52000), acquisitionDateISO: "2018-01-01" }), officePolicy);
  assert.equal(after.classification, "SOR_THOR_2");
});

test("a building acquired before FY2560 is NOT hit by the equipment gate", () => {
  // Manual worked example 3: office building acquired 1 May 2543.
  const policy = withUsefulLife(basePolicy(), "BUILDING_PERMANENT", 40, 15, 40);
  const building = baseAsset({
    assetGroup: "BUILDING",
    usefulLifeCategoryKey: "BUILDING_PERMANENT",
    acquisitionDateISO: "2000-05-01",
    costSatang: baht(5_280_000),
  });
  assert.equal(classifyReport(building, policy).classification, "SOR_THOR_2");
});

test("land: >= threshold enters สท.2 (non-dep); < threshold is undefined -> NEEDS_REVIEW", () => {
  const land = baseAsset({ assetGroup: "LAND", acquisitionDateISO: "2015-01-01", costSatang: baht(50_000_000) });
  const rich = classifyReport(land, basePolicy());
  assert.equal(rich.classification, "SOR_THOR_2");
  assert.ok(rich.reasonCodes.includes("LAND_NON_DEPRECIABLE"));

  const cheap = classifyReport({ ...land, costSatang: baht(5000) }, basePolicy());
  assert.equal(cheap.classification, "NEEDS_REVIEW");
  assert.ok(cheap.reasonCodes.includes("LAND_BELOW_THRESHOLD_UNDEFINED"));
});

test("fully depreciated equipment (acquired in FY2560+) -> สท.3", () => {
  // life 2y, acquired exactly 24 months before cutoff (2016-10-01 -> 2018-09-30).
  // 2016-10-01 is fiscal year 2560, so the before-FY2560 gate does not apply and
  // the fully-depreciated rule is what routes it to สท.3.
  const policy = withUsefulLife(basePolicy(), "EQUIP_SPORTS", 2, 2, 5);
  const result = classifyReport(
    equipment({ costSatang: baht(60000), acquisitionDateISO: "2016-10-01", usefulLifeCategoryKey: "EQUIP_SPORTS" }),
    policy,
  );
  assert.equal(result.classification, "SOR_THOR_3");
  assert.ok(result.reasonCodes.includes("FULLY_DEPRECIATED"));
});

test("missing data -> NEEDS_REVIEW", () => {
  assert.equal(classifyReport(equipment({ costSatang: undefined }), officePolicy).classification, "NEEDS_REVIEW");
  assert.equal(classifyReport(equipment({ acquisitionDateISO: undefined }), officePolicy).classification, "NEEDS_REVIEW");
  assert.equal(
    classifyReport(baseAsset({ costSatang: baht(20000), acquisitionDateISO: "2018-01-01" }), officePolicy).classification,
    "NEEDS_REVIEW", // no assetGroup
  );
});

test("day-15 with no policy blocks an otherwise-in-scope item", () => {
  const result = classifyReport(
    equipment({ costSatang: baht(20000), acquisitionDateISO: "2018-04-15" }),
    officePolicy, // acquisitionDay15Rule undefined
  );
  assert.equal(result.classification, "NEEDS_REVIEW");
  assert.ok(result.reasonCodes.includes("DAY15_POLICY_REQUIRED"));
});

test("no useful-life policy blocks an in-scope candidate", () => {
  const result = classifyReport(equipment({ costSatang: baht(20000) }), basePolicy());
  assert.equal(result.classification, "NEEDS_REVIEW");
  assert.ok(result.reasonCodes.includes("NO_USEFUL_LIFE_POLICY"));
});

test("invalid / mismatched cutoff blocks an in-scope candidate (no silent fallback)", () => {
  const invalid = classifyReport(
    equipment({ costSatang: baht(20000) }),
    { ...officePolicy, cutoffDateISO: "not-a-date" },
  );
  assert.equal(invalid.classification, "NEEDS_REVIEW");
  assert.ok(invalid.reasonCodes.includes("INVALID_CUTOFF_DATE"));

  const mismatch = classifyReport(
    equipment({ costSatang: baht(20000) }),
    { ...officePolicy, cutoffDateISO: "2018-09-30", fiscalYearBE: 2560 },
  );
  assert.equal(mismatch.classification, "NEEDS_REVIEW");
  assert.ok(mismatch.reasonCodes.includes("CUTOFF_FISCAL_YEAR_MISMATCH"));
});

test("all 8 asset groups (สท.1 sections 1-8) are classified without falling through", () => {
  // Representative useful-life key per group (LAND is non-depreciable, no key).
  const groupToLifeKey: Record<AssetGroup, UsefulLifeCategoryKey | null> = {
    LAND: null,
    BUILDING: "BUILDING_PERMANENT",
    STRUCTURE: "STRUCTURE_WOOD_OTHER",
    EQUIPMENT: "EQUIP_OFFICE",
    INFRASTRUCTURE: "INFRA_ROAD_CONCRETE",
    INTANGIBLE: "INTANGIBLE",
    INVESTMENT_PROPERTY: "BUILDING_PERMANENT", // e.g. investment building
    LEASED_ASSET: "EQUIP_OFFICE", // e.g. leased equipment
  };

  for (const group of Object.keys(groupToLifeKey) as AssetGroup[]) {
    const key = groupToLifeKey[group];
    let policy = basePolicy();
    if (key) policy = withUsefulLife(policy, key, USEFUL_LIFE_TABLE[key].minYears, USEFUL_LIFE_TABLE[key].minYears, USEFUL_LIFE_TABLE[key].maxYears);
    const result = classifyReport(
      baseAsset({
        assetGroup: group,
        usefulLifeCategoryKey: key ?? undefined,
        acquisitionDateISO: "2017-10-01", // FY2561, in scope
        costSatang: baht(500000),
      }),
      policy,
    );
    // Every group yields a definite class with a reason (no unhandled path).
    assert.notEqual(result.classification, undefined, `group ${group}`);
    assert.ok(result.reasonCodes.length >= 1, `group ${group} has a reason`);
    if (group === "LAND") {
      assert.ok(result.reasonCodes.includes("LAND_NON_DEPRECIABLE"));
    } else {
      assert.equal(result.classification, "SOR_THOR_2", `group ${group} in scope`);
    }
  }
});

test("every result carries at least one reason code", () => {
  const samples = [
    classifyReport(equipment({ costSatang: baht(20000) }), officePolicy),
    classifyReport(equipment({ costSatang: baht(9999) }), officePolicy),
    classifyReport(equipment({ costSatang: undefined }), officePolicy),
  ];
  for (const result of samples) assert.ok(result.reasonCodes.length >= 1);
});
