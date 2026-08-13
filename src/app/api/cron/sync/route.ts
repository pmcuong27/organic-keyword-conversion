import { NextResponse } from "next/server";
import { runScheduledPropertySync } from "@/lib/data-blending/scheduled-sync";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runScheduledPropertySync("24h");
    console.info("Scheduled GSC/GA4 sync finished", {
      synced: summary.synced,
      failed: summary.failed,
      skipped: summary.skipped,
    });
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      ...summary,
    });
  } catch (err) {
    console.error("Scheduled GSC/GA4 sync failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
