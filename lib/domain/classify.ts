// Classification engine (pure).  Decides which government report an asset
// belongs to, per the manual (ch.2 p.4 scope rules + worked examples 1-5).
//
// Decision order (approved in the Phase 1 report, section 9):
//   C0  missing/invalid cost, date, or asset group        -> NEEDS_REVIEW
//   C1  LAND (cost >= threshold)                           -> SOR_THOR_2 (non-dep)
//       LAND (cost < threshold)                            -> NEEDS_REVIEW (undefined by manual)
//   C2  cost < 10,000                                      -> SOR_THOR_3
//   C4  EQUIPMENT acquired before fiscal year 2560         -> SOR_THOR_3
//   C3  fully depreciated (elapsed >= useful life)         -> SOR_THOR_3
//   C5  otherwise                                          -> SOR_THOR_2
//
// The FY2560 gate applies to ครุภัณฑ์ (EQUIPMENT) only — never to buildings or
// other groups (manual worked example 3: a 2543 building still enters สท.2).

import {
  elapsedMonthsToCutoff,
  isAcquiredBeforeFiscalYear,
  isDateAfter,
  parseIsoDate,
  resolvePolicyCutoff,
} from "./fiscal";
import { REASON, REASON_EXPLANATION_TH, type ReasonCode } from "./reason-codes";
import { EQUIPMENT_FISCAL_YEAR_GATE_BE, meetsCostThreshold } from "./rules";
import type { ClassificationResult, NormalizedAsset, ReportClass, ReportingPolicy } from "./types";
import { selectUsefulLifeYears } from "./useful-life";

function build(
  asset: NormalizedAsset,
  classification: ReportClass,
  reasonCodes: ReasonCode[],
  evaluatedRules: string[],
  missingFields: string[],
  policy: ReportingPolicy,
): ClassificationResult {
  return {
    rowKey: asset.rowKey,
    classification,
    reasonCodes,
    explanation: reasonCodes.map((code) => REASON_EXPLANATION_TH[code]).join(" ; "),
    evaluatedRules,
    missingFields,
    classificationVersion: policy.classificationVersion,
  };
}

export function classifyReport(
  asset: NormalizedAsset,
  policy: ReportingPolicy,
): ClassificationResult {
  const evaluated: string[] = [];

  // --- C0: required data present and valid ---
  const missing: string[] = [];
  if (asset.costSatang === undefined || asset.costSatang === null) missing.push("cost");
  if (!asset.acquisitionDateISO) missing.push("acquisitionDate");
  if (!asset.assetGroup) missing.push("assetGroup");

  const reasons: ReasonCode[] = [];
  if (missing.includes("cost")) reasons.push(REASON.MISSING_COST);
  if (missing.includes("acquisitionDate")) reasons.push(REASON.MISSING_ACQUISITION_DATE);
  if (missing.includes("assetGroup")) reasons.push(REASON.MISSING_ASSET_GROUP);
  if (reasons.length) {
    evaluated.push("C0:missing-required-fields");
    return build(asset, "NEEDS_REVIEW", reasons, evaluated, missing, policy);
  }

  const acquisition = parseIsoDate(asset.acquisitionDateISO);
  if (!acquisition) {
    evaluated.push("C0:invalid-acquisition-date");
    return build(asset, "NEEDS_REVIEW", [REASON.INVALID_ACQUISITION_DATE], evaluated, ["acquisitionDate"], policy);
  }

  const costSatang = asset.costSatang as number;
  if (!Number.isFinite(costSatang)) {
    evaluated.push("C0:cost-not-finite");
    return build(asset, "NEEDS_REVIEW", [REASON.INVALID_COST_NOT_FINITE], evaluated, ["cost"], policy);
  }
  if (!Number.isInteger(costSatang)) {
    evaluated.push("C0:cost-not-integer");
    return build(asset, "NEEDS_REVIEW", [REASON.INVALID_COST_NOT_INTEGER], evaluated, ["cost"], policy);
  }
  if (costSatang < 0) {
    evaluated.push("C0:negative-cost");
    return build(asset, "NEEDS_REVIEW", [REASON.NEGATIVE_COST], evaluated, ["cost"], policy);
  }

  // --- Cutoff validation applies to EVERY item (land, below-threshold,
  // equipment-before-2560 included). It never enforces the day-15 policy, which
  // is only needed to count elapsed months for depreciated items (C3 below). ---
  const cutoffResolution = resolvePolicyCutoff(policy.cutoffDateISO, policy.fiscalYearBE);
  if (!cutoffResolution.ok) {
    evaluated.push("C0:cutoff");
    return build(asset, "NEEDS_REVIEW", [cutoffResolution.blocking], evaluated, ["cutoffDate"], policy);
  }
  if (isDateAfter(acquisition, cutoffResolution.cutoff)) {
    evaluated.push("C0:acquired-after-cutoff");
    return build(asset, "NEEDS_REVIEW", [REASON.ACQUIRED_AFTER_CUTOFF], evaluated, ["acquisitionDate"], policy);
  }

  // --- C1: land ---
  if (asset.assetGroup === "LAND") {
    evaluated.push("C1:land");
    if (meetsCostThreshold(costSatang)) {
      return build(asset, "SOR_THOR_2", [REASON.LAND_NON_DEPRECIABLE], evaluated, [], policy);
    }
    // Cheap land fits neither สท.2 (needs >=10,000) nor สท.3 (scope is buildings
    // & equipment only); the manual does not specify -> do not guess.
    return build(asset, "NEEDS_REVIEW", [REASON.LAND_BELOW_THRESHOLD_UNDEFINED], evaluated, [], policy);
  }

  // --- C2: below threshold ---
  evaluated.push("C2:threshold");
  if (!meetsCostThreshold(costSatang)) {
    return build(asset, "SOR_THOR_3", [REASON.BELOW_THRESHOLD], evaluated, [], policy);
  }

  // --- C4: equipment acquired before fiscal year 2560 ---
  evaluated.push("C4:equipment-fiscal-year-gate");
  if (
    asset.assetGroup === "EQUIPMENT" &&
    isAcquiredBeforeFiscalYear(acquisition, EQUIPMENT_FISCAL_YEAR_GATE_BE)
  ) {
    return build(asset, "SOR_THOR_3", [REASON.EQUIPMENT_BEFORE_FY2560], evaluated, [], policy);
  }

  // --- C3: fully depreciated (needs useful life + elapsed months) ---
  evaluated.push("C3:fully-depreciated");
  if (!asset.usefulLifeCategoryKey) {
    return build(asset, "NEEDS_REVIEW", [REASON.AMBIGUOUS_USEFUL_LIFE_CATEGORY], evaluated, ["usefulLifeCategoryKey"], policy);
  }
  const lifeSelection = selectUsefulLifeYears(asset.usefulLifeCategoryKey, policy);
  if (!lifeSelection.ok) {
    return build(asset, "NEEDS_REVIEW", [lifeSelection.blocking], evaluated, ["usefulLifeYears"], policy);
  }

  // Cutoff already validated above; only the day-15 policy can still block here,
  // and only for depreciated (สท.2-candidate) items — never for สท.3/land.
  const elapsed = elapsedMonthsToCutoff(acquisition, cutoffResolution.cutoff, policy.acquisitionDay15Rule);
  if (!elapsed.ok) {
    return build(asset, "NEEDS_REVIEW", [elapsed.blocking], evaluated, [], policy);
  }

  if (elapsed.months >= lifeSelection.years * 12) {
    return build(asset, "SOR_THOR_3", [REASON.FULLY_DEPRECIATED], evaluated, [], policy);
  }

  // --- C5: in scope for สท.2 ---
  evaluated.push("C5:in-scope");
  return build(asset, "SOR_THOR_2", [REASON.IN_SCOPE_SOR_THOR_2], evaluated, [], policy);
}
