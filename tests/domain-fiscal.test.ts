import assert from "node:assert/strict";
import test from "node:test";
import {
  beToCe,
  ceToBe,
  cutoffDateForFiscalYearBe,
  elapsedMonthsToCutoff,
  fiscalYearBeOf,
  isAcquiredBeforeFiscalYear,
  parseIsoDate,
  resolvePolicyCutoff,
} from "../lib/domain/fiscal";

test("BE/CE conversion", () => {
  assert.equal(beToCe(2560), 2017);
  assert.equal(ceToBe(2017), 2560);
});

test("parseIsoDate validates canonical Gregorian dates", () => {
  assert.deepEqual(parseIsoDate("2017-04-01"), { year: 2017, month: 4, day: 1 });
  assert.equal(parseIsoDate("2017-13-01"), null);
  assert.equal(parseIsoDate("2017-02-29"), null); // not a leap year
  assert.equal(parseIsoDate("01/04/2017"), null); // not canonical
  assert.equal(parseIsoDate(null), null);
});

test("fiscal year boundaries: Oct-Dec belongs to next fiscal year", () => {
  // 30 ก.ย. 2559 = 2016-09-30 -> FY2559
  assert.equal(fiscalYearBeOf(parseIsoDate("2016-09-30")!), 2559);
  // 1 ต.ค. 2559 = 2016-10-01 -> FY2560
  assert.equal(fiscalYearBeOf(parseIsoDate("2016-10-01")!), 2560);
  // 30 ก.ย. 2560 = 2017-09-30 -> FY2560
  assert.equal(fiscalYearBeOf(parseIsoDate("2017-09-30")!), 2560);
  // 1 ต.ค. 2560 = 2017-10-01 -> FY2561
  assert.equal(fiscalYearBeOf(parseIsoDate("2017-10-01")!), 2561);
});

test("isAcquiredBeforeFiscalYear uses fiscal-year boundaries, not calendar year", () => {
  assert.equal(isAcquiredBeforeFiscalYear(parseIsoDate("2016-09-30")!, 2560), true);
  assert.equal(isAcquiredBeforeFiscalYear(parseIsoDate("2016-10-01")!, 2560), false);
  assert.equal(isAcquiredBeforeFiscalYear(parseIsoDate("2017-09-30")!, 2560), false);
});

test("cutoffDateForFiscalYearBe is 30 September of the fiscal year", () => {
  assert.equal(cutoffDateForFiscalYearBe(2561), "2018-09-30");
});

const cutoff = parseIsoDate("2018-09-30")!;

test("elapsed months reproduces manual worked examples", () => {
  // Example 1: 1 เม.ย. 2560 = 2017-04-01 -> 1 ปี 6 เดือน = 18
  assert.deepEqual(elapsedMonthsToCutoff(parseIsoDate("2017-04-01")!, cutoff, undefined), {
    ok: true,
    months: 18,
  });
  // Example 2: 1 ก.พ. 2560 = 2017-02-01 -> 1 ปี 8 เดือน = 20
  assert.deepEqual(elapsedMonthsToCutoff(parseIsoDate("2017-02-01")!, cutoff, undefined), {
    ok: true,
    months: 20,
  });
  // Example 3: 1 พ.ค. 2543 = 2000-05-01 -> 18 ปี 5 เดือน = 221
  assert.deepEqual(elapsedMonthsToCutoff(parseIsoDate("2000-05-01")!, cutoff, undefined), {
    ok: true,
    months: 221,
  });
});

test("day-15 rule: before/after the 15th", () => {
  // day 14 -> acquisition month counts
  assert.deepEqual(elapsedMonthsToCutoff(parseIsoDate("2017-04-14")!, cutoff, undefined), {
    ok: true,
    months: 18,
  });
  // day 16 -> acquisition month dropped
  assert.deepEqual(elapsedMonthsToCutoff(parseIsoDate("2017-04-16")!, cutoff, undefined), {
    ok: true,
    months: 17,
  });
});

test("day-15 exactly requires an explicit policy", () => {
  const on15 = parseIsoDate("2017-04-15")!;
  assert.deepEqual(elapsedMonthsToCutoff(on15, cutoff, "count-month"), { ok: true, months: 18 });
  assert.deepEqual(elapsedMonthsToCutoff(on15, cutoff, "exclude-month"), { ok: true, months: 17 });
  const blocked = elapsedMonthsToCutoff(on15, cutoff, undefined);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.blocking, "DAY15_POLICY_REQUIRED");
});

test("acquisition after cutoff is blocked", () => {
  const result = elapsedMonthsToCutoff(parseIsoDate("2019-01-01")!, cutoff, undefined);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.blocking, "ACQUIRED_AFTER_CUTOFF");
});

test("resolvePolicyCutoff: valid, invalid, and fiscal-year mismatch", () => {
  const good = resolvePolicyCutoff("2018-09-30", 2561);
  assert.equal(good.ok, true);
  if (good.ok) assert.deepEqual(good.cutoff, { year: 2018, month: 9, day: 30 });

  // Invalid date must block, never silently fall back to a derived cutoff.
  const invalid = resolvePolicyCutoff("2018-13-40", 2561);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.blocking, "INVALID_CUTOFF_DATE");

  // Cutoff that does not belong to the declared fiscal year must block.
  const mismatch = resolvePolicyCutoff("2018-09-30", 2560);
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.blocking, "CUTOFF_FISCAL_YEAR_MISMATCH");
});
