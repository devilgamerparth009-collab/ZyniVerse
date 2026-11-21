import { NextRequest, NextResponse } from "next/server";
import { updateSessionActivity } from "@/lib/analytics";
import { createRateLimiter } from "@/lib/rate-limiter";

const heartbeatLimiter = createRateLimiter("analytics-heartbeat", {
  maxRequests: 60,
  windowMs: 60 * 1000,
});

export async function POST(req: NextRequest) {
  try {
    if (!heartbeatLimiter.checkSync(heartbeatLimiter.getClientIp(req)).allowed) {
      return NextResponse.json({ ok: true }, { status: 204 });
    }
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 128) : null;
    if (!sessionId) return NextResponse.json({ ok: true });
    await updateSessionActivity(sessionId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
