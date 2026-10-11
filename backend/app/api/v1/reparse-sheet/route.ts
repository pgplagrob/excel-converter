import { NextRequest, NextResponse } from "next/server";
import { getAnalysis } from "@/src/review/analysis-store";
import { buildSheetData } from "@/src/parse/build-sheet-data";
import { computeHeaderSignature, loadMappingProfile } from "@/src/mapping/mapping-profiles";
import {
  parseReparseSheetRequest,
  ReparseRequestValidationError,
} from "@/src/review/reparse-request";
import {
  reparseStoredAnalysisSheet,
  ReparseSheetOperationError,
} from "@/src/review/reparse-sheet";
import { loadAssetTemplateMetadata } from "@/src/template/template";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const request = parseReparseSheetRequest(await req.json());
    const analysis = getAnalysis(request.analysisId);
    if (!analysis) {
      return NextResponse.json(
        { error: "ข้อมูลการวิเคราะห์หมดอายุ กรุณาอัปโหลดไฟล์และตรวจสอบใหม่อีกครั้ง" },
        { status: 410 },
      );
    }

    const reparsed = reparseStoredAnalysisSheet(analysis, request);
    const template = await loadAssetTemplateMetadata();
    const signature = computeHeaderSignature(reparsed.sheet.headers);
    const profile = loadMappingProfile(signature);
    const sheet = buildSheetData(
      reparsed.sheet,
      template,
      reparsed.sourceSheet.matrix,
      profile?.mapping,
    );
    return NextResponse.json({ sheet });
  } catch (error: unknown) {
    console.error(error);
    if (error instanceof ReparseSheetOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ReparseRequestValidationError || error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: error instanceof ReparseRequestValidationError
            ? error.message
            : "Request body must be valid JSON.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "ไม่สามารถวิเคราะห์ชีตใหม่ได้" },
      { status: 500 },
    );
  }
}
