// Shared, single-source-of-truth thresholds used by both the classification
// and depreciation engines, so the "10,000 baht" and "fiscal year 2560" rules
// are defined in exactly one place.

/** Manual threshold: cost >= 10,000 baht ("ตั้งแต่ 10,000 บาทขึ้นไป"). */
export const COST_THRESHOLD_SATANG = 1_000_000;

/** The fiscal-year gate applied to ครุภัณฑ์ (EQUIPMENT) only. */
export const EQUIPMENT_FISCAL_YEAR_GATE_BE = 2560;

/** True when cost is at or above the 10,000-baht threshold (equal counts). */
export function meetsCostThreshold(costSatang: number): boolean {
  return costSatang >= COST_THRESHOLD_SATANG;
}
