import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { TEMPLATE_COLUMNS } from "@/lib/mapping";
import { logTemplateDataset, transformRowsToTemplateDataset } from "@/lib/transform";
import { validateMappedRows } from "@/lib/validate";

export const runtime = "nodejs";

interface ExportSheetInput {
  sheetName: string;
  rows: Record<string, any>[];
  // mapping: templateColumn -> sourceColumn (or null/empty if unmapped)
  mapping: Record<string, string | null>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sheetsInput: ExportSheetInput[] = body.sheets || [];
    const mode: string = body.mode || "download"; // "download" | "validate"

    if (!sheetsInput.length) {
      return NextResponse.json({ error: "ไม่มีข้อมูลสำหรับสร้างไฟล์" }, { status: 400 });
    }

    const wb = XLSX.utils.book_new();
    const allIssues: any[] = [];
    const allMappedRows: Record<string, any>[] = [];
    const transformedSheets: {
      sheetName: string;
      rowCount: number;
      sampleRows: Record<string, any>[];
    }[] = [];

    for (const sheet of sheetsInput) {
      const mappedRows = transformRowsToTemplateDataset(sheet.rows, sheet.mapping);
      logTemplateDataset(sheet.sheetName, mappedRows, sheet.mapping);
      transformedSheets.push({
        sheetName: sheet.sheetName,
        rowCount: mappedRows.length,
        sampleRows: mappedRows.slice(0, 5),
      });

      const issues = validateMappedRows(sheet.sheetName, mappedRows);
      allIssues.push(...issues);
      allMappedRows.push(...mappedRows.map((r) => ({ __sheet: sheet.sheetName, ...r })));

      if (mode === "download") {
        const ws = XLSX.utils.json_to_sheet(mappedRows, { header: TEMPLATE_COLUMNS });
        const safeName = sheet.sheetName.substring(0, 31) || "Sheet";
        XLSX.utils.book_append_sheet(wb, ws, safeName);
      }
    }

    if (mode === "validate") {
      return NextResponse.json({
        issues: allIssues,
        totalRows: allMappedRows.length,
        errorCount: allIssues.filter((i) => i.severity === "error").length,
        warningCount: allIssues.filter((i) => i.severity === "warning").length,
        transformedSheets,
      });
    }

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="converted_template.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างไฟล์: " + (err?.message || "unknown error") },
      { status: 500 }
    );
  }
}
