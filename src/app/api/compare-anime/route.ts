import { NextRequest, NextResponse } from "next/server";
import { getAnimeDetailFull, bestTitle } from "@/lib/anilist";
import { apiLimiter } from "@/lib/rate-limiter";

export async function POST(req: NextRequest) {
  const rateLimited = await apiLimiter.middleware(req);
  if (rateLimited) return rateLimited;

  const { ids } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 5) {
    return NextResponse.json({ error: "Provide 1-5 anime IDs" }, { status: 400 });
  }

  try {
    const safeIds = ids.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0).slice(0, 5);
    if (safeIds.length === 0) {
      return NextResponse.json({ error: "Provide 1-5 valid anime IDs" }, { status: 400 });
    }
    const media = await Promise.all(safeIds.map((id) => getAnimeDetailFull(id)));
    const resolved = media.filter(Boolean);

    const rows = resolved.map((m) => ({
      id: m!.id,
      title: bestTitle(m!.title),
      originalTitle: m!.title?.romaji || m!.title?.english || "",
      nativeTitle: m!.title?.native || "",
      coverImage: m!.coverImage?.large || m!.coverImage?.medium || null,
      averageScore: m!.averageScore || null,
      popularity: m!.popularity || null,
      favourites: m!.favourites || null,
      format: m!.format || null,
      status: m!.status || null,
      episodes: m!.episodes || null,
      duration: m!.duration || null,
      season: m!.season || null,
      seasonYear: m!.seasonYear || null,
      genres: m!.genres || [],
      studios: (m!.studios?.nodes || []).map((s) => s.name),
      source: m!.source || null,
      startDate: m!.startDate || null,
      endDate: m!.endDate || null,
      bannerImage: m!.bannerImage || null,
      color: m!.coverImage?.color || null,
    }));

    return NextResponse.json({ media: rows });
  } catch (err) {
    console.error("compare-anime failed", err);
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
  }
}