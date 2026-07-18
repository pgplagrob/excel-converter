// Pure date / fiscal-year helpers.
//
// The domain layer always uses canonical ISO Gregorian dates ("YYYY-MM-DD").
// The UI may display Buddhist-Era (พ.ศ.) years, but ambiguous dates are never
// stored (prompt section 7).  The Thai fiscal year runs 1 October .. 30
// September; fiscal year พ.ศ. 2560 = 1 Oct 2016 CE .. 30 Sep 2017 CE.

import { REASON, type ReasonCode } from "./reason-codes";
import type { Day15Rule } from "./types";

export const THAI_YEAR_OFFSET = 543;

export function beToCe(yearBE: number): number {
  return yearBE - THAI_YEAR_OFFSET;
}

export function ceToBe(yearCE: number): number {
  return yearCE + THAI_YEAR_OFFSET;
}

export interface CalendarDate {
  year: number; // Gregorian CE
  month: number; // 1..12
  day: number; // 1..31
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse and validate a canonical ISO Gregorian date. Returns null if invalid. */
export function parseIsoDate(value: string | null | undefined): CalendarDate | null {
  if (typeof value !== "string") return null;
  const match = value.match(ISO_DATE_PATTERN);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function isValidIsoDate(value: string | null | undefined): boolean {
  return parseIsoDate(value) !== null;
}

/**
 * The Buddhist-Era fiscal year that a Gregorian date belongs to.
 * October–December belongs to the next fiscal year.
 */
export function fiscalYearBeOf(date: CalendarDate): number {
  const baseBe = ceToBe(date.year);
  return date.month >= 10 ? baseBe + 1 : baseBe;
}

/** The cutoff date (30 September) for a Buddhist-Era fiscal year, as ISO. */
export function cutoffDateForFiscalYearBe(fiscalYearBE: number): string {
  const ceYear = beToCe(fiscalYearBE);
  return `${ceYear.toString().padStart(4, "0")}-09-30`;
}

export type CutoffResolution =
  | { ok: true; cutoff: CalendarDate }
  | { ok: false; blocking: ReasonCode };

/**
 * Resolve and validate the report cutoff date. An invalid cutoff is blocked
 * (never silently replaced by a fiscal-year-derived date), and the cutoff must
 * belong to the declared fiscal year (manual: cutoff = 30 Sep of that FY).
 */
export function resolvePolicyCutoff(
  cutoffDateISO: string,
  fiscalYearBE: number,
): CutoffResolution {
  const cutoff = parseIsoDate(cutoffDateISO);
  if (!cutoff) return { ok: false, blocking: REASON.INVALID_CUTOFF_DATE };
  if (fiscalYearBeOf(cutoff) !== fiscalYearBE) {
    return { ok: false, blocking: REASON.CUTOFF_FISCAL_YEAR_MISMATCH };
  }
  return { ok: true, cutoff };
}

/** A monotonic month index used for elapsed-month arithmetic. */
function monthIndex(date: CalendarDate): number {
  return date.year * 12 + (date.month - 1);
}

/** True if `acquisition` falls in a fiscal year strictly before `fiscalYearBE`. */
export function isAcquiredBeforeFiscalYear(
  acquisition: CalendarDate,
  fiscalYearBE: number,
): boolean {
  return fiscalYearBeOf(acquisition) < fiscalYearBE;
}

export type ElapsedMonthsResult =
  | { ok: true; months: number }
  | { ok: false; blocking: ReasonCode };

/**
 * Number of depreciation months elapsed from acquisition to the cutoff date,
 * applying the manual's day-15 rule:
 *   - acquired before the 15th  -> the acquisition month counts (1 month)
 *   - acquired after the 15th   -> the acquisition month is dropped
 *   - acquired exactly on the 15th -> decided by policy (or blocked)
 *
 * The cutoff month is always counted (reports cut at 30 September).
 */
export function elapsedMonthsToCutoff(
  acquisition: CalendarDate,
  cutoff: CalendarDate,
  day15Rule: Day15Rule | undefined,
): ElapsedMonthsResult {
  const span = monthIndex(cutoff) - monthIndex(acquisition);
  if (span < 0) return { ok: false, blocking: REASON.ACQUIRED_AFTER_CUTOFF };

  let countsAcquisitionMonth: boolean;
  if (acquisition.day < 15) {
    countsAcquisitionMonth = true;
  } else if (acquisition.day > 15) {
    countsAcquisitionMonth = false;
  } else if (day15Rule === "count-month") {
    countsAcquisitionMonth = true;
  } else if (day15Rule === "exclude-month") {
    countsAcquisitionMonth = false;
  } else {
    return { ok: false, blocking: REASON.DAY15_POLICY_REQUIRED };
  }

  const months = countsAcquisitionMonth ? span + 1 : span;
  return { ok: true, months: Math.max(months, 0) };
}
