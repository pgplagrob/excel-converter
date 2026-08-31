import type { MappingSuggestion } from "./mapping";
import type { ManualMapping } from "./manual-mapping";
import type { SheetEligibility } from "./datasource";
import type { SheetStatus, SheetSummary, ValidationIssue } from "./validate";

export type { MappingSuggestion, SheetStatus, SheetSummary, ValidationIssue };

export type MappingMethod = MappingSuggestion["method"];
export type ExportMode = "validate" | "download";
export type CellOverrides = Record<number, Record<string, string>>;
export type CellOverridesBySheet = Record<string, CellOverrides>;
export type ExcludedRowsBySheet = Record<string, number[]>;

export interface SheetData {
  sheetName: string;
  sourceProfile?: string;
  profileDebug?: unknown;
  headerRowIndex: number;
  summary: SheetSummary;
  headers: string[];
  rowCount: number;
  eligibility: SheetEligibility;
  eligibilityReason: string;
  confidence: number;
  groupedAssets?: unknown[];
  warnings?: string[];
  rawPreviewRows: any[][];
  sampleRows: Record<string, any>[];
  rows: Record<string, any>[];
  templateSampleRows?: Record<string, any>[];
  mapping: MappingSuggestion[];
}

export interface SheetOverview {
  sheetName: string;
  sourceProfile: string;
  detectedProfile: string;
  eligibility: SheetEligibility;
  reason: string;
  rowCount: number;
  errorCount: number;
  warningCount: number;
  confidence: number;
  parsedSheetIndex?: number;
}

export interface ParseResponse {
  analysisId?: string;
  fileName: string;
  sheets: SheetData[];
  preservedSheets: string[];
  preservedSheetSummaries: SheetSummary[];
  skippedSheets: string[];
  skippedSheetSummaries: SheetSummary[];
  sheetOverview: SheetOverview[];
  sheetProfileDebug?: unknown[];
  error?: string;
}

export interface ExportSheetInput {
  sheetName: string;
  eligibility?: SheetEligibility;
  rows?: Record<string, unknown>[];
  headerRow?: number;
  autoMapping?: MappingSuggestion[];
  manualMapping?: ManualMapping;
  mapping?: Record<string, string | null>;
  cellOverrides?: CellOverrides;
  excludedRows?: number[];
}

export interface ExportRequest {
  mode?: ExportMode;
  analysisId?: string;
  sourceFileName?: string;
  sheets?: ExportSheetInput[];
}

export interface IssueSummary {
  errorCount: number;
  warningCount: number;
  totalRows: number;
}

export interface TransformedSheetPreview {
  sheetName: string;
  rowCount: number;
  sampleRows: Record<string, any>[];
  eligibility?: string;
}

export interface ExportValidationResponse extends IssueSummary {
  issues: ValidationIssue[];
  sheetSummaries: SheetSummary[];
  transformedSheets: TransformedSheetPreview[];
  error?: string;
}
