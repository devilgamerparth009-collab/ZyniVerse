import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchMangaDex } from "@/lib/manga-reader";

const CACHE = new Map<string, { data: unknown; ts: number }>();
const TITLE_DEX_CACHE = new Map<string, { id: string | null; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000;
const DEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Public stats -> cache at the Vercel CDN too, so repeat crawls of the same
// manga never re-run the MangaDex lookup + MAL HTML scrape.
const CDN_CACHE = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };
const SHORT_CACHE = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" };

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

function malField(html: string, labels: string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      escaped + ":\\s*(?:<[^>]+>\\s*)?([\\s\\S]{0,600}?)(?:<\\/div>|<\\/td>|$)",
      "i",
    );
    const match = html.match(re);
    if (!match) continue;
    const value = decodeHtmlEntities(match[1].replace(/<[^>]*>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (value && value.length < 140) return value;
  }
  return "";
}

async function fetchMangaDexStats(
  dexId: string,
): Promise<{ average: number; bayesian: number; follows: number } | null> {
  if (!DEX_UUID.test(dexId)) return null;
  try {
    const res = await fetch(`https://api.mangadex.org/statistics/manga/${dexId}`, {
      headers: { "User-Agent": "ZyniVerse/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const stats = data.statistics?.[dexId] || data.statistics || {};
    return {
      average: Number(stats.rating?.average) || 0,
      bayesian: Number(stats.rating?.bayesian) || 0,
      follows: Number(stats.follows) || 0,
    };
  } catch {
    return null;
  }
}

async function fetchMalMangaInfo(
  malId: number,
): Promise<{ magazine: string; publisher: string; serialization: string } | null> {
  if (!Number.isInteger(malId) || malId <= 0) return null;
  try {
    const res = await fetch(`https://myanimelist.net/manga/${malId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const result = {
      magazine: malField(html, ["Magazines", "Magazine"]),
      publisher: malField(html, ["Publishers", "Publisher"]),
      serialization: malField(html, ["Serialization"]),
    };
    return result.magazine || result.publisher || result.serialization ? result : null;
  } catch {
    return null;
  }
}

async function resolveDexId(
  dexId: string | null,
  title: string | null,
  mediaId: number,
): Promise<string | null> {
  if (dexId && DEX_UUID.test(dexId)) return dexId;

  if (Number.isInteger(mediaId) && mediaId > 0) {
    try {
      const cached = await prisma.mangaDexCache.findUnique({ where: { mediaId } });
      if (cached && DEX_UUID.test(cached.mangaDexId)) return cached.mangaDexId;
    } catch {
      // DB cache is optional; fall through to the public resolver.
    }
  }

  const query = title?.trim().slice(0, 120);
  if (!query) return null;

  const cached = TITLE_DEX_CACHE.get(query);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.id;

  try {
    const results = await searchMangaDex(query);
    const q = query.toLowerCase();
    const best =
      results.find((r) => r.title.toLowerCase() === q) ||
      results.find((r) =>
        r.altTitles.some((alt) => alt.toLowerCase() === q),
      ) ||
      results.find((r) => r.title.toLowerCase().includes(q) || q.includes(r.title.toLowerCase()));
    const id = best?.id && DEX_UUID.test(best.id) ? best.id : null;
    TITLE_DEX_CACHE.set(query, { id, ts: Date.now() });
    return id;
  } catch {
    TITLE_DEX_CACHE.set(query, { id: null, ts: Date.now() });
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid manga ID" }, { status: 400 });
  }
  const search = req.nextUrl.searchParams;
  const malId = Number(search.get("malId"));
  const dexId = await resolveDexId(search.get("dexId"), search.get("title"), Number(id));
  const safeMalId = Number.isInteger(malId) && malId > 0 ? malId : 0;

  const cacheKey = `manga-ratings-v2-${dexId || "nodex"}-${safeMalId || "nomal"}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data, { headers: CDN_CACHE });
  }

  try {
    const [mangadexStats, malInfo] = await Promise.all([
      fetchMangaDexStats(dexId || ""),
      fetchMalMangaInfo(safeMalId),
    ]);

    const result = { mangadex: mangadexStats, mal: malInfo };
    if (CACHE.size > 500) CACHE.delete(CACHE.keys().next().value as string);
    CACHE.set(cacheKey, { data: result, ts: Date.now() });
    return NextResponse.json(result, { headers: CDN_CACHE });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch manga data" },
      { status: 502, headers: SHORT_CACHE },
    );
  }
}
