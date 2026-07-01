import { NextRequest, NextResponse } from "next/server";
import { parseWorkbookBuffer } from "@/lib/excel";
import { suggestMapping } from "@/lib/mapping";

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

    const parsed = parseWorkbookBuffer(buffer, file.name);

    const sheets = parsed.sheets.map((sheet) => {
      const mapping = suggestMapping(sheet.headers);
      return {
        sheetName: sheet.sheetName,
        headers: sheet.headers,
        rowCount: sheet.rowCount,
        sampleRows: sheet.rows.slice(0, 10),
        rows: sheet.rows,
        mapping,
      };
    });

    return NextResponse.json({
      fileName: parsed.fileName,
      sheets,
      skippedSheets: parsed.skippedSheets,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอ่านไฟล์: " + (err?.message || "unknown error") },
      { status: 500 }
    );
  }
}
