import { NextRequest, NextResponse } from "next/server";
import { runDubSync } from "@/lib/dub-import/run";
import { revalidateDubCaches } from "@/lib/dub-import/revalidate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Same fail-closed auth as the daily cron route. The secret is never logged.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  const altHeader = req.headers.get("x-cron-secret");
  if (altHeader === secret) return true;

  const querySecret = new URL(req.url).searchParams.get("secret");
  return querySecret === secret;
}

/**
 * Cheap 2-hourly schedule refresh for the GitHub cron.
 *
 * The daily /api/cron/dub-sync still owns the catalogue crawl. This route only
 * fetches the source schedule page, upserts the 27-ish airing rows and clears
 * stale dates, so polling more often does not multiply the heavy work.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDubSync({
      source: "animedubhindi",
      mode: "full",
      stage: "schedule",
      budgetMs: 45_000,
    });

    // Only revalidate when the source actually wrote rows. A failed or empty
    // poll must never look like a successful refresh.
    const wroteData = result.sources.some((source) =>
      source.stages.some((s) => s.status === "ok" && s.fetched > 0)
    );
    const revalidation = wroteData
      ? revalidateDubCaches()
      : { attempted: [], failed: [] };

    return NextResponse.json({
      success: result.done && result.sources.every((s) => s.errors.length === 0),
      stage: "schedule",
      ...result,
      revalidated: revalidation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Dub schedule refresh failed", details: String(error) },
      { status: 500 }
    );
  }
}
