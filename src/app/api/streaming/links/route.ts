import { NextRequest, NextResponse } from "next/server";
import { getAnimeDetailFull } from "@/lib/anilist";
import { withPublicCache } from "@/lib/api-cache";
import { curatedSearchLinks, directLinksFromAniList } from "@/lib/streaming-links";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Official watch links for one anime (mobile detail screen).
 *
 * This is separate from `/api/streaming`, which resolves curated sources from a
 * title for the website. AniList supplies direct title/episode URLs where it
 * has them; if it does not, we return searches on official platforms only —
 * the app never receives an unvetted URL to open.
 */
async function GET_inner(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idRaw = Number(searchParams.get("id"));
  const id = Number.isFinite(idRaw) && idRaw > 0 ? Math.floor(idRaw) : null;
  const title = (searchParams.get("title") || "").trim().slice(0, 120);

  let direct = [] as ReturnType<typeof directLinksFromAniList>;
  let mediaTitle = title;

  if (id) {
    try {
      const media = await getAnimeDetailFull(id);
      mediaTitle =
        media?.title?.english || media?.title?.romaji || media?.title?.userPreferred || title;
      direct = directLinksFromAniList(media?.externalLinks, media?.streamingEpisodes);
    } catch {
      // AniList throttling must not blank the section; curated links survive.
    }
  }

  const curated = curatedSearchLinks(mediaTitle || title);
  const seen = new Set(direct.map((link) => link.url));
  const links = [
    ...direct,
    ...curated.filter((link) => !seen.has(link.url)).slice(0, 4),
  ];

  return NextResponse.json(
    {
      success: true,
      id,
      title: mediaTitle || null,
      links,
    },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } }
  );
}

export async function GET(...args: Parameters<typeof GET_inner>) {
  const res = await GET_inner(...args);
  return withPublicCache(res);
}
