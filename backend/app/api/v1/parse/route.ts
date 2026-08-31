import { NextRequest, NextResponse } from "next/server";
import type { ParseResponse } from "@/lib/client-types";
import { saveAnalysis } from "@/lib/analysis-store";
import { buildSheetData } from "@/lib/build-sheet-data";
import { createDataSourceWorkbook } from "@/lib/datasource";
import { readWorkbookBuffer, type WorkbookSheetMatrix, WorkbookLimitError } from "@/lib/excel";
import { computeHeaderSignature, loadMappingProfile } from "@/lib/mapping-profiles";
import { loadAssetTemplateMetadata } from "@/lib/template";
import { createSheetSummary } from "@/lib/validate";

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
    // Workbook and analysis caps bound the raw matrices retained for manual reparsing.
    const analysisId = saveAnalysis(dataSource, undefined, rawWorkbook.sheets);
    const template = await loadAssetTemplateMetadata();
    const rawSheetsByName = new Map<string, WorkbookSheetMatrix>(
      rawWorkbook.sheets.map((sheet) => [sheet.sheetName, sheet]),
    );

    const sheets = dataSource.sheets.map((sheet) => {
      const signature = computeHeaderSignature(sheet.headers);
      const profile = loadMappingProfile(signature);
      return buildSheetData(
        sheet,
        template,
        rawSheetsByName.get(sheet.sheetName)?.matrix,
        profile?.mapping,
      );
    });
    const skippedSheetSummaries = dataSource.skippedSheets.map((sheetName) => {
      const debug = dataSource.profileDebug.find((item) => item.sheetName === sheetName);
      return createSheetSummary(
        sheetName,
        0,
        undefined,
        [],
        debug?.decisionReason || debug?.skipReason || "ไม่มีข้อมูลรายสินทรัพย์สำหรับแปลง",
      );
    });
    const preservedSheetSummaries = dataSource.preservedSheets
      .filter((sheetName) => !sheets.some((sheet) => sheet.sheetName === sheetName))
      .map((sheetName) => ({
        sheetName,
        status: "preserved" as const,
        rowCount: rawWorkbook.sheets.find((sheet) => sheet.sheetName === sheetName)?.matrix.length || 0,
        errorCount: 0,
        warningCount: 0,
        reason: "เก็บชีตต้นฉบับไว้ในไฟล์ผลลัพธ์โดยไม่แปลงโครงสร้าง",
      }));
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
      preservedSheets: dataSource.preservedSheets,
      preservedSheetSummaries,
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
