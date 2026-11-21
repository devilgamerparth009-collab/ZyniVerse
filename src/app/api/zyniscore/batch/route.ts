import { NextRequest, NextResponse } from "next/server";
import { getBatchZyniScores } from "@/lib/zyniscore";
import { apiLimiter } from "@/lib/rate-limiter";

export async function POST(req: NextRequest) {
  const rateLimited = await apiLimiter.middleware(req);
  if (rateLimited) return rateLimited;

  const { mediaIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
    return NextResponse.json({ error: "mediaIds array required" }, { status: 400 });
  }

  const ids = mediaIds.slice(0, 50).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No valid mediaIds provided" }, { status: 400 });
  }

  const scores = await getBatchZyniScores(ids);
  const result: Record<number, unknown> = {};
  scores.forEach((v, k) => { result[k] = v; });
  return NextResponse.json(result);
}
