import { NextRequest, NextResponse } from "next/server";
import { createDataSourceWorkbook, logDataSourceWorkbook } from "@/lib/datasource";
import { readWorkbookBuffer } from "@/lib/excel";
import { suggestMapping } from "@/lib/mapping";
import { createSheetSummary, type ValidationIssue } from "@/lib/validate";

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
    logDataSourceWorkbook(dataSource, rawWorkbook.sheets);

    const sheets = dataSource.sheets.map((sheet) => {
      const mapping = suggestMapping(sheet.headers);
      const parseWarnings: ValidationIssue[] = sheet.warnings.map((message) => ({
        sheetName: sheet.sheetName,
        rowIndex: -1,
        column: "sheet",
        message,
        severity: "warning",
      }));
      return {
        sheetName: sheet.sheetName,
        sourceProfile: sheet.sourceProfile,
        headerRowIndex: sheet.headerRowIndex,
        summary: createSheetSummary(
          sheet.sheetName,
          sheet.rowCount,
          sheet.headerRowIndex + 1,
          parseWarnings,
        ),
        headers: sheet.headers,
        rowCount: sheet.rowCount,
        groupedAssets: sheet.groupedAssets,
        warnings: sheet.warnings,
        sampleRows: sheet.rows.slice(0, 10),
        rows: sheet.rows,
        mapping,
      };
    });
    const skippedSheetSummaries = dataSource.skippedSheets.map((sheetName) =>
      createSheetSummary(sheetName, 0, undefined, [], "skipped"),
    );

    return NextResponse.json({
      fileName: dataSource.fileName,
      sheets,
      skippedSheets: dataSource.skippedSheets,
      skippedSheetSummaries,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอ่านไฟล์: " + (err?.message || "unknown error") },
      { status: 500 }
    );
  }
}
