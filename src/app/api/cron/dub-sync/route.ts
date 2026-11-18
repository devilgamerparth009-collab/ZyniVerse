import { NextRequest, NextResponse } from "next/server";
import { runDubSync } from "@/lib/dub-import/run";
import { revalidateDubCaches } from "@/lib/dub-import/revalidate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`; the
 * workflow uses the same header. Older manual links used `?secret=` and the
 * `x-cron-secret` header, so those stay compatible. A missing secret always
 * fails closed (401) — nothing here logs the secret itself.
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
 * Daily dub-sync cron. A fresh call refreshes the schedule first, then takes
 * one catalogue chunk; the returned `nextQuery` resumes the catalogue chain.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") === "full" ? "full" : "incremental";
  const stageParam = searchParams.get("stage");
  const stage =
    stageParam === "catalogue" || stageParam === "schedule" || stageParam === "all"
      ? stageParam
      : undefined;

  try {
    const result = await runDubSync({
      source: searchParams.get("source"),
      mode,
      limit: Number(searchParams.get("limit")) || undefined,
      cursor: searchParams.get("cursor"),
      stage,
      loop: searchParams.get("loop") === "1",
      budgetMs: 45000,
    });

    // Only purge when at least one stage actually wrote data. Never treat an
    // empty/failed run as a success just because no exception was thrown.
    const wroteData = result.sources.some((source) =>
      source.stages.some((s) => s.status === "ok" && s.fetched > 0)
    );
    const revalidation = wroteData
      ? revalidateDubCaches()
      : { attempted: [], failed: [] };

    return NextResponse.json({
      success: result.done && result.sources.every((s) => s.errors.length === 0),
      ...result,
      nextQuery: result.done ? null : buildNextQuery(result.sources),
      revalidated: revalidation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Dub sync failed", details: String(error) },
      { status: 500 }
    );
  }
}

/** Resume string the workflow passes back on the next call. */
function buildNextQuery(
  sources: { source: string; mode: string; nextQuery: string | null; done: boolean }[]
): string | null {
  const pending = sources.find((s) => !s.done);
  if (pending) {
    return pending.nextQuery ?? `source=${pending.source}&mode=${pending.mode}`;
  }
  return null;
}
