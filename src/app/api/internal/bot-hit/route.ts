import { NextResponse } from "next/server";
import { recordBotHit } from "@/lib/bot-stats";

/**
 * Internal ingestion endpoint for crawler hits.
 *
 * Called from `src/proxy.ts` via `event.waitUntil()`: crawlers don't run
 * JavaScript, so the client-side analytics beacon can never see them and the
 * only place they can be observed is the server request path.
 *
 * Requires an internal secret header when configured. This prevents random
 * external callers from polluting bot stats.
 */

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const expected = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
  if (!expected) {
    // Fail closed in production; allow local/dev to avoid breaking telemetry.
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${expected}`) return true;
  return req.headers.get("x-internal-secret") === expected;
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as
      | { path?: unknown; userAgent?: unknown; country?: unknown }
      | null;

    const path = typeof body?.path === "string" ? body.path : req.headers.get("x-bot-path");
    const userAgent =
      typeof body?.userAgent === "string" && body.userAgent ? body.userAgent : req.headers.get("user-agent");
    const country =
      typeof body?.country === "string" && body.country
        ? body.country
        : req.headers.get("x-vercel-ip-country");

    const bot = await recordBotHit({ userAgent, path, country });
    return NextResponse.json({ ok: true, bot: bot?.id ?? null });
  } catch {
    // Never surface an error to the caller — this is fire-and-forget telemetry.
    return NextResponse.json({ ok: false });
  }
}
