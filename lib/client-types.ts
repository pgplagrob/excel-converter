import type { MappingSuggestion } from "./mapping";
import type { SheetEligibility } from "./datasource";
import type { SheetStatus, SheetSummary, ValidationIssue } from "./validate";

export type { MappingSuggestion, SheetStatus, SheetSummary, ValidationIssue };

export type MappingMethod = MappingSuggestion["method"];
export type ExportMode = "validate" | "download";

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
  sampleRows: Record<string, any>[];
  rows: Record<string, any>[];
  mapping: MappingSuggestion[];
}

export interface ParseResponse {
  analysisId?: string;
  fileName: string;
  sheets: SheetData[];
  skippedSheets: string[];
  skippedSheetSummaries: SheetSummary[];
  sheetProfileDebug?: unknown[];
  error?: string;
}

export interface ExportSheetInput {
  sheetName: string;
  eligibility?: SheetEligibility;
  rows: Record<string, any>[];
  headerRow?: number;
  autoMapping?: MappingSuggestion[];
  manualMapping?: Record<string, string | null>;
  mapping?: Record<string, string | null>;
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

export interface ExportValidationResponse extends IssueSummary {
  issues: ValidationIssue[];
  sheetSummaries: SheetSummary[];
  transformedSheets: {
    sheetName: string;
    rowCount: number;
    sampleRows: Record<string, any>[];
  }[];
  error?: string;
}
