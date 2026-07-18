import assert from "node:assert/strict";
import test from "node:test";
import { calculateDepreciation } from "../lib/domain/depreciation";
import { baht, baseAsset, basePolicy, withUsefulLife } from "./domain-fixtures";

test("manual example 1: air conditioner (48,000, office, life 8) -> accum 9,000", () => {
  const policy = withUsefulLife(basePolicy(), "EQUIP_OFFICE", 8, 3, 12);
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2017-04-01",
      costSatang: baht(48000),
    }),
    policy,
  );
  assert.equal(result.shouldDepreciate, true);
  assert.equal(result.elapsedMonths, 18);
  assert.equal(result.annualDepreciationSatang, baht(6000));
  assert.equal(result.accumulatedDepreciationSatang, baht(9000));
  assert.equal(result.netBookValueSatang, baht(48000) - baht(9000));
});

test("manual example 2: exercise machine (38,400, sports, life 5) -> accum 12,800", () => {
  const policy = withUsefulLife(basePolicy(), "EQUIP_SPORTS", 5, 2, 5);
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_SPORTS",
      acquisitionDateISO: "2017-02-01",
      costSatang: baht(38400),
    }),
    policy,
  );
  assert.equal(result.elapsedMonths, 20);
  assert.equal(result.accumulatedDepreciationSatang, baht(12800));
});

test("manual example 3: office building (5,280,000, permanent, life 40) -> accum 2,431,000", () => {
  const policy = withUsefulLife(basePolicy(), "BUILDING_PERMANENT", 40, 15, 40);
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "BUILDING",
      usefulLifeCategoryKey: "BUILDING_PERMANENT",
      acquisitionDateISO: "2000-05-01",
      costSatang: baht(5_280_000),
    }),
    policy,
  );
  assert.equal(result.elapsedMonths, 221);
  assert.equal(result.accumulatedDepreciationSatang, baht(2_431_000));
});

test("manual example 4: photocopier (9,000 < threshold) -> not depreciated (สท.3)", () => {
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2018-03-01",
      costSatang: baht(9000),
    }),
    basePolicy(),
  );
  assert.equal(result.shouldDepreciate, false);
  assert.equal(result.accumulatedDepreciationSatang, 0);
  assert.equal(result.netBookValueSatang, baht(9000));
  assert.ok(result.reasonCodes.includes("NOT_DEPRECIATED_BELOW_THRESHOLD"));
});

test("manual example 5: motorcycle (52,000, equipment before FY2560) -> not depreciated", () => {
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_VEHICLE_TRANSPORT",
      acquisitionDateISO: "2012-06-01",
      costSatang: baht(52000),
    }),
    basePolicy(),
  );
  assert.equal(result.shouldDepreciate, false);
  assert.equal(result.accumulatedDepreciationSatang, 0);
  assert.ok(result.reasonCodes.includes("NOT_DEPRECIATED_EQUIPMENT_BEFORE_FY2560"));
});

test("land is never depreciated", () => {
  const result = calculateDepreciation(
    baseAsset({ assetGroup: "LAND", acquisitionDateISO: "2015-01-01", costSatang: baht(50_000_000) }),
    basePolicy(),
  );
  assert.equal(result.shouldDepreciate, false);
  assert.equal(result.accumulatedDepreciationSatang, 0);
  assert.equal(result.netBookValueSatang, baht(50_000_000));
  assert.ok(result.reasonCodes.includes("LAND_NON_DEPRECIABLE"));
});

test("fully depreciated: reported as สท.3 (shouldDepreciate=false), arithmetic in evidence only", () => {
  // Structure (not subject to the equipment FY2560 gate), life 5y, acquired
  // exactly 60 months before cutoff (2013-10-01 -> 2018-09-30).
  const policy = withUsefulLife(basePolicy(), "STRUCTURE_WOOD_OTHER", 5, 5, 15);
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "STRUCTURE",
      usefulLifeCategoryKey: "STRUCTURE_WOOD_OTHER",
      acquisitionDateISO: "2013-10-01",
      costSatang: baht(60000),
    }),
    policy,
  );
  // Reported figures show no active depreciation (goes to สท.3).
  assert.equal(result.shouldDepreciate, false);
  assert.equal(result.accumulatedDepreciationSatang, 0);
  assert.equal(result.netBookValueSatang, baht(60000));
  assert.ok(result.reasonCodes.includes("FULLY_DEPRECIATED"));
  // Evidence carries the arithmetic that justifies "fully depreciated".
  assert.ok(result.evidence);
  assert.equal(result.evidence?.elapsedMonths, 60);
  assert.equal(result.evidence?.isPastUsefulLife, true);
  assert.equal(result.evidence?.accumulatedDepreciationSatang, baht(60000) - 100);
  assert.equal(result.evidence?.netBookValueSatang, 100);
});

test("beyond useful life: still สท.3, evidence capped at residual", () => {
  const policy = withUsefulLife(basePolicy(), "STRUCTURE_WOOD_OTHER", 5, 5, 15);
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "STRUCTURE",
      usefulLifeCategoryKey: "STRUCTURE_WOOD_OTHER",
      acquisitionDateISO: "2005-01-01",
      costSatang: baht(60000),
    }),
    policy,
  );
  assert.equal(result.shouldDepreciate, false);
  assert.equal(result.accumulatedDepreciationSatang, 0);
  assert.equal(result.evidence?.cappedAtResidual, true);
  assert.equal(result.evidence?.accumulatedDepreciationSatang, baht(60000) - 100);
  assert.equal(result.evidence?.netBookValueSatang, 100);
});

test("zero-cost asset is never forced to a 1-baht net book value", () => {
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2018-01-01",
      costSatang: 0,
    }),
    basePolicy(),
  );
  assert.equal(result.accumulatedDepreciationSatang, 0);
  assert.equal(result.netBookValueSatang, 0);
});

test("missing useful-life policy blocks the calculation", () => {
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2018-01-01",
      costSatang: baht(20000),
    }),
    basePolicy(), // explicit-per-category, no override
  );
  assert.equal(result.shouldDepreciate, false);
  assert.ok(result.blockingIssues.includes("NO_USEFUL_LIFE_POLICY"));
});

test("source vs calculated accumulated depreciation variance is flagged", () => {
  const policy = withUsefulLife(basePolicy(), "EQUIP_OFFICE", 8, 3, 12);
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2017-04-01",
      costSatang: baht(48000),
      sourceAccumulatedDepreciationSatang: baht(5000), // calc is 9,000
    }),
    policy,
  );
  assert.ok(result.reasonCodes.includes("SOURCE_CALC_DEPRECIATION_VARIANCE"));
});

test("source useful life conflicting with the policy-selected life is flagged", () => {
  const policy = withUsefulLife(basePolicy(), "EQUIP_OFFICE", 8, 3, 12);
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2017-04-01",
      costSatang: baht(48000),
      sourceUsefulLifeYears: 5, // policy uses 8
    }),
    policy,
  );
  assert.ok(result.reasonCodes.includes("SOURCE_USEFUL_LIFE_CONFLICT"));
});

test("source rate inconsistent with the policy-selected life is flagged", () => {
  const policy = withUsefulLife(basePolicy(), "EQUIP_OFFICE", 8, 3, 12); // rate = 12.5%
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2017-04-01",
      costSatang: baht(48000),
      sourceDepreciationRateAnnualPct: 20, // != 12.5
    }),
    policy,
  );
  assert.ok(result.reasonCodes.includes("SOURCE_RATE_POLICY_CONFLICT"));
});

test("source life and source rate that contradict each other are flagged", () => {
  const policy = withUsefulLife(basePolicy(), "EQUIP_OFFICE", 8, 3, 12);
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2017-04-01",
      costSatang: baht(48000),
      sourceUsefulLifeYears: 8, // implies 12.5%
      sourceDepreciationRateAnnualPct: 25, // contradicts 12.5%
    }),
    policy,
  );
  assert.ok(result.reasonCodes.includes("SOURCE_LIFE_RATE_INTERNAL_CONFLICT"));
});

test("source accumulated depreciation that is negative or exceeds cost is flagged (even for สท.3)", () => {
  // Below-threshold (non-depreciated) item still surfaces source data problems.
  const negative = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2018-03-01",
      costSatang: baht(9000),
      sourceAccumulatedDepreciationSatang: baht(-100),
    }),
    basePolicy(),
  );
  assert.equal(negative.shouldDepreciate, false);
  assert.ok(negative.reasonCodes.includes("SOURCE_ACCUM_NEGATIVE"));

  const over = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2018-03-01",
      costSatang: baht(9000),
      sourceAccumulatedDepreciationSatang: baht(9500),
    }),
    basePolicy(),
  );
  assert.ok(over.reasonCodes.includes("SOURCE_ACCUM_EXCEEDS_COST"));
});

test("source net book value inconsistent with cost - source accumulated is flagged", () => {
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2018-03-01",
      costSatang: baht(9000),
      sourceAccumulatedDepreciationSatang: baht(2000),
      sourceNetBookValueSatang: baht(5000), // should be 7,000
    }),
    basePolicy(),
  );
  assert.ok(result.reasonCodes.includes("SOURCE_NBV_INCONSISTENT"));
});

test("source net book value differing from the calculated net book value is flagged", () => {
  const policy = withUsefulLife(basePolicy(), "EQUIP_OFFICE", 8, 3, 12);
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2017-04-01",
      costSatang: baht(48000), // calc net = 48,000 - 9,000 = 39,000
      sourceNetBookValueSatang: baht(30000),
    }),
    policy,
  );
  assert.equal(result.shouldDepreciate, true);
  assert.ok(result.reasonCodes.includes("SOURCE_NBV_VS_CALC_VARIANCE"));
});

test("a negative residual policy is blocked (must not let depreciation exceed cost)", () => {
  const policy = withUsefulLife(basePolicy({ residualBookValueSatang: -100 }), "EQUIP_OFFICE", 8, 3, 12);
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2017-04-01",
      costSatang: baht(48000),
    }),
    policy,
  );
  assert.equal(result.shouldDepreciate, false);
  assert.ok(result.blockingIssues.includes("INVALID_RESIDUAL_POLICY"));
});

test("consistent source life+rate produces no source conflicts", () => {
  const policy = withUsefulLife(basePolicy(), "EQUIP_OFFICE", 8, 3, 12);
  const result = calculateDepreciation(
    baseAsset({
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2017-04-01",
      costSatang: baht(48000),
      sourceUsefulLifeYears: 8,
      sourceDepreciationRateAnnualPct: 12.5,
      sourceAccumulatedDepreciationSatang: baht(9000),
    }),
    policy,
  );
  assert.equal(result.shouldDepreciate, true);
  assert.ok(!result.reasonCodes.includes("SOURCE_USEFUL_LIFE_CONFLICT"));
  assert.ok(!result.reasonCodes.includes("SOURCE_RATE_POLICY_CONFLICT"));
  assert.ok(!result.reasonCodes.includes("SOURCE_LIFE_RATE_INTERNAL_CONFLICT"));
  assert.ok(!result.reasonCodes.includes("SOURCE_CALC_DEPRECIATION_VARIANCE"));
});

test("rounding stage changes the accumulated total when division is uneven", () => {
  // cost 10,000, life 3 -> annualRaw = 333,333.33 satang; 1 year elapsed.
  const asset = baseAsset({
    assetGroup: "EQUIPMENT",
    usefulLifeCategoryKey: "EQUIP_OFFICE",
    acquisitionDateISO: "2017-10-01",
    costSatang: baht(10000),
  });
  const base = withUsefulLife(basePolicy(), "EQUIP_OFFICE", 3, 3, 12);

  const finalOnly = calculateDepreciation(asset, { ...base, roundingStage: "final-only" });
  const perYear = calculateDepreciation(asset, { ...base, roundingStage: "per-year" });
  const perMonth = calculateDepreciation(asset, { ...base, roundingStage: "per-month" });

  assert.equal(finalOnly.elapsedMonths, 12);
  assert.equal(finalOnly.accumulatedDepreciationSatang, 333_333);
  assert.equal(perYear.accumulatedDepreciationSatang, 333_333);
  assert.equal(perMonth.accumulatedDepreciationSatang, 333_336); // 27,778 x 12
});
