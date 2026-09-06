import { NextResponse } from "next/server";

import { isCronBearerAuthorized } from "@/lib/cron-auth";
import { processNextPresentation } from "@/server/services/presentation-conversion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function GET(request: Request) {
  if (
    !isCronBearerAuthorized(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await processNextPresentation();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[convert-presentation] échec du worker", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "conversion_worker_failed" },
      { status: 500 },
    );
  }
}
