import { NextRequest, NextResponse } from "next/server";
import {
  deleteTemplate,
  getTemplateStoreStatus,
  saveTemplateUpload,
  validateTemplateUpload,
} from "@/lib/template-store";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const WORKBOOK_FILE_PATTERN = /\.xlsx?$/i;

function uploadError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  return NextResponse.json(getTemplateStoreStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.versionId !== "string" || !body.versionId) {
      return NextResponse.json({ error: "ไม่ได้ระบุ versionId" }, { status: 400 });
    }

    deleteTemplate(body.versionId);
    return NextResponse.json(getTemplateStoreStatus());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ลบ template ไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const fileEntry = formData.get("file");
    if (!fileEntry || typeof fileEntry === "string") {
      return uploadError("ไม่พบไฟล์ที่อัปโหลด");
    }

    const file = fileEntry;
    if (!WORKBOOK_FILE_PATTERN.test(file.name)) {
      return uploadError("รองรับเฉพาะไฟล์ .xlsx และ .xls");
    }
    if (!file.size) {
      return uploadError("ไฟล์ที่เลือกไม่มีข้อมูล");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return uploadError("ไฟล์ต้องมีขนาดไม่เกิน 20 MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = await validateTemplateUpload(buffer);
    if (!validation.ok) {
      return uploadError(validation.error || "ไฟล์ template ไม่ถูกต้อง");
    }

    saveTemplateUpload(buffer, file.name, validation.columns);
    return NextResponse.json(getTemplateStoreStatus());
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปโหลด template" },
      { status: 500 },
    );
  }
}
