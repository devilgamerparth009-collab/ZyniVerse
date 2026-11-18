import { getMediaBatch, bestTitle } from "@/lib/anilist";

const FILLER_JSON_URL = "https://github.com/AniraTeam/AniFiller/releases/latest/download/anifiller.json";

interface CacheEntry {
  data: FillerShow[];
  timestamp: number;
}

let fillerCache: CacheEntry | null = null;
// Matches the 24h `next: { revalidate }` below. Every cold instance pays one
// 3.3MB GitHub download (Next's data cache refuses entries over 2MB), so a
// longer in-memory TTL directly cuts repeated 3.3MB fetches per instance.
// AniFiller publishes weekly, so 24h staleness is harmless.
const CACHE_TTL = 24 * 3600 * 1000;

// Serve the last good copy even past the TTL. This file is a single 3.2MB
// GitHub download, so a transient failure would otherwise blank every filler
// page and the sitemap at once.
const STALE_TTL = 7 * 24 * 60 * 60 * 1000;

export interface FillerEpisode {
  episode: number;
  title: string;
  type: "manga-canon" | "filler" | "mixed-manga" | "anime-canon";
  aired_date: string;
}

export interface FillerShow {
  slug: string;
  title: string;
  mappings: { anilist_id: number; mal_id: number };
  episodes: FillerEpisode[];
}

async function fetchFillerData(): Promise<FillerShow[]> {
  if (fillerCache && Date.now() - fillerCache.timestamp < CACHE_TTL) {
    return fillerCache.data;
  }
  const res = await fetch(FILLER_JSON_URL, {
    // Was `cache: "no-store"`, which forced every route that reads filler
    // data to render dynamically — including /sitemap.xml, so crawlers hit a
    // slow DB+AniList render on every request. Next caps data-cache entries at
    // 2MB and this file is 3.2MB, so the response itself isn't stored, but the
    // in-memory `fillerCache` above already avoids repeat downloads within a
    // warm instance. Using `revalidate` lets the sitemap and /filler pages
    // prerender/cache again instead of being permanently dynamic.
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Failed to fetch filler data (${res.status})`);
  const data: FillerShow[] = await res.json();
  fillerCache = { data, timestamp: Date.now() };
  return data;
}

export async function getFillerData(): Promise<FillerShow[]> {
  try {
    return await fetchFillerData();
  } catch (error) {
    if (fillerCache && Date.now() - fillerCache.timestamp < STALE_TTL) {
      console.warn(
        `[filler] AniFiller download failed (${error instanceof Error ? error.message : String(error)}) — serving cached copy.`,
      );
      return fillerCache.data;
    }
    throw error;
  }
}

export function getFillerDataFromCache(): FillerShow[] {
  if (!fillerCache || Date.now() - fillerCache.timestamp >= CACHE_TTL) {
    throw new Error("Filler data not cached");
  }
  return fillerCache.data;
}

export interface FillerLookupOptions {
  /** AniList media id — the strictest, preferred identifier. */
  anilistId?: number;
  /** MyAnimeList id — present on almost every AniFiller row. */
  malId?: number;
  /** Primary title supplied by the caller. */
  title?: string;
  /** Alternate titles (romaji / english / native) supplied by the caller. */
  aliases?: string[];
}

/*
 * The old animefillerlist.com scraper is retired. Its selector expected
 * `class="episode"`, while the live site renders `class="Number"` /
 * `class="Title"` / `class="Type"` cells (verified against a real fetch).
 * Worse, it fabricated rows with `mappings: { 0, 0 }` and defaulted unknown
 * types to "filler", so a broken parse could become a plausible-looking guide.
 * The curated AniFiller release is now the single source of truth: a miss is
 * reported honestly instead of silently turning into an empty/invented guide.
 */

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every string we are willing to compare. Only derived from real rows. */
function titleCandidates(...values: (string | undefined)[]): string[] {
  const candidates: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const raw = value.trim();
    if (!raw) continue;
    const normalized = normalizeTitle(raw);
    if (normalized) candidates.push(normalized);
    // "Frieren: Beyond Journey's End" -> "frieren"; slugs use dashes.
    for (const variant of [raw.split(":")[0], raw.replace(/[-_]+/g, " ")]) {
      const extra = normalizeTitle(variant || "");
      if (extra && !candidates.includes(extra)) candidates.push(extra);
    }
  }
  return [...new Set(candidates)];
}

function showCandidates(show: FillerShow): string[] {
  return titleCandidates(show.title, show.slug);
}

function isSafePrefix(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 5) return false; // "one", "s" etc. are too ambiguous
  if (!longer.startsWith(`${shorter} `)) return false;
  // Require the shared prefix to be a meaningful part of the longer title.
  return shorter.length / longer.length >= 0.35;
}

function matchByTitle(all: FillerShow[], query: FillerLookupOptions): FillerShow | null {
  const wanted = titleCandidates(query.title, ...(query.aliases || []));
  if (wanted.length === 0) return null;

  // Tier 3a: exact normalised title / alias / slug equality.
  const exact = all.filter((show) =>
    showCandidates(show).some((candidate) => wanted.includes(candidate))
  );
  if (exact.length === 1) return exact[0];

  // Tier 3b: distinctive leading title ("Frieren" -> "Frieren: Beyond
  // Journey's End"). Ambiguous matches are rejected rather than guessed.
  const prefix = all.filter((show) =>
    showCandidates(show).some((candidate) =>
      wanted.some((wantedCandidate) => isSafePrefix(wantedCandidate, candidate))
    )
  );
  return prefix.length === 1 ? prefix[0] : null;
}

function computeQuickList(episodes: FillerEpisode[]): Record<string, string[]> {
  const grouped: Record<string, number[]> = {};
  for (const ep of episodes) {
    if (!grouped[ep.type]) grouped[ep.type] = [];
    grouped[ep.type].push(ep.episode);
  }
  const result: Record<string, string[]> = {};
  for (const [type, nums] of Object.entries(grouped)) {
    nums.sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = nums[0];
    let end = nums[0];
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] === end + 1) {
        end = nums[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = nums[i];
        end = nums[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    result[type] = ranges;
  }
  return result;
}

/**
 * Resolve a guide with the strictest identifier available:
 *   1. AniList id  2. MAL id  3. normalised title / alias / slug.
 * Only rows from the curated dataset are ever returned — nothing is invented.
 * The legacy `(anilistId, title)` call shape is preserved for existing callers.
 */
export async function getFillerForAnime(
  lookup: number | FillerLookupOptions,
  legacy?: string | Omit<FillerLookupOptions, "anilistId">
) {
  const options: FillerLookupOptions =
    typeof lookup === "number"
      ? {
          anilistId: lookup,
          ...(typeof legacy === "string" ? { title: legacy } : legacy || {}),
        }
      : { ...lookup };

  const all = await getFillerData();
  const anilistId = Number(options.anilistId);
  const malId = Number(options.malId);

  let show: FillerShow | null = null;

  if (Number.isFinite(anilistId) && anilistId > 0) {
    show = all.find((s) => s.mappings?.anilist_id === anilistId) || null;
  }
  if (!show && Number.isFinite(malId) && malId > 0) {
    show = all.find((s) => s.mappings?.mal_id === malId) || null;
  }
  if (!show) {
    show = matchByTitle(all, options);
  }
  if (!show) return null;

  // A legitimately empty episode list is still a found guide. The UI decides
  // how to present "no filler episodes listed"; it must not become a miss.
  const episodes = show.episodes ?? [];
  const total = episodes.length;
  const filler = episodes.filter((e) => e.type === "filler").length;
  const mangaCanon = episodes.filter((e) => e.type === "manga-canon").length;
  const animeCanon = episodes.filter((e) => e.type === "anime-canon").length;
  const mixed = episodes.filter((e) => e.type === "mixed-manga").length;

  return {
    slug: show.slug,
    title: show.title,
    total,
    filler,
    mangaCanon,
    animeCanon,
    mixed,
    fillerPercent: total > 0 ? Math.round((filler / total) * 100) : 0,
    episodes,
    quickList: computeQuickList(episodes),
  };
}

export async function getPopularFillerAnime(limit = 20) {
  const all = await getFillerData();
  const popularIds = [
    20, 1735, 21, 5114, 813, 16498, 11061, 269,
  ];
  const result: {
    id: number;
    title: string;
    slug: string;
    episodes: number;
    fillerPct: number;
    canonPct: number;
    mixedPct: number;
    coverImage: string | null;
  }[] = [];
  for (const id of popularIds) {
    const show = all.find((s) => s.mappings.anilist_id === id);
    if (!show || show.episodes.length === 0) continue;
    const total = show.episodes.length;
    const filler = show.episodes.filter((e) => e.type === "filler").length;
    const mangaCanon = show.episodes.filter((e) => e.type === "manga-canon").length;
    const animeCanon = show.episodes.filter((e) => e.type === "anime-canon").length;
    const mixed = show.episodes.filter((e) => e.type === "mixed-manga").length;
    const canonTotal = mangaCanon + animeCanon;
    const fillerPct = total > 0 ? Math.round((filler / total) * 100) : 0;
    const canonPct = total > 0 ? Math.round((canonTotal / total) * 100) : 0;
    const mixedPct = total > 0 ? Math.round((mixed / total) * 100) : 0;
    result.push({ id, title: show.title, slug: show.slug, episodes: total, fillerPct, canonPct, mixedPct, coverImage: null });
    if (result.length >= limit) break;
  }

  const mediaData = await getMediaBatch(result.map((r) => r.id));
  const mediaMap = new Map(mediaData.map((m) => [m.id, m]));
  for (const item of result) {
    const media = mediaMap.get(item.id);
    if (media) {
      item.title = bestTitle(media.title);
      item.coverImage = media.coverImage?.extraLarge || media.coverImage?.large || null;
    }
  }

  return result;
}

export function clearFillerCache(): void {
  fillerCache = null;
}

export type FillerResult = Awaited<ReturnType<typeof getFillerForAnime>>;
