import { NextRequest, NextResponse } from "next/server";
import type { ParseResponse, ValidationIssue } from "@/lib/client-types";
import { saveAnalysis } from "@/lib/analysis-store";
import type { SheetEligibility } from "@/lib/datasource";
import { createDataSourceWorkbook } from "@/lib/datasource";
import { readWorkbookBuffer, WorkbookLimitError } from "@/lib/excel";
import { mappingSuggestionsToRecord, suggestMapping } from "@/lib/mapping";
import { transformRowsToTemplateDataset } from "@/lib/transform";
import { loadAssetTemplateMetadata } from "@/lib/template";
import { createSheetSummary, validateMappedRows, validateSheetLevel } from "@/lib/validate";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;
const WORKBOOK_FILE_PATTERN = /\.xlsx?$/i;

function uploadError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return uploadError("The uploaded file must be 20 MB or smaller.");
    }

    const formData = await req.formData();
    const fileEntry = formData.get("file");
    if (!fileEntry || typeof fileEntry === "string") {
      return uploadError("No workbook file was uploaded.");
    }

    const file = fileEntry;
    if (!WORKBOOK_FILE_PATTERN.test(file.name)) {
      return uploadError("Only .xlsx and .xls files are supported.");
    }
    if (!file.size) {
      return uploadError("The uploaded workbook is empty.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return uploadError("The uploaded file must be 20 MB or smaller.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rawWorkbook = await readWorkbookBuffer(buffer, file.name);
    const dataSource = createDataSourceWorkbook(rawWorkbook.fileName, rawWorkbook.sheets);
    const analysisId = saveAnalysis(dataSource);
    const template = await loadAssetTemplateMetadata();

    const sheets = dataSource.sheets.map((sheet) => {
      const mapping = suggestMapping(sheet.headers);
      const parseWarnings: ValidationIssue[] = sheet.warnings.map((message) => ({
        sheetName: sheet.sheetName,
        rowIndex: -1,
        column: "sheet",
        message,
        severity: "warning",
      }));
      const mappingRecord = mappingSuggestionsToRecord(mapping);
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
      const mappedRows = transformRowsToTemplateDataset(sheet.rows, mappingRecord);
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
        sheet.eligibility === "skipped" || sheet.eligibility === "unsupported"
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
        sampleRows: sheet.rows.slice(0, 10),
        rows: sheet.rows.slice(0, 30),
        mapping,
      };
      
    });
    const skippedSheetSummaries = dataSource.skippedSheets.map((sheetName) =>
      createSheetSummary(sheetName, 0, undefined, [], "skipped"),
    );
    const sheetOverview = dataSource.profileDebug.map((debug) => {
      const parsedSheetIndex = sheets.findIndex((sheet) => sheet.sheetName === debug.sheetName);
      const parsedSheet = parsedSheetIndex >= 0 ? sheets[parsedSheetIndex] : undefined;
      return {
        sheetName: debug.sheetName,
        sourceProfile: debug.legacySourceProfile,
        detectedProfile: debug.profile,
        eligibility: parsedSheet?.eligibility || debug.eligibility,
        reason:
          parsedSheet?.eligibilityReason ||
          debug.decisionReason ||
          debug.skipReason ||
          "sheet was not selected for parsing",
        rowCount: parsedSheet?.rowCount || 0,
        errorCount: parsedSheet?.summary.errorCount || 0,
        warningCount: parsedSheet?.summary.warningCount || 0,
        confidence: parsedSheet?.confidence ?? debug.confidence,
        ...(parsedSheetIndex >= 0 ? { parsedSheetIndex } : {}),
      };
    });

    const response: ParseResponse = {
      analysisId,
      fileName: dataSource.fileName,
      sheets,
      skippedSheets: dataSource.skippedSheets,
      skippedSheetSummaries,
      sheetOverview,
      sheetProfileDebug: dataSource.profileDebug,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof WorkbookLimitError
      ? err.message
      : "ระบบไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบว่าไฟล์ Excel ไม่เสียหาย";
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอ่านไฟล์: " + message },
      { status: err instanceof WorkbookLimitError ? 400 : 500 }
    );
  }
}
