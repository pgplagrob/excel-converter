// Schema validation for the P1 export-request additions: selectedOutputs,
// categoryMappings, rowOverrides, referenceOverrides. Kept separate from
// lib/export-request.ts (which owns the pre-existing Template-50 shape) and
// from policy-validation.ts (which owns ReportingPolicy/OrganizationMetadata).
// Every field is validated; unknown enum values are rejected; nothing here
// trusts client input beyond its literal, checked shape.

import type { AssetGroup, ReportClass, ReportingPolicy } from "../domain/types";
import { USEFUL_LIFE_TABLE, type UsefulLifeCategoryKey } from "../domain/useful-life";
import { TEMPLATE_COLUMNS } from "../mapping";
import { parseReportingPolicy, PolicyValidationError } from "./policy-validation";
import type { SeverityFilter } from "./preview-query";
import { ALL_SELECTED_OUTPUTS, type SelectedOutput } from "./types";
import type { CategoryMappingOverride, ReferenceOverride, RowOverride, RowOverrideField, RowOverrideInput } from "./types";

const MAX_ARRAY_LENGTH = 5000;
const ASSET_GROUPS = new Set<AssetGroup>([
  "LAND",
  "BUILDING",
  "STRUCTURE",
  "EQUIPMENT",
  "INFRASTRUCTURE",
  "INTANGIBLE",
  "INVESTMENT_PROPERTY",
  "LEASED_ASSET",
]);
const USEFUL_LIFE_KEYS = new Set<string>(Object.keys(USEFUL_LIFE_TABLE));
const ROW_OVERRIDE_FIELDS = new Set<RowOverrideField>([
  "assetGroup",
  "usefulLifeCategoryKey",
  "acquisitionDateISO",
  "costSatang",
]);
const SELECTED_OUTPUTS_SET = new Set<SelectedOutput>(ALL_SELECTED_OUTPUTS);
const TEMPLATE_COLUMN_SET = new Set(TEMPLATE_COLUMNS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new PolicyValidationError(field, `${field} must be an array.`);
  if (value.length > MAX_ARRAY_LENGTH) throw new PolicyValidationError(field, `${field} has too many entries.`);
  return value;
}

function requireString(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PolicyValidationError(field, `${field} must be a non-empty string.`);
  }
  if (value.length > maxLength) throw new PolicyValidationError(field, `${field} is too long.`);
  return value;
}

export function parseSelectedOutputs(value: unknown): SelectedOutput[] {
  const items = requireArray(value, "selectedOutputs");
  if (!items.length) throw new PolicyValidationError("selectedOutputs", "selectedOutputs must not be empty.");
  return items.map((item, index) => {
    if (!SELECTED_OUTPUTS_SET.has(item as SelectedOutput)) {
      throw new PolicyValidationError(`selectedOutputs[${index}]`, `Unknown output: ${String(item)}.`);
    }
    return item as SelectedOutput;
  });
}

export function parseCategoryMappingOverrides(value: unknown): CategoryMappingOverride[] {
  const items = requireArray(value, "categoryMappings");
  return items.map((item, index) => {
    const field = `categoryMappings[${index}]`;
    if (!isRecord(item)) throw new PolicyValidationError(field, `${field} must be an object.`);
    const sourceValue = requireString(item.sourceValue, `${field}.sourceValue`);
    if (!ASSET_GROUPS.has(item.assetGroup as AssetGroup)) {
      throw new PolicyValidationError(`${field}.assetGroup`, `${field}.assetGroup is not a known asset group.`);
    }
    const assetGroup = item.assetGroup as AssetGroup;
    let usefulLifeCategoryKey: UsefulLifeCategoryKey | undefined;
    if (item.usefulLifeCategoryKey !== undefined && item.usefulLifeCategoryKey !== null) {
      if (!USEFUL_LIFE_KEYS.has(item.usefulLifeCategoryKey as string)) {
        throw new PolicyValidationError(
          `${field}.usefulLifeCategoryKey`,
          `${field}.usefulLifeCategoryKey is not a known useful-life category.`,
        );
      }
      usefulLifeCategoryKey = item.usefulLifeCategoryKey as UsefulLifeCategoryKey;
    }
    return {
      sourceValue,
      assetGroup,
      usefulLifeCategoryKey,
      approvedBy: typeof item.approvedBy === "string" ? item.approvedBy : undefined,
      note: typeof item.note === "string" ? item.note : undefined,
    };
  });
}

export function parseRowOverrideInputs(value: unknown): RowOverrideInput[] {
  const items = requireArray(value, "rowOverrides");
  return items.map((item, index) => {
    const field = `rowOverrides[${index}]`;
    if (!isRecord(item)) throw new PolicyValidationError(field, `${field} must be an object.`);
    const rowKey = requireString(item.rowKey, `${field}.rowKey`, 1000);
    if (!ROW_OVERRIDE_FIELDS.has(item.field as RowOverrideField)) {
      throw new PolicyValidationError(`${field}.field`, `${field}.field must be one of: ${[...ROW_OVERRIDE_FIELDS].join(", ")}.`);
    }
    const overrideField = item.field as RowOverrideField;
    if (typeof item.overrideValue !== "string" && typeof item.overrideValue !== "number") {
      throw new PolicyValidationError(`${field}.overrideValue`, `${field}.overrideValue must be a string or number.`);
    }
    return {
      rowKey,
      field: overrideField,
      overrideValue: item.overrideValue,
      reason: typeof item.reason === "string" ? item.reason : undefined,
    };
  });
}

/** Server-side stamping — the client never controls the audit timestamp. */
export function stampRowOverrides(inputs: RowOverrideInput[], now: () => string = () => new Date().toISOString()): RowOverride[] {
  return inputs.map((input) => ({ ...input, timestamp: now() }));
}

/**
 * Reject any row override that references a row key not present in the
 * analysis (prevents forged provenance pointing at nonexistent rows).
 */
export function validateRowOverridesAgainstRowKeys(overrides: RowOverride[], knownRowKeys: Set<string>): void {
  overrides.forEach((override, index) => {
    if (!knownRowKeys.has(override.rowKey)) {
      throw new PolicyValidationError(
        `rowOverrides[${index}].rowKey`,
        `rowOverrides[${index}].rowKey does not reference a row in this analysis.`,
      );
    }
  });
}

const REPORT_CLASSES = new Set<ReportClass>(["SOR_THOR_2", "SOR_THOR_3", "EXCLUDED", "NEEDS_REVIEW"]);
const SEVERITY_FILTERS = new Set<SeverityFilter>(["error", "warning", "needsReview"]);
const MAX_SEARCH_LENGTH = 200;

export interface PreviewRequestParsed {
  analysisId: string;
  policy: ReportingPolicy;
  categoryMappings: CategoryMappingOverride[];
  rowOverrides: RowOverrideInput[];
  page?: number;
  pageSize?: number;
  classification?: ReportClass[];
  severity?: SeverityFilter[];
  search?: string;
}

/**
 * Validate a calculated-preview request body. `analysisId` is the sole
 * source of truth for which rows exist — the client never supplies raw rows.
 */
export function parsePreviewRequest(value: unknown): PreviewRequestParsed {
  if (!isRecord(value)) throw new PolicyValidationError("body", "Request body must be a JSON object.");

  const analysisId = requireString(value.analysisId, "analysisId", 128);
  const policy = parseReportingPolicy(value.reportingPolicy);
  const categoryMappings = value.categoryMappings !== undefined ? parseCategoryMappingOverrides(value.categoryMappings) : [];
  const rowOverrides = value.rowOverrides !== undefined ? parseRowOverrideInputs(value.rowOverrides) : [];

  let page: number | undefined;
  if (value.page !== undefined) {
    if (typeof value.page !== "number" || !Number.isInteger(value.page) || value.page < 1) {
      throw new PolicyValidationError("page", "page must be a positive integer.");
    }
    page = value.page;
  }

  let pageSize: number | undefined;
  if (value.pageSize !== undefined) {
    if (typeof value.pageSize !== "number" || !Number.isInteger(value.pageSize) || value.pageSize < 1 || value.pageSize > 100) {
      throw new PolicyValidationError("pageSize", "pageSize must be an integer between 1 and 100.");
    }
    pageSize = value.pageSize;
  }

  let classification: ReportClass[] | undefined;
  if (value.classification !== undefined) {
    const items = requireArray(value.classification, "classification");
    classification = items.map((item, index) => {
      if (!REPORT_CLASSES.has(item as ReportClass)) {
        throw new PolicyValidationError(`classification[${index}]`, `Unknown classification: ${String(item)}.`);
      }
      return item as ReportClass;
    });
  }

  let severity: SeverityFilter[] | undefined;
  if (value.severity !== undefined) {
    const items = requireArray(value.severity, "severity");
    severity = items.map((item, index) => {
      if (!SEVERITY_FILTERS.has(item as SeverityFilter)) {
        throw new PolicyValidationError(`severity[${index}]`, `Unknown severity: ${String(item)}.`);
      }
      return item as SeverityFilter;
    });
  }

  let search: string | undefined;
  if (value.search !== undefined) {
    if (typeof value.search !== "string") throw new PolicyValidationError("search", "search must be a string.");
    if (value.search.length > MAX_SEARCH_LENGTH) throw new PolicyValidationError("search", "search is too long.");
    search = value.search;
  }

  return { analysisId, policy, categoryMappings, rowOverrides, page, pageSize, classification, severity, search };
}

export function parseReferenceOverrides(value: unknown): ReferenceOverride[] {
  const items = requireArray(value, "referenceOverrides");
  return items.map((item, index) => {
    const field = `referenceOverrides[${index}]`;
    if (!isRecord(item)) throw new PolicyValidationError(field, `${field} must be an object.`);
    const templateColumn = requireString(item.templateColumn, `${field}.templateColumn`);
    if (!TEMPLATE_COLUMN_SET.has(templateColumn)) {
      throw new PolicyValidationError(`${field}.templateColumn`, `${field}.templateColumn is not a known template column.`);
    }
    return {
      templateColumn,
      sourceValue: requireString(item.sourceValue, `${field}.sourceValue`),
      canonicalValue: requireString(item.canonicalValue, `${field}.canonicalValue`),
      approvedBy: typeof item.approvedBy === "string" ? item.approvedBy : undefined,
    };
  });
}
