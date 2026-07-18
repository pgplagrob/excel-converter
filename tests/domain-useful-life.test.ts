import assert from "node:assert/strict";
import test from "node:test";
import { USEFUL_LIFE_TABLE, selectUsefulLifeYears } from "../lib/domain/useful-life";
import { basePolicy, withUsefulLife } from "./domain-fixtures";

test("useful-life table carries the manual ranges", () => {
  assert.deepEqual(
    {
      min: USEFUL_LIFE_TABLE.BUILDING_PERMANENT.minYears,
      max: USEFUL_LIFE_TABLE.BUILDING_PERMANENT.maxYears,
    },
    { min: 15, max: 40 },
  );
  assert.deepEqual(
    { min: USEFUL_LIFE_TABLE.EQUIP_OFFICE.minYears, max: USEFUL_LIFE_TABLE.EQUIP_OFFICE.maxYears },
    { min: 3, max: 12 },
  );
  assert.equal(USEFUL_LIFE_TABLE.EQUIP_COMPUTER.minYears, 3);
  assert.equal(USEFUL_LIFE_TABLE.INFRA_DAM_CONCRETE.maxYears, 80);
});

test("minimum / maximum selection policies", () => {
  const min = selectUsefulLifeYears("EQUIP_OFFICE", basePolicy({ usefulLifeSelectionPolicy: "minimum" }));
  assert.deepEqual(min, { ok: true, years: 3, rangeMin: 3, rangeMax: 12 });
  const max = selectUsefulLifeYears("EQUIP_OFFICE", basePolicy({ usefulLifeSelectionPolicy: "maximum" }));
  assert.deepEqual(max, { ok: true, years: 12, rangeMin: 3, rangeMax: 12 });
});

test("explicit-per-category uses the override when in range", () => {
  const policy = withUsefulLife(basePolicy(), "EQUIP_OFFICE", 8, 3, 12);
  const selection = selectUsefulLifeYears("EQUIP_OFFICE", policy);
  assert.deepEqual(selection, { ok: true, years: 8, rangeMin: 3, rangeMax: 12 });
});

test("out-of-range override is blocked", () => {
  const policy = withUsefulLife(basePolicy(), "EQUIP_OFFICE", 20, 3, 12);
  const selection = selectUsefulLifeYears("EQUIP_OFFICE", policy);
  assert.equal(selection.ok, false);
  if (!selection.ok) assert.equal(selection.blocking, "USEFUL_LIFE_OUT_OF_RANGE");
});

test("explicit-per-category without an override blocks (no silent default)", () => {
  const selection = selectUsefulLifeYears("EQUIP_OFFICE", basePolicy());
  assert.equal(selection.ok, false);
  if (!selection.ok) assert.equal(selection.blocking, "NO_USEFUL_LIFE_POLICY");
});

test("generator is a separate 15-20yr category, distinct from general electric/radio 5-10yr", () => {
  assert.deepEqual(
    {
      min: USEFUL_LIFE_TABLE.EQUIP_ELECTRIC_GENERATOR.minYears,
      max: USEFUL_LIFE_TABLE.EQUIP_ELECTRIC_GENERATOR.maxYears,
    },
    { min: 15, max: 20 },
  );
  assert.deepEqual(
    {
      min: USEFUL_LIFE_TABLE.EQUIP_ELECTRIC_RADIO.minYears,
      max: USEFUL_LIFE_TABLE.EQUIP_ELECTRIC_RADIO.maxYears,
    },
    { min: 5, max: 10 },
  );
  const gen = selectUsefulLifeYears("EQUIP_ELECTRIC_GENERATOR", basePolicy({ usefulLifeSelectionPolicy: "maximum" }));
  assert.deepEqual(gen, { ok: true, years: 20, rangeMin: 15, rangeMax: 20 });
});
