import { NextResponse } from "next/server";
import { getUploadStatus } from "@/lib/upload-status";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getUploadStatus(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
