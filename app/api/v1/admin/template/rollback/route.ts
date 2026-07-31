import { NextRequest, NextResponse } from "next/server";
import { getTemplateStoreStatus, rollbackTemplate } from "@/lib/template-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !("versionId" in body) || (body.versionId !== null && typeof body.versionId !== "string")) {
      return NextResponse.json({ error: "ไม่ได้ระบุ versionId" }, { status: 400 });
    }

    rollbackTemplate(body.versionId);
    return NextResponse.json(getTemplateStoreStatus());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ย้อนกลับ template ไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
