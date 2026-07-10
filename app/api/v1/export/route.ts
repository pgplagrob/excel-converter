import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import type { ExportMode, ExportRequest, ExportSheetInput } from "@/lib/client-types";
import { getAnalysis } from "@/lib/analysis-store";
import { mappingSuggestionsToRecord, mergeMapping } from "@/lib/mapping";
import { buildAssetTemplateWorkbook, loadAssetTemplateMetadata } from "@/lib/template";
import { transformRowsToTemplateDataset } from "@/lib/transform";
import { createSheetSummary, validateMappedRows, validateSheetLevel } from "@/lib/validate";

export const runtime = "nodejs";

function buildExportFileName(sourceFileName?: string) {
  const baseName = sourceFileName
    ? sourceFileName.replace(/\.[^/.]+$/, "")
    : "output";

  return `converted_template_${baseName}.xlsx`;
}

function findSheetInput(sheetsInput: ExportSheetInput[], sheetName: string): ExportSheetInput | undefined {
  return sheetsInput.find((sheet) => sheet.sheetName === sheetName);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ExportRequest;
    const sourceFileName = body.sourceFileName || "output.xlsx";
    const sheetsInput: ExportSheetInput[] = body.sheets || [];
    const mode: ExportMode = body.mode || "download";
    const analysis = getAnalysis(body.analysisId);
    const template = loadAssetTemplateMetadata();

    if (!analysis && !sheetsInput.length) {
      return NextResponse.json({ error: "ไม่พบข้อมูลสำหรับสร้างไฟล์" }, { status: 400 });
    }

    if (!analysis) {
      return NextResponse.json(
        { error: "ข้อมูลการวิเคราะห์หมดอายุ กรุณาอัปโหลดไฟล์และตรวจสอบใหม่อีกครั้ง" },
        { status: 410 },
      );
    }

    const allIssues: any[] = [];
    const exportableRows: Record<string, any>[] = [];
    const transformedSheets: {
      sheetName: string;
      rowCount: number;
      sampleRows: Record<string, any>[];
      eligibility: string;
    }[] = [];
    const sheetSummaries: ReturnType<typeof createSheetSummary>[] = [];

    for (const sourceSheet of analysis.dataSource.sheets) {
      const sheet = findSheetInput(sheetsInput, sourceSheet.sheetName) || {
        sheetName: sourceSheet.sheetName,
        rows: [],
      };
      if (sourceSheet.eligibility === "skipped") {
        sheetSummaries.push(
          createSheetSummary(sourceSheet.sheetName, 0, sourceSheet.headerRowIndex + 1, [], sourceSheet.eligibilityReason),
        );
        continue;
      }

      const autoMapping = Array.isArray(sheet.autoMapping)
        ? mappingSuggestionsToRecord(sheet.autoMapping)
        : sheet.mapping || {};
      const finalMapping = mergeMapping(autoMapping, sheet.manualMapping || sheet.mapping || {});
      const sheetLevelIssues = validateSheetLevel(
        sourceSheet.sheetName,
        sourceSheet.rows.length,
        sheet.headerRow || sourceSheet.headerRowIndex + 1,
        finalMapping,
        sourceSheet.rows,
      );
      const mappedRows = transformRowsToTemplateDataset(sourceSheet.rows, finalMapping);
      transformedSheets.push({
        sheetName: sourceSheet.sheetName,
        rowCount: mappedRows.length,
        sampleRows: mappedRows.slice(0, 5),
        eligibility: sourceSheet.eligibility,
      });

      const issues = [
        ...sheetLevelIssues,
        ...validateMappedRows(sourceSheet.sheetName, mappedRows, sourceSheet.rows, template.references),
      ];
      if (sourceSheet.sourceProfile === "UNKNOWN" && !Object.keys(sheet.manualMapping || {}).length) {
        issues.push({
          sheetName: sourceSheet.sheetName,
          rowIndex: -1,
          column: "sheet",
          message: "ชีต Unknown ต้องตรวจสอบและแก้ mapping ก่อน จึงจะ export ได้",
          severity: "error",
        });
      }
      allIssues.push(...issues);
      const errorCount = issues.filter((issue) => issue.severity === "error").length;
      sheetSummaries.push(
        createSheetSummary(sourceSheet.sheetName, mappedRows.length, sheet.headerRow || sourceSheet.headerRowIndex + 1, issues),
      );
      if (errorCount === 0) {
        sourceSheet.eligibility = "exportable";
        sourceSheet.eligibilityReason = "validated with no errors";
        exportableRows.push(...mappedRows);
      } else {
        sourceSheet.eligibility = "needsReview";
        sourceSheet.eligibilityReason = "validation found errors";
      }
    }

    if (mode === "validate") {
      return NextResponse.json({
        issues: allIssues,
        sheetSummaries,
        totalRows: exportableRows.length,
        errorCount: allIssues.filter((i) => i.severity === "error").length,
        warningCount: allIssues.filter((i) => i.severity === "warning").length,
        transformedSheets,
      });
    }

    if (!exportableRows.length) {
      return NextResponse.json(
        { error: "ยังไม่มีชีตหรือแถวที่ผ่านการตรวจสอบสำหรับ export กรุณาตรวจ mapping/ข้อผิดพลาดก่อน" },
        { status: 400 },
      );
    }

    const wb = buildAssetTemplateWorkbook(exportableRows);
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileName = buildExportFileName(sourceFileName);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"${encodeURIComponent(fileName)}\"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
}
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างไฟล์: " + (err?.message || "unknown error") },
      { status: 500 }
    );
  }
}
