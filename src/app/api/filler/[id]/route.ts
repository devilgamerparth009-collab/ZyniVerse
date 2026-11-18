import { NextRequest, NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";
import { getFillerForAnime } from "@/lib/filler";
import { apiLimiter } from "@/lib/rate-limiter";

/**
 * Only a real guide is cached at the CDN (briefly). Misses and upstream
 * failures are explicitly no-store: a newly published guide must become
 * visible on the very next request instead of being hidden by a cached miss.
 */
function json(body: unknown, status = 200, cacheable = false) {
  const res = NextResponse.json(body, { status });
  if (cacheable) return withPublicCache(res);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}

async function GET_inner(req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;
  const { id } = await params;
  const anilistId = Number(id);
  if (!Number.isFinite(anilistId) || anilistId <= 0) {
    return json({ error: "Invalid ID" }, 400);
  }

  const search = req.nextUrl.searchParams;
  const title = search.get("title")?.trim() || undefined;
  const malIdRaw = search.get("malId");
  const parsedMalId = malIdRaw ? Number(malIdRaw) : undefined;
  const malId =
    parsedMalId !== undefined && Number.isFinite(parsedMalId) && parsedMalId > 0
      ? parsedMalId
      : undefined;
  const aliases = search.getAll("alias").map((a) => a.trim()).filter(Boolean).slice(0, 8);

  try {
    const data = await getFillerForAnime({ anilistId, malId, title, aliases });
    if (!data) {
      return json(
        { found: false, reason: "no-guide", anilistId, ...(title ? { title } : {}) },
        200
      );
    }
    // `data.episodes` may legitimately be empty — that is still a found guide.
    return json({ found: true, ...data }, 200, true);
  } catch (error) {
    console.error("[api/filler] lookup failed", error);
    return json(
      { found: false, reason: "upstream-error", error: "Failed to fetch filler data" },
      502
    );
  }
}


export async function GET(...args: Parameters<typeof GET_inner>) {
  return GET_inner(...args);
}
