// Depreciation engine (pure).  Straight-line, driven entirely by policy, with
// every result auditable through `calculationSteps` (manual ch.3-4, pp.12-20).
//
// Key manual rules reproduced here:
//   - annual = cost / useful-life  (= cost x annual rate)
//   - accumulated = annual x elapsed-years-to-cutoff (partial months x m/12)
//   - final book value kept at residual (default 1 baht) for depreciable assets
//   - land / below-threshold / equipment-before-FY2560 are NOT depreciated
//   - a zero-cost asset is never forced to a 1-baht net book value
//
// Reporting vs evidence: only assets that are actively depreciated in สท.2
// (in-scope, non-land) carry `shouldDepreciate = true` and reported figures.
// สท.3 cases — including a fully depreciated asset — are `shouldDepreciate =
// false`; their arithmetic is exposed as `evidence`, never as report figures.
//
// It never mutates the input asset and never overwrites source values with
// calculated ones (source values are compared, not copied).

import { classifyReport } from "./classify";
import { elapsedMonthsToCutoff, parseIsoDate, resolvePolicyCutoff } from "./fiscal";
import { roundSatang } from "./money";
import { REASON, REASON_EXPLANATION_TH, type ReasonCode } from "./reason-codes";
import type {
  DepreciationEvidence,
  DepreciationResult,
  NormalizedAsset,
  ReportingPolicy,
} from "./types";
import { selectUsefulLifeYears } from "./useful-life";

// Source vs calculated accumulated depreciation are flagged when they differ
// by more than 1 baht, to absorb rounding without hiding real discrepancies.
const VARIANCE_TOLERANCE_SATANG = 100;
// Annual rates are quoted to ~2 decimals in the manual, so allow 0.5 pp slack.
const RATE_TOLERANCE_PCT = 0.5;

function explanationFor(codes: ReasonCode[]): string {
  return codes.map((code) => REASON_EXPLANATION_TH[code]).join(" ; ");
}

interface StraightLine {
  annual: number;
  monthly: number;
  accumulated: number;
  net: number;
  residual: number;
  ratePct: number;
  capped: boolean;
}

function straightLine(
  costSatang: number,
  life: number,
  elapsedMonths: number,
  policy: ReportingPolicy,
): StraightLine {
  const mode = policy.roundingMode;
  const wholeYears = Math.floor(elapsedMonths / 12);
  const remMonths = elapsedMonths % 12;
  const annualRaw = costSatang / life; // satang per year (may be fractional)

  let annual: number;
  let monthly: number;
  let accumulated: number;
  switch (policy.roundingStage) {
    case "per-month":
      monthly = roundSatang(annualRaw / 12, mode);
      annual = monthly * 12;
      accumulated = monthly * elapsedMonths;
      break;
    case "per-year":
      annual = roundSatang(annualRaw, mode);
      monthly = roundSatang(annual / 12, mode);
      accumulated = annual * wholeYears + roundSatang((annual * remMonths) / 12, mode);
      break;
    case "final-only":
    default:
      annual = roundSatang(annualRaw, mode);
      monthly = roundSatang(annualRaw / 12, mode);
      accumulated = roundSatang((annualRaw * elapsedMonths) / 12, mode);
      break;
  }

  const residual = policy.residualBookValueSatang;
  const maxAccumulated = Math.max(costSatang - residual, 0);
  let capped = false;
  if (accumulated > maxAccumulated) {
    accumulated = maxAccumulated;
    capped = true;
  }
  if (accumulated < 0) accumulated = 0;

  return {
    annual,
    monthly,
    accumulated,
    net: costSatang - accumulated,
    // Residual floor at end of life: never more than cost, 0 for zero-cost.
    residual: costSatang <= 0 ? 0 : Math.min(residual, costSatang),
    ratePct: Number((100 / life).toFixed(4)),
    capped,
  };
}

/** Flag any source useful-life / rate / accumulated depreciation conflicts. */
function sourceConsistencyIssues(
  asset: NormalizedAsset,
  usedLife: number,
  usedRatePct: number,
  calculatedAccumulated: number,
): ReasonCode[] {
  const codes: ReasonCode[] = [];
  const srcLife = asset.sourceUsefulLifeYears;
  const srcRate = asset.sourceDepreciationRateAnnualPct;
  const srcAccum = asset.sourceAccumulatedDepreciationSatang;

  if (srcLife !== undefined && srcLife !== null && srcLife !== usedLife) {
    codes.push(REASON.SOURCE_USEFUL_LIFE_CONFLICT);
  }
  if (srcRate !== undefined && srcRate !== null && Math.abs(srcRate - usedRatePct) > RATE_TOLERANCE_PCT) {
    codes.push(REASON.SOURCE_RATE_POLICY_CONFLICT);
  }
  if (
    srcLife !== undefined && srcLife !== null && srcLife > 0 &&
    srcRate !== undefined && srcRate !== null &&
    Math.abs(srcRate - 100 / srcLife) > RATE_TOLERANCE_PCT
  ) {
    codes.push(REASON.SOURCE_LIFE_RATE_INTERNAL_CONFLICT);
  }
  if (
    srcAccum !== undefined && srcAccum !== null &&
    Math.abs(srcAccum - calculatedAccumulated) > VARIANCE_TOLERANCE_SATANG
  ) {
    codes.push(REASON.SOURCE_CALC_DEPRECIATION_VARIANCE);
  }
  return codes;
}

/**
 * Source cross-field checks that do not require a calculated value, so they
 * apply to every asset once cost is valid — including non-depreciated ones.
 */
function sourceInternalIssues(asset: NormalizedAsset, costSatang: number): ReasonCode[] {
  const codes: ReasonCode[] = [];
  const accum = asset.sourceAccumulatedDepreciationSatang;
  const nbv = asset.sourceNetBookValueSatang;
  const hasAccum = accum !== undefined && accum !== null && Number.isFinite(accum);
  const hasNbv = nbv !== undefined && nbv !== null && Number.isFinite(nbv);

  if (hasAccum && (accum as number) < 0) codes.push(REASON.SOURCE_ACCUM_NEGATIVE);
  if (hasAccum && (accum as number) > costSatang) codes.push(REASON.SOURCE_ACCUM_EXCEEDS_COST);
  if (hasAccum && hasNbv && Math.abs((nbv as number) - (costSatang - (accum as number))) > VARIANCE_TOLERANCE_SATANG) {
    codes.push(REASON.SOURCE_NBV_INCONSISTENT);
  }
  return codes;
}

function isValidResidualPolicy(residualSatang: number): boolean {
  return Number.isFinite(residualSatang) && Number.isInteger(residualSatang) && residualSatang >= 0;
}

function nonDepreciated(
  asset: NormalizedAsset,
  policy: ReportingPolicy,
  reasonCodes: ReasonCode[],
  steps: string[],
  evidence?: DepreciationEvidence,
): DepreciationResult {
  const cost = asset.costSatang ?? 0;
  return {
    rowKey: asset.rowKey,
    shouldDepreciate: false,
    elapsedMonths: 0,
    annualDepreciationSatang: 0,
    monthlyDepreciationSatang: 0,
    accumulatedDepreciationSatang: 0,
    residualBookValueSatang: 0,
    netBookValueSatang: cost, // non-depreciated: net book value equals cost
    evidence,
    reasonCodes,
    explanation: explanationFor(reasonCodes),
    calculationSteps: steps,
    blockingIssues: [],
    depreciationRuleVersion: policy.depreciationRuleVersion,
  };
}

function blocked(
  asset: NormalizedAsset,
  policy: ReportingPolicy,
  blockingIssues: ReasonCode[],
  steps: string[],
): DepreciationResult {
  return {
    rowKey: asset.rowKey,
    shouldDepreciate: false,
    reasonCodes: blockingIssues,
    explanation: explanationFor(blockingIssues),
    calculationSteps: steps,
    blockingIssues,
    depreciationRuleVersion: policy.depreciationRuleVersion,
  };
}

type Timing =
  | { ok: true; life: number; rangeMin: number; rangeMax: number; elapsedMonths: number }
  | { ok: false; blocking: ReasonCode };

/** Resolve useful life + elapsed months, or the blocking issue that prevents it. */
function resolveTiming(asset: NormalizedAsset, policy: ReportingPolicy): Timing {
  const acquisition = parseIsoDate(asset.acquisitionDateISO);
  if (!acquisition) return { ok: false, blocking: REASON.INVALID_ACQUISITION_DATE };
  if (!asset.usefulLifeCategoryKey) return { ok: false, blocking: REASON.AMBIGUOUS_USEFUL_LIFE_CATEGORY };

  const lifeSelection = selectUsefulLifeYears(asset.usefulLifeCategoryKey, policy);
  if (!lifeSelection.ok) return { ok: false, blocking: lifeSelection.blocking };

  const cutoffResolution = resolvePolicyCutoff(policy.cutoffDateISO, policy.fiscalYearBE);
  if (!cutoffResolution.ok) return { ok: false, blocking: cutoffResolution.blocking };

  const elapsed = elapsedMonthsToCutoff(acquisition, cutoffResolution.cutoff, policy.acquisitionDay15Rule);
  if (!elapsed.ok) return { ok: false, blocking: elapsed.blocking };

  return {
    ok: true,
    life: lifeSelection.years,
    rangeMin: lifeSelection.rangeMin,
    rangeMax: lifeSelection.rangeMax,
    elapsedMonths: elapsed.months,
  };
}

export function calculateDepreciation(
  asset: NormalizedAsset,
  policy: ReportingPolicy,
): DepreciationResult {
  const steps: string[] = [];
  const classification = classifyReport(asset, policy);
  steps.push(`classification=${classification.classification} [${classification.reasonCodes.join(",")}]`);

  if (classification.classification === "NEEDS_REVIEW") {
    return blocked(asset, policy, classification.reasonCodes, steps);
  }

  // Classification passed, so cost is valid (finite, integer, non-negative).
  const cost = asset.costSatang as number;
  const internalIssues = sourceInternalIssues(asset, cost);

  // Explicitly non-depreciated report cases (no reported depreciation figures).
  if (classification.reasonCodes.includes(REASON.LAND_NON_DEPRECIABLE)) {
    return nonDepreciated(asset, policy, [REASON.NON_DEPRECIABLE_BY_RULE, REASON.LAND_NON_DEPRECIABLE, ...internalIssues], steps);
  }
  if (classification.reasonCodes.includes(REASON.BELOW_THRESHOLD)) {
    return nonDepreciated(asset, policy, [REASON.NOT_DEPRECIATED_BELOW_THRESHOLD, ...internalIssues], steps);
  }
  if (classification.reasonCodes.includes(REASON.EQUIPMENT_BEFORE_FY2560)) {
    return nonDepreciated(asset, policy, [REASON.NOT_DEPRECIATED_EQUIPMENT_BEFORE_FY2560, ...internalIssues], steps);
  }
  if (classification.classification === "EXCLUDED") {
    return nonDepreciated(asset, policy, [REASON.OUT_OF_REPORT_SCOPE, ...internalIssues], steps);
  }

  // A malformed residual would let accumulated depreciation exceed cost — block.
  if (!isValidResidualPolicy(policy.residualBookValueSatang)) {
    return blocked(asset, policy, [REASON.INVALID_RESIDUAL_POLICY], steps);
  }

  const timing = resolveTiming(asset, policy);
  if (!timing.ok) return blocked(asset, policy, [timing.blocking], steps);
  const { life, rangeMin, rangeMax, elapsedMonths } = timing;
  steps.push(`usefulLifeYears=${life} (range ${rangeMin}-${rangeMax})`);
  steps.push(`elapsedMonths=${elapsedMonths} (day15Rule=${policy.acquisitionDay15Rule ?? "n/a"})`);

  const line = straightLine(cost, life, elapsedMonths, policy);
  steps.push(
    `annual=${line.annual} monthly=${line.monthly} accumulated=${line.accumulated}` +
      ` (stage=${policy.roundingStage}, mode=${policy.roundingMode}, capped=${line.capped})`,
  );

  const evidence: DepreciationEvidence = {
    usefulLifeYearsUsed: life,
    depreciationRateAnnualPctUsed: line.ratePct,
    elapsedMonths,
    isPastUsefulLife: elapsedMonths >= life * 12,
    annualDepreciationSatang: line.annual,
    monthlyDepreciationSatang: line.monthly,
    accumulatedDepreciationSatang: line.accumulated,
    residualBookValueSatang: line.residual,
    netBookValueSatang: line.net,
    cappedAtResidual: line.capped,
  };

  const sourceIssues: ReasonCode[] = [
    ...internalIssues,
    ...sourceConsistencyIssues(asset, life, line.ratePct, line.accumulated),
  ];
  const srcNbv = asset.sourceNetBookValueSatang;
  if (srcNbv !== undefined && srcNbv !== null && Number.isFinite(srcNbv) && Math.abs(srcNbv - line.net) > VARIANCE_TOLERANCE_SATANG) {
    sourceIssues.push(REASON.SOURCE_NBV_VS_CALC_VARIANCE);
  }

  // A fully depreciated asset is reported in สท.3: it must NOT be shown as
  // actively depreciating. Its arithmetic is exposed only as evidence.
  if (classification.reasonCodes.includes(REASON.FULLY_DEPRECIATED)) {
    return nonDepreciated(asset, policy, [REASON.FULLY_DEPRECIATED, ...sourceIssues], steps, evidence);
  }

  // In scope for สท.2 — actively depreciated.
  const reasonCodes: ReasonCode[] = [...classification.reasonCodes, ...sourceIssues];
  if (line.capped) reasonCodes.push(REASON.DEPRECIATION_CAPPED_AT_RESIDUAL);

  return {
    rowKey: asset.rowKey,
    shouldDepreciate: true,
    usefulLifeYearsUsed: life,
    depreciationRateAnnualPctUsed: line.ratePct,
    annualDepreciationSatang: line.annual,
    monthlyDepreciationSatang: line.monthly,
    elapsedMonths,
    accumulatedDepreciationSatang: line.accumulated,
    residualBookValueSatang: line.residual,
    netBookValueSatang: line.net,
    evidence,
    reasonCodes,
    explanation: explanationFor(reasonCodes),
    calculationSteps: steps,
    blockingIssues: [],
    depreciationRuleVersion: policy.depreciationRuleVersion,
  };
}
