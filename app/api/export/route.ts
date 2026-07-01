import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
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

function applyTableStyle(ws: XLSX.WorkSheet, columns: string[], rowCount: number) {
  const borderStyle = {
    style: "thin",
    color: { rgb: "B7C9D6" },
  };
  const border = {
    top: borderStyle,
    right: borderStyle,
    bottom: borderStyle,
    left: borderStyle,
  };
  const headerStyle = {
    fill: {
      patternType: "solid",
      fgColor: { rgb: "D9EAF7" },
    },
    font: {
      bold: true,
      color: { rgb: "1F2937" },
    },
    alignment: {
      horizontal: "center",
      vertical: "center",
    },
    border,
  };
  const bodyStyle = {
    border,
    alignment: {
      vertical: "center",
    },
  };

  for (let rowIndex = 0; rowIndex <= rowCount; rowIndex += 1) {
    for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      if (!ws[cellAddress]) {
        ws[cellAddress] = { t: "s", v: rowIndex === 0 ? columns[colIndex] : "" };
      }
      ws[cellAddress].s = rowIndex === 0 ? headerStyle : bodyStyle;
    }
  }
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
        applyTableStyle(ws, TEMPLATE_COLUMNS, mappedRows.length);
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
