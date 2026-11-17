import { NextRequest, NextResponse } from "next/server";
import { runDubSync } from "@/lib/dub-import/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily dub-catalogue sync. The GitHub Actions cron keeps calling this route
 * with the returned `nextQuery` until every source reports `done: true`.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") === "full" ? "full" : "incremental";

  try {
    const result = await runDubSync({
      source: searchParams.get("source"),
      mode,
      limit: Number(searchParams.get("limit")) || undefined,
      cursor: searchParams.get("cursor"),
      loop: searchParams.get("loop") === "1",
      budgetMs: 45000,
    });

    return NextResponse.json({
      success: result.sources.every((s) => s.errors.length === 0),
      ...result,
      nextQuery: result.done ? null : buildNextQuery(result.sources),
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
function buildNextQuery(sources: { source: string; mode: string; nextQuery: string | null; done: boolean }[]): string | null {
  const pending = sources.find((s) => !s.done);
  if (pending) {
    return pending.nextQuery ?? `source=${pending.source}&mode=${pending.mode}`;
  }
  return null;
}
