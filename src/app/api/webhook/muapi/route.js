import { NextResponse } from "next/server";
import { applyJobUpdate } from "@/lib/clone-pipeline";

export async function POST(req) {
  try {
    const data = await req.json();
    console.log("[MUAPI_WEBHOOK_RECEIVED]", data);

    const requestId = data.id || data.request_id;

    if (!requestId) {
      console.error("[MUAPI_WEBHOOK_ERROR] Missing request id in payload", data);
      return NextResponse.json({ error: "Missing request id" }, { status: 400 });
    }

    const handled = await applyJobUpdate(data);
    if (!handled) {
      console.warn(`[MUAPI_WEBHOOK] No creation or clone with requestId ${requestId}.`);
      return NextResponse.json({ error: "Creation not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[MUAPI_WEBHOOK_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
