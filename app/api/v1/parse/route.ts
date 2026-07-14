import { NextRequest, NextResponse } from "next/server";
import type { ParseResponse, ValidationIssue } from "@/lib/client-types";
import { saveAnalysis } from "@/lib/analysis-store";
import type { SheetEligibility } from "@/lib/datasource";
import { createDataSourceWorkbook } from "@/lib/datasource";
import { readWorkbookBuffer } from "@/lib/excel";
import { mappingSuggestionsToRecord, suggestMapping } from "@/lib/mapping";
import { transformRowsToTemplateDataset } from "@/lib/transform";
import { loadAssetTemplateMetadata } from "@/lib/template";
import { createSheetSummary, validateMappedRows, validateSheetLevel } from "@/lib/validate";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ไม่พบไฟล์ที่อัปโหลด" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rawWorkbook = readWorkbookBuffer(buffer, file.name);
    const dataSource = createDataSourceWorkbook(rawWorkbook.fileName, rawWorkbook.sheets);
    const analysisId = saveAnalysis(dataSource);
    const template = loadAssetTemplateMetadata();

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
      const sheetLevelIssues = validateSheetLevel(
        sheet.sheetName,
        sheet.rows.length,
        sheet.headerRowIndex + 1,
        mappingRecord,
        sheet.rows,
      );
      const mappedRows = transformRowsToTemplateDataset(sheet.rows, mappingRecord);
      const rowIssues = validateMappedRows(sheet.sheetName, mappedRows, sheet.rows, template.references);
      const validationIssues = [...parseWarnings, ...sheetLevelIssues, ...rowIssues];
      const errorCount = validationIssues.filter((issue) => issue.severity === "error").length;
      const finalEligibility: SheetEligibility =
        sheet.eligibility === "skipped"
          ? "skipped"
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

    const response: ParseResponse = {
      analysisId,
      fileName: dataSource.fileName,
      sheets,
      skippedSheets: dataSource.skippedSheets,
      skippedSheetSummaries,
      sheetProfileDebug: dataSource.profileDebug,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอ่านไฟล์: " + (err?.message || "unknown error") },
      { status: 500 }
    );
  }
}
