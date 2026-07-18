// Adapter: datasource sheet rows -> lib/domain NormalizedAsset.
//
// This is intentionally separate from lib/datasource/parsers/* (the parser
// layer) and from lib/transform.ts (the Template-50 mapper). It reads the
// same normalized/INTERNAL fields the parsers already populate, and performs
// NO structural re-parsing of the source sheet. Category resolution
// (source text -> AssetGroup/UsefulLifeCategoryKey) is intentionally left to
// lib/reporting/category-mapping.ts; this adapter only preserves the raw
// category text for that later step, so the assumption is never hidden here.

import {
  INTERNAL,
  normalizeThaiDate,
  SOURCE_ASSET_ITEM_COLUMN,
  SOURCE_ASSET_TYPE_COLUMN,
  SOURCE_EXCEL_ROW_COLUMN,
  SOURCE_ROW_KEY_COLUMN,
  SOURCE_SHEET_NAME_COLUMN,
} from "../datasource";
import type { NormalizedAsset } from "../domain/types";

function text(value: unknown): string {
  return value === undefined || value === null ? "" : value.toString().trim();
}

function firstNonEmpty(...values: unknown[]): unknown {
  for (const value of values) {
    if (text(value)) return value;
  }
  return undefined;
}

/** Two-digit day/month/year (Gregorian, from normalizeThaiDate) -> ISO. */
function ddmmyyyyToIso(ddmmyyyy: string): string | null {
  const match = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/**
 * Best-effort canonical ISO date. Returns:
 *  - a valid "YYYY-MM-DD" string when the source value parses,
 *  - null when the source field is present but unparseable (surfaces as
 *    INVALID_ACQUISITION_DATE downstream — never silently dropped),
 *  - undefined when the source field is genuinely empty (MISSING_ACQUISITION_DATE).
 */
export function resolveAcquisitionDateIso(rawValue: unknown): string | null | undefined {
  if (!text(rawValue)) return undefined;
  const normalized = normalizeThaiDate(rawValue);
  if (!normalized) return null;
  return ddmmyyyyToIso(normalized) ?? null;
}

/**
 * Best-effort cost in integer satang. Returns:
 *  - a finite integer when the source value parses as a number,
 *  - NaN when the source field is present but not a usable number (the
 *    domain layer's Number.isFinite check then reports INVALID_COST_NOT_FINITE),
 *  - undefined when the source field is genuinely empty (MISSING_COST).
 */
export function resolveCostSatang(rawValue: unknown): number | undefined {
  const raw = text(rawValue);
  if (!raw) return undefined;
  if (/^[\s\-–—]+$/.test(raw)) return undefined; // a lone dash means "no value"
  const numeric = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return Number.NaN;
  return Math.round(numeric * 100);
}

function parseOptionalNumber(rawValue: unknown): number | null | undefined {
  const raw = text(rawValue);
  if (!raw) return undefined;
  if (/^[\s\-–—]+$/.test(raw)) return undefined;
  const numeric = Number(raw.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseOptionalMoney(rawValue: unknown): number | null | undefined {
  const numeric = parseOptionalNumber(rawValue);
  if (numeric === undefined) return undefined;
  if (numeric === null) return null;
  return Math.round(numeric * 100);
}

export interface NormalizeAssetOptions {
  sourceFile: string;
  /**
   * Source column names resolved from the sheet's own mapping (the same
   * suggestMapping/mappingSuggestionsToRecord result used elsewhere in the
   * pipeline). Only template columns that already exist in the 50-column
   * template can be resolved this way: "หน่วยนับ" (unit), "อายุการใช้งาน"
   * (source useful life), and "ค่าเสื่อมสะสม ณ ยกมา" (source accumulated
   * depreciation brought forward). The template has no dedicated column for
   * a source depreciation rate or a source net book value, so those two
   * NormalizedAsset fields stay null unless a row override sets them.
   */
  mapping?: Record<string, string | null | undefined>;
}

function mappedValue(
  sourceRow: Record<string, unknown>,
  mapping: Record<string, string | null | undefined> | undefined,
  templateColumn: string,
): unknown {
  const sourceColumn = mapping?.[templateColumn];
  return sourceColumn ? sourceRow[sourceColumn] : undefined;
}

/**
 * Convert one already-parsed datasource row into a read-only NormalizedAsset.
 * The raw source category text (for category-mapping.ts) is preserved under
 * `raw.sourceCategoryText`, together with every original field for provenance.
 */
export function normalizeAssetRow(
  sourceRow: Record<string, unknown>,
  options: NormalizeAssetOptions,
): NormalizedAsset {
  const rowKey = text(sourceRow[SOURCE_ROW_KEY_COLUMN]);
  const sourceSheet = text(sourceRow[SOURCE_SHEET_NAME_COLUMN]);
  const sourceExcelRow = Number(sourceRow[SOURCE_EXCEL_ROW_COLUMN]) || 0;

  const assetCode = text(firstNonEmpty(sourceRow.assetCode, sourceRow[INTERNAL.assetCode]));
  const assetName = text(firstNonEmpty(sourceRow.assetName, sourceRow[INTERNAL.assetName]));

  const rawDate = firstNonEmpty(sourceRow.receivedDate, sourceRow[INTERNAL.receivedDate]);
  const acquisitionDateISO = resolveAcquisitionDateIso(rawDate);

  const rawCost = firstNonEmpty(sourceRow.value, sourceRow[INTERNAL.value]);
  const costSatang = resolveCostSatang(rawCost);

  const sourceCategoryText = text(
    firstNonEmpty(
      sourceRow[INTERNAL.assetCategory],
      sourceRow[SOURCE_ASSET_TYPE_COLUMN],
      sourceRow[SOURCE_ASSET_ITEM_COLUMN],
    ),
  );

  const unit = text(mappedValue(sourceRow, options.mapping, "หน่วยนับ"));
  const sourceUsefulLifeYears = parseOptionalNumber(mappedValue(sourceRow, options.mapping, "อายุการใช้งาน"));
  const sourceDepreciationRateAnnualPct: number | null | undefined = undefined; // no source column in the template
  const sourceAccumulatedDepreciationSatang = parseOptionalMoney(
    mappedValue(sourceRow, options.mapping, "ค่าเสื่อมสะสม ณ ยกมา"),
  );
  const sourceNetBookValueSatang: number | null | undefined = undefined; // no source column in the template

  return {
    rowKey,
    sourceFile: options.sourceFile,
    sourceSheet,
    sourceExcelRow,
    assetCode,
    assetName,
    unit: unit || undefined,
    acquisitionDateISO,
    costSatang,
    sourceUsefulLifeYears: sourceUsefulLifeYears ?? null,
    sourceDepreciationRateAnnualPct: sourceDepreciationRateAnnualPct ?? null,
    sourceAccumulatedDepreciationSatang: sourceAccumulatedDepreciationSatang ?? null,
    sourceNetBookValueSatang: sourceNetBookValueSatang ?? null,
    raw: { ...sourceRow, sourceCategoryText },
  };
}

export function normalizeSheetRows(
  rows: Record<string, unknown>[],
  options: NormalizeAssetOptions,
): NormalizedAsset[] {
  return rows.map((row) => normalizeAssetRow(row, options));
}
