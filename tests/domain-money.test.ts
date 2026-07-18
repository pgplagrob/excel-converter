import assert from "node:assert/strict";
import test from "node:test";
import { formatMoneySatang, roundSatang, toSatang } from "../lib/domain/money";

test("toSatang converts baht to integer satang without binary drift", () => {
  assert.equal(toSatang(48000), 4_800_000);
  assert.equal(toSatang(9000), 900_000);
  assert.equal(toSatang(12.005), 1201);
  assert.equal(toSatang(0.5), 50);
  assert.equal(toSatang(0), 0);
});

test("roundSatang honours each rounding mode", () => {
  assert.equal(roundSatang(150.5, "half-up"), 151);
  assert.equal(roundSatang(150.5, "half-even"), 150); // 150 is even
  assert.equal(roundSatang(151.5, "half-even"), 152); // rounds to even
  assert.equal(roundSatang(150.5, "truncate"), 150);
  assert.equal(roundSatang(150.999, "truncate"), 150);
});

test("formatMoneySatang renders #,##0.00", () => {
  assert.equal(formatMoneySatang(900_000), "9,000.00");
  assert.equal(formatMoneySatang(243_100_000), "2,431,000.00");
  assert.equal(formatMoneySatang(50), "0.50");
  assert.equal(formatMoneySatang(-100), "-1.00");
});
