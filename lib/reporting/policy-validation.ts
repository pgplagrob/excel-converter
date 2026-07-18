// Schema validation for reporting policy / organization metadata received
// from the client. Never trusts client input: unknown enum values, missing
// required fields, and out-of-range numbers are all rejected with a
// field-specific message. This is intentionally independent from
// lib/export-request.ts (which validates the pre-existing Template-50
// request shape) so neither has to change to accommodate the other.

import { isValidIsoDate } from "../domain/fiscal";
import type {
  Day15Rule,
  OrganizationMetadata,
  ReportingPolicy,
  RoundingStage,
  UsefulLifeSelectionPolicy,
} from "../domain/types";
import { USEFUL_LIFE_TABLE, type UsefulLifeCategoryKey } from "../domain/useful-life";
import type { RoundingMode } from "../domain/money";

export class PolicyValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "PolicyValidationError";
    this.field = field;
  }
}

const DAY15_RULES = new Set<Day15Rule>(["count-month", "exclude-month"]);
const USEFUL_LIFE_POLICIES = new Set<UsefulLifeSelectionPolicy>(["minimum", "maximum", "explicit-per-category"]);
const ROUNDING_MODES = new Set<RoundingMode>(["half-up", "half-even", "truncate"]);
const ROUNDING_STAGES = new Set<RoundingStage>(["final-only", "per-year", "per-month"]);
const USEFUL_LIFE_KEYS = new Set<string>(Object.keys(USEFUL_LIFE_TABLE));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string, maxLength = 255): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PolicyValidationError(field, `${field} must be a non-empty string.`);
  }
  if (value.length > maxLength) throw new PolicyValidationError(field, `${field} is too long.`);
  return value;
}

function requireInteger(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new PolicyValidationError(field, `${field} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

/**
 * Parse and validate a client-supplied ReportingPolicy. Every enum-like field
 * is required with no default — the caller decides what "not yet chosen"
 * means (typically: block report generation, but do not block Template-50).
 */
export function parseReportingPolicy(value: unknown): ReportingPolicy {
  if (!isRecord(value)) throw new PolicyValidationError("reportingPolicy", "reportingPolicy must be an object.");

  const fiscalYearBE = requireInteger(value.fiscalYearBE, "reportingPolicy.fiscalYearBE", 2400, 2700);

  const cutoffDateISO = requireString(value.cutoffDateISO, "reportingPolicy.cutoffDateISO", 10);
  if (!isValidIsoDate(cutoffDateISO)) {
    throw new PolicyValidationError("reportingPolicy.cutoffDateISO", "cutoffDateISO must be a valid YYYY-MM-DD date.");
  }

  let acquisitionDay15Rule: Day15Rule | undefined;
  if (value.acquisitionDay15Rule !== undefined && value.acquisitionDay15Rule !== null) {
    if (!DAY15_RULES.has(value.acquisitionDay15Rule as Day15Rule)) {
      throw new PolicyValidationError(
        "reportingPolicy.acquisitionDay15Rule",
        "acquisitionDay15Rule must be count-month or exclude-month.",
      );
    }
    acquisitionDay15Rule = value.acquisitionDay15Rule as Day15Rule;
  }

  if (!USEFUL_LIFE_POLICIES.has(value.usefulLifeSelectionPolicy as UsefulLifeSelectionPolicy)) {
    throw new PolicyValidationError(
      "reportingPolicy.usefulLifeSelectionPolicy",
      "usefulLifeSelectionPolicy must be minimum, maximum, or explicit-per-category.",
    );
  }
  const usefulLifeSelectionPolicy = value.usefulLifeSelectionPolicy as UsefulLifeSelectionPolicy;

  const usefulLifeOverridesByCategory: ReportingPolicy["usefulLifeOverridesByCategory"] = {};
  if (value.usefulLifeOverridesByCategory !== undefined) {
    if (!isRecord(value.usefulLifeOverridesByCategory)) {
      throw new PolicyValidationError(
        "reportingPolicy.usefulLifeOverridesByCategory",
        "usefulLifeOverridesByCategory must be an object.",
      );
    }
    for (const [key, entry] of Object.entries(value.usefulLifeOverridesByCategory)) {
      const field = `reportingPolicy.usefulLifeOverridesByCategory.${key}`;
      if (!USEFUL_LIFE_KEYS.has(key)) {
        throw new PolicyValidationError(field, `${key} is not a known useful-life category.`);
      }
      if (!isRecord(entry)) throw new PolicyValidationError(field, `${field} must be an object.`);
      const table = USEFUL_LIFE_TABLE[key as UsefulLifeCategoryKey];
      const years = requireInteger(entry.years, `${field}.years`, 1, 100);
      if (years < table.minYears || years > table.maxYears) {
        throw new PolicyValidationError(
          `${field}.years`,
          `${key}: years must be between ${table.minYears} and ${table.maxYears} per the manual.`,
        );
      }
      const source = requireString(entry.source, `${field}.source`, 500);
      usefulLifeOverridesByCategory[key as UsefulLifeCategoryKey] = {
        years,
        rangeMin: table.minYears,
        rangeMax: table.maxYears,
        source,
        reason: typeof entry.reason === "string" ? entry.reason : undefined,
        approver: typeof entry.approver === "string" ? entry.approver : undefined,
      };
    }
  }

  const residualBookValueSatang = requireInteger(
    value.residualBookValueSatang,
    "reportingPolicy.residualBookValueSatang",
    0,
    1_000_000_00,
  );

  if (!ROUNDING_MODES.has(value.roundingMode as RoundingMode)) {
    throw new PolicyValidationError(
      "reportingPolicy.roundingMode",
      "roundingMode must be half-up, half-even, or truncate.",
    );
  }
  const roundingMode = value.roundingMode as RoundingMode;

  if (!ROUNDING_STAGES.has(value.roundingStage as RoundingStage)) {
    throw new PolicyValidationError(
      "reportingPolicy.roundingStage",
      "roundingStage must be final-only, per-year, or per-month.",
    );
  }
  const roundingStage = value.roundingStage as RoundingStage;

  const classificationVersion = requireString(value.classificationVersion, "reportingPolicy.classificationVersion", 100);
  const depreciationRuleVersion = requireString(value.depreciationRuleVersion, "reportingPolicy.depreciationRuleVersion", 100);

  return {
    fiscalYearBE,
    cutoffDateISO,
    acquisitionDay15Rule,
    usefulLifeSelectionPolicy,
    usefulLifeOverridesByCategory,
    residualBookValueSatang,
    roundingMode,
    roundingStage,
    classificationVersion,
    depreciationRuleVersion,
  };
}

export function parseOrganizationMetadata(value: unknown): OrganizationMetadata {
  if (!isRecord(value)) {
    throw new PolicyValidationError("organizationMetadata", "organizationMetadata must be an object.");
  }
  return {
    organizationName: requireString(value.organizationName, "organizationMetadata.organizationName"),
    district: requireString(value.district, "organizationMetadata.district"),
    province: requireString(value.province, "organizationMetadata.province"),
    postalCode: requireString(value.postalCode, "organizationMetadata.postalCode", 10),
    contactName: requireString(value.contactName, "organizationMetadata.contactName"),
    contactPosition: requireString(value.contactPosition, "organizationMetadata.contactPosition"),
    phone: requireString(value.phone, "organizationMetadata.phone", 50),
    fax: typeof value.fax === "string" ? value.fax : "",
  };
}

/**
 * True if at least one asset in the workbook was acquired on the 15th of its
 * month. Only when this is true does the day-15 policy become mandatory —
 * per spec, users must never be forced to pick a policy nobody's data needs.
 */
export function anyAssetAcquiredOnDay15(acquisitionDatesISO: (string | null | undefined)[]): boolean {
  return acquisitionDatesISO.some((iso) => {
    if (!iso) return false;
    const day = Number(iso.slice(8, 10));
    return day === 15;
  });
}
