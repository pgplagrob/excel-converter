import type { SheetData, ValidationIssue } from "./client-types";
import type { DataSourceSheet, SheetEligibility } from "./datasource";
import {
  applyMappingProfile,
  mappingSuggestionsToRecord,
  suggestMapping,
} from "./mapping";
import type { AssetTemplateMetadata } from "./template";
import { transformRowsToTemplateDataset } from "./transform";
import { createSheetSummary, validateMappedRows, validateSheetLevel } from "./validate";

export function buildSheetData(
  sheet: DataSourceSheet,
  template: AssetTemplateMetadata,
  rawMatrix: any[][] = [],
  profileMapping?: Record<string, string>,
): SheetData {
  const mapping = suggestMapping(sheet.headers);
  const mappingWithProfile = applyMappingProfile(mapping, sheet.headers, profileMapping);
  const parseWarnings: ValidationIssue[] = sheet.warnings.map((message) => ({
    sheetName: sheet.sheetName,
    rowIndex: -1,
    column: "sheet",
    message,
    severity: "warning",
  }));
  const mappingRecord = mappingSuggestionsToRecord(mappingWithProfile);
  const validationContext = {
    sourceProfile: sheet.sourceProfile,
    eligibility: sheet.eligibility,
  };
  const sheetLevelIssues = validateSheetLevel(
    sheet.sheetName,
    sheet.rows.length,
    sheet.headerRowIndex + 1,
    mappingRecord,
    sheet.rows,
    validationContext,
  );
  const mappedRows = sheet.eligibility === "preserved"
    ? []
    : transformRowsToTemplateDataset(sheet.rows, mappingRecord);
  const rowIssues = validateMappedRows(
    sheet.sheetName,
    mappedRows,
    sheet.rows,
    template.references,
    validationContext,
  );
  const validationIssues = [...parseWarnings, ...sheetLevelIssues, ...rowIssues];
  const errorCount = validationIssues.filter((issue) => issue.severity === "error").length;
  const finalEligibility: SheetEligibility =
    sheet.eligibility === "preserved" ||
    sheet.eligibility === "skipped" ||
    sheet.eligibility === "unsupported"
      ? sheet.eligibility
      : errorCount > 0 || sheet.eligibility === "needsReview"
        ? "needsReview"
        : "exportable";
  const eligibilityReason =
    finalEligibility === "exportable"
      ? "profile matched and validation has no errors"
      : errorCount > 0
        ? "validation found errors that must be reviewed"
        : sheet.eligibilityReason;
  sheet.eligibility = finalEligibility;
  sheet.eligibilityReason = eligibilityReason;
  if (sheet.profileDebug) {
    sheet.profileDebug.eligibility = finalEligibility;
    sheet.profileDebug.decisionReason = eligibilityReason;
  }

  return {
    sheetName: sheet.sheetName,
    sourceProfile: sheet.sourceProfile,
    profileDebug: sheet.profileDebug,
    headerRowIndex: sheet.headerRowIndex,
    summary: createSheetSummary(
      sheet.sheetName,
      sheet.rowCount,
      sheet.headerRowIndex + 1,
      validationIssues,
    ),
    headers: sheet.headers,
    rowCount: sheet.rowCount,
    eligibility: finalEligibility,
    eligibilityReason,
    confidence: sheet.confidence,
    groupedAssets: sheet.groupedAssets,
    warnings: sheet.warnings,
    rawPreviewRows: rawMatrix.slice(0, 40),
    sampleRows: sheet.rows.slice(0, 10),
    rows: sheet.rows.slice(0, 30),
    templateSampleRows: mappedRows.slice(0, 10),
    mapping: mappingWithProfile,
  };
}
