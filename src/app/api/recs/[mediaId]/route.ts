import { NextRequest, NextResponse } from "next/server";

type MediaKind = "ANIME" | "MANGA";

interface JikanNameItem {
  mal_id: number;
  name: string;
  type?: string;
  url?: string;
}

interface JikanDetail {
  genres?: JikanNameItem[];
  themes?: JikanNameItem[];
  studios?: JikanNameItem[];
  authors?: JikanNameItem[];
  source?: string;
  type?: string;
}

interface JikanEntry {
  mal_id: number;
  title: string;
  url: string;
  source?: string;
  type?: string;
  genres?: JikanNameItem[];
  themes?: JikanNameItem[];
  studios?: JikanNameItem[];
  authors?: JikanNameItem[];
  images?: { jpg?: { image_url?: string }; webp?: { image_url?: string } };
}

interface JikanRec {
  entry: JikanEntry;
}

// Public, non-personalised data -> safe to cache at the Vercel CDN. Without an
// explicit s-maxage every request is a MISS and a billed Node render.
const PUBLIC_CACHE = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };
const SHORT_CACHE = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params;
  const queryType = req.nextUrl.searchParams.get("type")?.toUpperCase();
  const kind: MediaKind = queryType === "MANGA" ? "MANGA" : "ANIME";
  const providedMalId = Number(req.nextUrl.searchParams.get("malId"));
  const routeId = parseInt(mediaId, 10);
  const id = Number.isInteger(providedMalId) && providedMalId > 0 ? providedMalId : routeId;
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ recs: [], reason: "" }, { headers: SHORT_CACHE });
  }

  const source = kind === "MANGA" ? "manga" : "anime";

  try {
    const [detailResp, recsResp] = await Promise.all([
      fetch(`https://api.jikan.moe/v4/${source}/${id}`, { signal: AbortSignal.timeout(6000) }),
      fetch(`https://api.jikan.moe/v4/${source}/${id}/recommendations`, { signal: AbortSignal.timeout(6000) }),
    ]);

    if (!detailResp.ok || !recsResp.ok) {
      return NextResponse.json({ recs: [], reason: "" }, { headers: SHORT_CACHE });
    }

    const detailData = await detailResp.json();
    const recsData = await recsResp.json();
    const detail = detailData.data as JikanDetail | null;

    const genres = new Set((detail?.genres || []).map((g) => g.name));
    const themes = new Set((detail?.themes || []).map((t) => t.name));
    const studios = new Set((detail?.studios || []).map((s) => s.name));
    const authors = new Set((detail?.authors || []).map((a) => a.name));
    const sourceName = detail?.source || "";
    const format = detail?.type || "";

    const recs = (recsData.data || []).slice(0, 8).map((r: JikanRec) => {
      const entry = r.entry;
      const reasons: string[] = [];
      const entryGenres = new Set((entry.genres || []).map((g) => g.name));
      const entryThemes = new Set((entry.themes || []).map((t) => t.name));
      const entryAuthors = new Set((entry.authors || []).map((a) => a.name));

      const sharedGenres = [...genres].filter((g) => entryGenres.has(g));
      if (sharedGenres.length > 0) reasons.push(`Same ${sharedGenres.slice(0, 2).join(", ")} genre`);

      const sharedThemes = [...themes].filter((t) => entryThemes.has(t));
      if (sharedThemes.length > 0) reasons.push(`Shares ${sharedThemes[0]} theme`);

      const sharedAuthors = [...authors].filter((a) => entryAuthors.has(a));
      if (sharedAuthors.length > 0) reasons.push(`Same creator: ${sharedAuthors[0]}`);

      if (sourceName && entry.source === sourceName) reasons.push(`Same source (${sourceName})`);
      if (format && entry.type === format) reasons.push(`Same format (${format})`);

      if (kind === "ANIME") {
        const entryStudios = new Set((entry.studios || []).map((s) => s.name));
        const sharedStudios = [...studios].filter((s) => entryStudios.has(s));
        if (sharedStudios.length > 0) reasons.push(`Same studio: ${sharedStudios[0]}`);
      }

      return {
        malId: entry.mal_id,
        title: entry.title,
        image: entry.images?.jpg?.image_url || entry.images?.webp?.image_url || "",
        url: entry.url,
        reason: reasons[0] || "Similar community taste",
        allReasons: reasons.length > 0 ? reasons : ["Similar community taste"],
      };
    });

    return NextResponse.json({ recs, kind, total: recs.length }, { headers: PUBLIC_CACHE });
  } catch {
    // Jikan is frequently rate-limited or slow. Never hang the function —
    // return a cheap, briefly cached empty result instead of a 500.
    return NextResponse.json({ recs: [], reason: "" }, { headers: SHORT_CACHE });
  }
}
