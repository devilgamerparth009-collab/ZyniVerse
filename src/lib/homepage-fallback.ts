import type { HomepageData } from "./anilist";
import snapshot from "./homepage-fallback.json";

/**
 * A real AniList snapshot of the four homepage rails.
 *
 * Why this exists: the homepage is prerendered at build time, and AniList rate
 * limits per IP (~30 req/min). A Vercel build prerenders hundreds of routes
 * from one IP, so the homepage's `getHomepageData()` call is regularly the one
 * that gets a 429. When that happens the whole page is baked with four empty
 * arrays and — because `revalidate` is measured in hours — every visitor sees
 * the empty "✦ Spotlight" hero and no cards until the next window.
 *
 * This snapshot is only a safety net: it is used for a rail whose live result
 * came back empty (or when the whole fetch failed), and ISR replaces it with
 * fresh AniList data on the next revalidation. Refresh it occasionally with:
 *   /api/anilist/trending?perPage=24
 *   /api/anilist/popular?perPage=27
 *   /api/anilist/upcoming?perPage=12   (take `.media`)
 *   /api/anilist/top-rated?perPage=12
 * Snapshot captured: 2026-11-05.
 */
const fallback = snapshot as unknown as HomepageData;

/**
 * Fill any empty rail (or a completely failed fetch) with the snapshot so the
 * page always renders real titles, posters and descriptions.
 */
export function withHomepageFallback(
  data: Partial<HomepageData> | null | undefined,
): HomepageData {
  return {
    trending: data?.trending?.length ? data.trending : fallback.trending,
    popular: data?.popular?.length ? data.popular : fallback.popular,
    upcoming: data?.upcoming?.length ? data.upcoming : fallback.upcoming,
    topRated: data?.topRated?.length ? data.topRated : fallback.topRated,
  };
}
