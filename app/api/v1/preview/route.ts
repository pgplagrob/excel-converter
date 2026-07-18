import { NextRequest, NextResponse } from "next/server";
import { getAnalysis } from "@/lib/analysis-store";
import { SOURCE_ROW_KEY_COLUMN } from "@/lib/datasource";
import { calculateWorkbookFromDataSource } from "@/lib/reporting/calculate-workbook";
import { toPreviewRowDto } from "@/lib/reporting/preview-dto";
import { groupWarnings, queryCalculatedRows } from "@/lib/reporting/preview-query";
import { PolicyValidationError } from "@/lib/reporting/policy-validation";
import { parsePreviewRequest, stampRowOverrides, validateRowOverridesAgainstRowKeys } from "@/lib/reporting/request-validation";

export const runtime = "nodejs";

/**
 * Calculated preview: pagination/filter/search over a workbook's classified
 * and depreciated rows. `analysisId` is the sole source of truth for which
 * rows exist — raw rows are never accepted from the client as the source of
 * truth, and the response is capped to one page (<=100 rows), never the
 * full 15,000+ row set.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = parsePreviewRequest(body);

    const analysis = getAnalysis(parsed.analysisId);
    if (!analysis) {
      return NextResponse.json(
        { error: "ข้อมูลการวิเคราะห์หมดอายุ กรุณาอัปโหลดไฟล์และตรวจสอบใหม่อีกครั้ง" },
        { status: 410 },
      );
    }

    const stampedRowOverrides = stampRowOverrides(parsed.rowOverrides);
    const knownRowKeys = new Set(
      analysis.dataSource.sheets.flatMap((sheet) =>
        sheet.rows.map((row) => String(row[SOURCE_ROW_KEY_COLUMN] || "")),
      ),
    );
    validateRowOverridesAgainstRowKeys(stampedRowOverrides, knownRowKeys);

    const calculated = calculateWorkbookFromDataSource(
      analysis.dataSource,
      analysis.dataSource.fileName,
      parsed.policy,
      parsed.categoryMappings,
      stampedRowOverrides,
    );

    const page = queryCalculatedRows(calculated.rows, {
      page: parsed.page,
      pageSize: parsed.pageSize,
      classification: parsed.classification,
      severity: parsed.severity,
      search: parsed.search,
    });

    return NextResponse.json({
      rows: page.rows.map(toPreviewRowDto),
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
      warningGroups: groupWarnings(calculated.rows),
      reconciliation: calculated.reconciliation,
      blockingRowCount: calculated.blockingRowKeys.length,
      unresolvedCategoryValues: calculated.unresolvedCategoryValues,
    });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof PolicyValidationError) {
      return NextResponse.json({ error: `${err.field}: ${err.message}`, field: err.field }, { status: 400 });
    }
    const message = err instanceof SyntaxError ? "Request body must be valid JSON." : "ระบบไม่สามารถประมวลผล preview ได้ในขณะนี้";
    return NextResponse.json({ error: message }, { status: err instanceof SyntaxError ? 400 : 500 });
  }
}
