import { NextRequest, NextResponse } from "next/server";
import { getMediaBatch } from "@/lib/anilist";
import { apiLimiter } from "@/lib/rate-limiter";

export async function POST(req: NextRequest) {
  const rateLimited = await apiLimiter.middleware(req);
  if (rateLimited) return rateLimited;

  try {
    const { ids } = await req.json().catch(() => ({}));
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }
    const safeIds = ids.map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 50);
    if (safeIds.length === 0) {
      return NextResponse.json({ error: "No valid ids provided" }, { status: 400 });
    }
    const media = await getMediaBatch(safeIds);
    return NextResponse.json(
      { media },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
