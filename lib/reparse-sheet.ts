import type { AnalysisRecord } from "./analysis-store";
import { appendDataQualityWarnings } from "./datasource/data-quality";
import { parseFlexibleAssetSheet } from "./datasource/parsers/flexible";
import type { DataSourceSheet, FlexibleAssetLayout, SheetProfileDebug } from "./datasource/types";
import type { WorkbookSheetMatrix } from "./excel";
import {
  type ReparseSheetRequest,
  validateReparseSheetBounds,
} from "./reparse-request";

export class ReparseSheetOperationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ReparseSheetOperationError";
  }
}

export interface ReparsedAnalysisSheet {
  sheet: DataSourceSheet;
  sourceSheet: WorkbookSheetMatrix;
}

export function reparseStoredAnalysisSheet(
  analysis: AnalysisRecord,
  request: ReparseSheetRequest,
): ReparsedAnalysisSheet {
  const sourceSheet = analysis.sourceWorkbookSheets?.find(
    (sheet) => sheet.sheetName === request.sheetName,
  );
  if (!sourceSheet) {
    throw new ReparseSheetOperationError("ไม่พบชีตต้นฉบับที่ต้องการวิเคราะห์ใหม่", 404);
  }

  const parsedSheetIndex = analysis.dataSource.sheets.findIndex(
    (sheet) => sheet.sheetName === request.sheetName,
  );
  if (parsedSheetIndex < 0) {
    throw new ReparseSheetOperationError(
      "ชีตนี้ไม่ได้อยู่ในชุดชีตที่วิเคราะห์ไว้ จึงไม่สามารถปักหมุด header ได้",
      400,
    );
  }

  validateReparseSheetBounds(request, sourceSheet.matrix.length);

  const forcedLayout: FlexibleAssetLayout = {
    kind: "standard-table",
    confidence: 1,
    headerRowIndex: request.headerRow - 1,
    dataStartRowIndex: request.dataStartRow !== undefined
      ? request.dataStartRow - 1
      : undefined,
    dataEndRowIndex: request.dataEndRow,
  };
  const previousSheet = analysis.dataSource.sheets[parsedSheetIndex];
  const sheet = parseFlexibleAssetSheet(request.sheetName, sourceSheet.matrix, forcedLayout);
  appendDataQualityWarnings(sheet, sourceSheet.matrix);

  const reason = "manual header/range pin — pending validation";
  sheet.eligibility = "needsReview";
  sheet.eligibilityReason = reason;

  const previousDebug = previousSheet.profileDebug ?? analysis.dataSource.profileDebug.find(
    (debug) => debug.sheetName === request.sheetName,
  );
  const profileDebug: SheetProfileDebug = {
    sheetName: request.sheetName,
    profile: previousDebug?.profile ?? "unknown",
    headerRowIndex: request.headerRow - 1,
    confidence: 1,
    reasons: [
      ...(previousDebug?.reasons ?? []),
      `manual override: header row ${request.headerRow}` +
        `${request.dataStartRow !== undefined ? `, data start row ${request.dataStartRow}` : ""}` +
        `${request.dataEndRow !== undefined ? `, data end row ${request.dataEndRow}` : ""}`,
    ],
    shouldParse: true,
    legacySourceProfile: "FLEXIBLE_ASSET_TABLE",
    eligibility: "needsReview",
    decisionReason: reason,
    manuallyPinned: true,
  };
  sheet.profileDebug = profileDebug;

  analysis.dataSource.sheets[parsedSheetIndex] = sheet;
  const debugIndex = analysis.dataSource.profileDebug.findIndex(
    (debug) => debug.sheetName === request.sheetName,
  );
  if (debugIndex >= 0) analysis.dataSource.profileDebug[debugIndex] = profileDebug;

  return { sheet, sourceSheet };
}
