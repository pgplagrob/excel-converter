// Core domain types for the asset valuation / depreciation / reporting layer.
//
// These types are pure data contracts.  Nothing in lib/domain may import
// React, Next.js route handlers, or ExcelJS.  Calculated values must never be
// written back onto a NormalizedAsset (prompt section 10): the engines take a
// read-only asset plus a policy and return a fresh CalculatedAsset.

import type { RoundingMode } from "./money";
import type { ReasonCode } from "./reason-codes";
import type { UsefulLifeCategoryKey } from "./useful-life";

/** The eight top-level asset groups from the manual's classification table (ch.2). */
export type AssetGroup =
  | "LAND" // ที่ดิน
  | "BUILDING" // อาคาร
  | "STRUCTURE" // สิ่งปลูกสร้าง
  | "EQUIPMENT" // ครุภัณฑ์
  | "INFRASTRUCTURE" // สินทรัพย์โครงสร้างพื้นฐาน
  | "INTANGIBLE" // สินทรัพย์ไม่มีตัวตน
  | "INVESTMENT_PROPERTY" // อสังหาริมทรัพย์เพื่อการลงทุน
  | "LEASED_ASSET"; // สินทรัพย์ภายใต้สัญญาเช่าการเงิน

/** Report classification outcome (discriminated by `classification`). */
export type ReportClass = "SOR_THOR_2" | "SOR_THOR_3" | "EXCLUDED" | "NEEDS_REVIEW";

export type Day15Rule = "count-month" | "exclude-month";
export type UsefulLifeSelectionPolicy = "minimum" | "maximum" | "explicit-per-category";
export type RoundingStage = "per-month" | "per-year" | "final-only";

/** An explicit per-category useful-life choice recorded for the Audit sheet. */
export interface UsefulLifeOverride {
  years: number;
  rangeMin: number;
  rangeMax: number;
  source: string;
  reason?: string;
  approver?: string;
}

/**
 * Reporting policy.  Values marked "open decision" in the Phase 1 report are
 * required inputs here — the engines block (NEEDS_REVIEW / blocking issue)
 * when a needed policy value is absent rather than silently defaulting.
 */
export interface ReportingPolicy {
  fiscalYearBE: number; // e.g. 2567
  cutoffDateISO: string; // canonical Gregorian "YYYY-MM-DD" (e.g. 30 Sep = "2024-09-30")
  acquisitionDay15Rule?: Day15Rule; // undefined => block when acquisition day === 15
  usefulLifeSelectionPolicy: UsefulLifeSelectionPolicy;
  usefulLifeOverridesByCategory: Partial<Record<UsefulLifeCategoryKey, UsefulLifeOverride>>;
  residualBookValueSatang: number; // manual default = 100 (1 baht)
  roundingMode: RoundingMode;
  roundingStage: RoundingStage;
  classificationVersion: string;
  depreciationRuleVersion: string;
}

export interface OrganizationMetadata {
  organizationName: string;
  district: string; // อำเภอ
  province: string; // จังหวัด
  postalCode: string; // รหัสไปรษณีย์
  contactName: string; // ชื่อเจ้าหน้าที่ประสานงาน
  contactPosition: string; // ตำแหน่ง
  phone: string;
  fax: string;
}

/**
 * Read-only normalized source asset.  The mapping of raw source text to
 * `assetGroup` / `usefulLifeCategoryKey` is a separate policy layer (P1); when
 * these are absent the engines return NEEDS_REVIEW instead of guessing.
 */
export interface NormalizedAsset {
  rowKey: string;
  sourceFile: string;
  sourceSheet: string;
  sourceExcelRow: number;

  assetCode: string;
  assetName: string;
  unit?: string;

  assetGroup?: AssetGroup;
  usefulLifeCategoryKey?: UsefulLifeCategoryKey;

  acquisitionDateISO?: string | null; // canonical Gregorian
  costSatang?: number | null;

  // Source-provided values kept only for comparison (never overwrite calc).
  sourceUsefulLifeYears?: number | null;
  sourceDepreciationRateAnnualPct?: number | null;
  sourceAccumulatedDepreciationSatang?: number | null;
  sourceNetBookValueSatang?: number | null;

  raw?: Record<string, unknown>;
}

export interface ClassificationResult {
  rowKey: string;
  classification: ReportClass;
  reasonCodes: ReasonCode[];
  explanation: string;
  evaluatedRules: string[];
  missingFields: string[];
  classificationVersion: string;
}

/**
 * Straight-line calculation evidence. This is diagnostic arithmetic — it
 * justifies decisions such as "fully depreciated" and lets a reviewer audit the
 * numbers. It is NOT what a report prints; only assets with
 * `shouldDepreciate === true` contribute depreciation figures to สท.2/สท.1.
 */
export interface DepreciationEvidence {
  usefulLifeYearsUsed: number;
  depreciationRateAnnualPctUsed: number;
  elapsedMonths: number;
  isPastUsefulLife: boolean;
  annualDepreciationSatang: number;
  monthlyDepreciationSatang: number;
  accumulatedDepreciationSatang: number; // capped at cost - residual
  residualBookValueSatang: number;
  netBookValueSatang: number;
  cappedAtResidual: boolean;
}

export interface DepreciationResult {
  rowKey: string;

  /**
   * True only for assets actively depreciated in สท.2 (in-scope, non-land).
   * Land and every สท.3 case (below threshold, equipment-before-FY2560, fully
   * depreciated) are false — those must never appear as actively depreciating.
   */
  shouldDepreciate: boolean;

  // --- reported figures (meaningful only when shouldDepreciate === true) ---
  usefulLifeYearsUsed?: number;
  depreciationRateAnnualPctUsed?: number;
  annualDepreciationSatang?: number;
  monthlyDepreciationSatang?: number;
  elapsedMonths?: number;
  accumulatedDepreciationSatang?: number;
  residualBookValueSatang?: number;
  netBookValueSatang?: number;

  /** Diagnostic arithmetic, separate from the reported figures above. */
  evidence?: DepreciationEvidence;

  reasonCodes: ReasonCode[];
  explanation: string;
  calculationSteps: string[];
  blockingIssues: ReasonCode[];

  depreciationRuleVersion: string;
}
