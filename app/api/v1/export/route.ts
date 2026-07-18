import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import type { ExportMode, ExportRequest, ExportSheetInput } from "@/lib/client-types";
import { getAnalysis } from "@/lib/analysis-store";
import { SOURCE_ROW_KEY_COLUMN } from "@/lib/datasource";
import { ExportRequestValidationError, parseExportRequest } from "@/lib/export-request";
import { mappingSuggestionsToRecord, mergeMapping } from "@/lib/mapping";
import { buildAssetTemplateWorkbookBySheet, loadAssetTemplateMetadata } from "@/lib/template";
import { transformRowsToTemplateDataset } from "@/lib/transform";
import { calculateWorkbookFromDataSource, evaluateExportGate } from "@/lib/reporting/calculate-workbook";
import { PolicyValidationError } from "@/lib/reporting/policy-validation";
import { stampRowOverrides, validateRowOverridesAgainstRowKeys } from "@/lib/reporting/request-validation";
import type { SelectedOutput } from "@/lib/reporting/types";
import { buildAuditAssumptionsDataset } from "@/lib/reports/audit-assumptions-dataset";
import { buildReportWorkbook } from "@/lib/reports/build-report-workbook";
import { buildSorThor1Dataset } from "@/lib/reports/sor-thor-1-dataset";
import { buildSorThor2Dataset } from "@/lib/reports/sor-thor-2-dataset";
import { buildSorThor3Dataset } from "@/lib/reports/sor-thor-3-dataset";
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
    const body: ExportRequest = parseExportRequest(await req.json());
    const sourceFileName = body.sourceFileName || "output.xlsx";
    const sheetsInput: ExportSheetInput[] = body.sheets || [];
    const mode: ExportMode = body.mode || "download";
    const analysis = getAnalysis(body.analysisId);
    const template = await loadAssetTemplateMetadata();

    if (!analysis && !sheetsInput.length) {
      return NextResponse.json({ error: "ไม่พบข้อมูลสำหรับสร้างไฟล์" }, { status: 400 });
    }

    if (!analysis) {
      return NextResponse.json(
        { error: "ข้อมูลการวิเคราะห์หมดอายุ กรุณาอัปโหลดไฟล์และตรวจสอบใหม่อีกครั้ง" },
        { status: 410 },
      );
    }

    const allIssues: ReturnType<typeof validateMappedRows> = [];
    const exportableSheets: { sheetName: string; rows: Record<string, any>[] }[] = [];
    const transformedSheets: {
      sheetName: string;
      rowCount: number;
      sampleRows: Record<string, any>[];
      eligibility: string;
    }[] = [];
    const sheetSummaries: ReturnType<typeof createSheetSummary>[] = [];

    for (const sourceSheet of analysis.dataSource.sheets) {
      const sheet = findSheetInput(sheetsInput, sourceSheet.sheetName);
      if (!sheet) continue;
      if (
        sourceSheet.eligibility === "preserved" ||
        sourceSheet.eligibility === "skipped" ||
        sourceSheet.eligibility === "unsupported"
      ) {
        sheetSummaries.push(
          createSheetSummary(sourceSheet.sheetName, 0, sourceSheet.headerRowIndex + 1, [], sourceSheet.eligibilityReason),
        );
        continue;
      }

      const autoMapping = Array.isArray(sheet.autoMapping)
        ? mappingSuggestionsToRecord(sheet.autoMapping)
        : sheet.mapping || {};
      const manualMapping = sheet.manualMapping || sheet.mapping || {};
      const finalMapping = mergeMapping(autoMapping, manualMapping);
      const validationContext = {
        sourceProfile: sourceSheet.sourceProfile,
        eligibility: sourceSheet.eligibility,
      };
      const sheetLevelIssues = validateSheetLevel(
        sourceSheet.sheetName,
        sourceSheet.rows.length,
        sheet.headerRow || sourceSheet.headerRowIndex + 1,
        finalMapping,
        sourceSheet.rows,
        validationContext,
      );
      const mappedRows = transformRowsToTemplateDataset(sourceSheet.rows, finalMapping, manualMapping);
      transformedSheets.push({
        sheetName: sourceSheet.sheetName,
        rowCount: mappedRows.length,
        sampleRows: mappedRows.slice(0, 5),
        eligibility: sourceSheet.eligibility,
      });

      const issues = [
        ...sheetLevelIssues,
        ...validateMappedRows(
          sourceSheet.sheetName,
          mappedRows,
          sourceSheet.rows,
          template.references,
          validationContext,
        ),
      ];
      if (sourceSheet.sourceProfile === "UNKNOWN" && !Object.keys(manualMapping).length) {
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
        exportableSheets.push({
          sheetName: sourceSheet.sheetName,
          rows: mappedRows,
        });
      } else {
        sourceSheet.eligibility = "needsReview";
        sourceSheet.eligibilityReason = "validation found errors";
      }
    }

    // --- P1: อปท.-สท. 1/2/3 + Audit/Assumptions ---------------------------
    // A request that never sets selectedOutputs behaves exactly as before
    // (Template-50 only). Only when a report output beyond TEMPLATE_50 is
    // explicitly requested does any of this run.
    const selectedOutputs: SelectedOutput[] = body.selectedOutputs || ["TEMPLATE_50"];
    const wantsTemplate50 = selectedOutputs.includes("TEMPLATE_50");
    const wantsReportOutputs = selectedOutputs.some((output) => output !== "TEMPLATE_50");

    let reportCalculation: ReturnType<typeof calculateWorkbookFromDataSource> | undefined;
    let reportGate: ReturnType<typeof evaluateExportGate> | undefined;
    const stampedRowOverrides = stampRowOverrides(body.rowOverrides || []);

    if (wantsReportOutputs) {
      if (!body.reportingPolicy) {
        return NextResponse.json({ error: "reportingPolicy is required when selecting อปท.-สท. or Audit/Assumptions outputs." }, { status: 400 });
      }
      if (!body.organizationMetadata) {
        return NextResponse.json({ error: "organizationMetadata is required when selecting อปท.-สท. or Audit/Assumptions outputs." }, { status: 400 });
      }
      const knownRowKeys = new Set(
        analysis.dataSource.sheets.flatMap((sheet) =>
          sheet.rows.map((row) => String(row[SOURCE_ROW_KEY_COLUMN] || "")),
        ),
      );
      validateRowOverridesAgainstRowKeys(stampedRowOverrides, knownRowKeys);
      reportCalculation = calculateWorkbookFromDataSource(
        analysis.dataSource,
        sourceFileName,
        body.reportingPolicy,
        body.categoryMappings || [],
        stampedRowOverrides,
      );
      reportGate = evaluateExportGate(reportCalculation);
    }

    if (mode === "validate") {
      return NextResponse.json({
        issues: allIssues,
        sheetSummaries,
        totalRows: exportableSheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
        errorCount: allIssues.filter((i) => i.severity === "error").length,
        warningCount: allIssues.filter((i) => i.severity === "warning").length,
        transformedSheets,
        ...(reportCalculation && reportGate
          ? {
              reportCalculation: {
                totalRows: reportCalculation.rows.length,
                blockingRowCount: reportCalculation.blockingRowKeys.length,
                unresolvedCategoryValues: reportCalculation.unresolvedCategoryValues,
                reconciliation: reportCalculation.reconciliation,
                exportGate: reportGate,
              },
            }
          : {}),
      });
    }

    if (wantsTemplate50 && !exportableSheets.length) {
      return NextResponse.json(
        { error: "ยังไม่มีชีตหรือแถวที่ผ่านการตรวจสอบสำหรับ export กรุณาตรวจ mapping/ข้อผิดพลาดก่อน" },
        { status: 400 },
      );
    }

    let isDraft = false;
    if (wantsReportOutputs) {
      if (!reportGate!.officialAllowed && !body.draft) {
        return NextResponse.json(
          {
            error: "มีรายการที่ยังเป็น NEEDS_REVIEW หรือข้อมูลไม่ครบ จึงไม่สามารถสร้างรายงานทางการได้ ส่ง draft:true หากต้องการฉบับร่าง",
            blockingReasons: reportGate!.blockingReasons,
          },
          { status: 400 },
        );
      }
      isDraft = !reportGate!.officialAllowed && Boolean(body.draft);
    }

    const wb = wantsTemplate50
      ? await buildAssetTemplateWorkbookBySheet(exportableSheets, {
          sourceSheetOrder: analysis.dataSource.profileDebug.map((sheet) => sheet.sheetName),
        })
      : new ExcelJS.Workbook();

    if (wantsReportOutputs) {
      const policy = body.reportingPolicy!;
      const org = body.organizationMetadata!;
      buildReportWorkbook({
        workbook: wb,
        sorThor1: selectedOutputs.includes("SOR_THOR_1") ? buildSorThor1Dataset(reportCalculation!.reconciliation) : undefined,
        sorThor2: selectedOutputs.includes("SOR_THOR_2") ? buildSorThor2Dataset(reportCalculation!.rows) : undefined,
        sorThor3: selectedOutputs.includes("SOR_THOR_3") ? buildSorThor3Dataset(reportCalculation!.rows) : undefined,
        audit: selectedOutputs.includes("AUDIT_ASSUMPTIONS")
          ? buildAuditAssumptionsDataset(
              policy,
              org,
              body.categoryMappings || [],
              stampedRowOverrides,
              body.referenceOverrides || [],
              reportCalculation!.rows,
              reportCalculation!.reconciliation,
              reportGate!,
            )
          : undefined,
        organizationMetadata: org,
        reportingPolicy: policy,
        isDraft,
      });
    }

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const fileName = buildExportFileName(sourceFileName);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"${encodeURIComponent(fileName)}\"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
}
    });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof PolicyValidationError) {
      return NextResponse.json({ error: `${err.field}: ${err.message}`, field: err.field }, { status: 400 });
    }
    const isBadRequest = err instanceof ExportRequestValidationError || err instanceof SyntaxError;
    const message = err instanceof ExportRequestValidationError
      ? err.message
      : err instanceof SyntaxError
        ? "Request body must be valid JSON."
        : "ระบบไม่สามารถสร้างไฟล์ได้ในขณะนี้";
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างไฟล์: " + message },
      { status: isBadRequest ? 400 : 500 }
    );
  }
}
