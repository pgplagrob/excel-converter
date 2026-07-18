// Pure money arithmetic for the asset-reporting domain.
//
// The manual requires that monetary totals must not drift because of
// floating-point accumulation, and that a rounding policy is stated
// explicitly (see prompt sections 5 and 12).  We therefore keep all money as
// integer "satang" (1 baht = 100 satang) and only ever round through the
// helpers below, driven by a caller-supplied policy.
//
// This module has no dependency on React, route handlers, or ExcelJS.

export type RoundingMode = "half-up" | "half-even" | "truncate";

/** Convert a baht amount to integer satang. */
export function toSatang(baht: number): number {
  if (!Number.isFinite(baht)) throw new Error("toSatang requires a finite number");
  // Round to the nearest satang using half-up on the raw baht value so that a
  // value such as 12.005 becomes 1201 rather than 1200 through binary error.
  return Math.round(baht * 100 + (baht >= 0 ? 1e-6 : -1e-6));
}

/** Convert integer satang back to a baht number (may have up to 2 decimals). */
export function fromSatang(satang: number): number {
  return satang / 100;
}

/**
 * Round a fractional satang value to an integer satang value using the
 * supplied mode.  Input may be fractional because of division (cost / life).
 */
export function roundSatang(value: number, mode: RoundingMode): number {
  if (!Number.isFinite(value)) throw new Error("roundSatang requires a finite number");
  switch (mode) {
    case "truncate":
      return Math.trunc(value);
    case "half-even": {
      const floor = Math.floor(value);
      const diff = value - floor;
      if (diff < 0.5) return floor;
      if (diff > 0.5) return floor + 1;
      // Exactly .5 -> round to the nearest even integer.
      return floor % 2 === 0 ? floor : floor + 1;
    }
    case "half-up":
    default: {
      // Symmetric half-up: .5 always rounds away from zero.
      return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
    }
  }
}

/** Format integer satang as a Thai-style "#,##0.00" string (for reports). */
export function formatMoneySatang(satang: number): string {
  const negative = satang < 0;
  const absolute = Math.abs(satang);
  const baht = Math.trunc(absolute / 100);
  const satangPart = absolute % 100;
  const bahtText = baht.toLocaleString("en-US");
  const result = `${bahtText}.${satangPart.toString().padStart(2, "0")}`;
  return negative ? `-${result}` : result;
}
