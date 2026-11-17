import { NextRequest, NextResponse } from "next/server";
import { runDubSync } from "@/lib/dub-import/run";
import { withPrivateCache } from "@/lib/api-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  const query = new URL(req.url).searchParams.get("secret");
  return header === `Bearer ${secret}` || query === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const modeParam = searchParams.get("mode");
  const mode = modeParam === "full" ? "full" : "incremental";
  const loop = searchParams.get("loop") === "1" || searchParams.get("loop") === "true";

  try {
    const result = await runDubSync({
      source: searchParams.get("source"),
      mode,
      limit: Number(searchParams.get("limit")) || undefined,
      cursor: searchParams.get("cursor"),
      loop,
      budgetMs: Number(searchParams.get("budgetMs")) || 45000,
    });

    return withPrivateCache(
      NextResponse.json({
        success: result.sources.every((s) => s.errors.length === 0),
        ...result,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Dub sync failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
