/**
 * Fresh poster artwork for the dub hubs.
 *
 * The imported dub dataset stores old MyAnimeList/WordPress CDN URLs. Those
 * paths rotate or block hotlinking, so a large share of Dub Hub cards arrive
 * with a dead `posterUrl`. AniList covers are stable, so this module repairs
 * them in two ways:
 *   1. by MAL id, when an editorial entry carries `mal_id`;
 *   2. by a strictly matched title, for scraped dub-catalog rows that have no
 *      id at all (the common case in `/dub/catalog` and `/dub/schedule`).
 *
 * Results are memoised per instance and persisted in `epgCache`, so a slow or
 * rate-limited AniList call can never blank the grid on later requests.
 */

import { prisma } from "./prisma";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const TTL_MS = 24 * 60 * 60 * 1000;
const BATCH = 50;
const TITLE_CONCURRENCY = 6;
/** Reserved `epgCache.channelId` row holding the resolved covers. */
const CACHE_KEY = "__dub_posters__";

const COVER_QUERY = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: ${BATCH}) {
      media(idMal_in: $ids, type: ANIME) {
        idMal
        coverImage { extraLarge large }
      }
    }
  }
`;

const TITLE_QUERY = `
  query ($search: String) {
    Page(page: 1, perPage: 6) {
      media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) {
        id
        idMal
        title { romaji english native userPreferred }
        coverImage { extraLarge large }
      }
    }
  }
`;

type CoverMap = Map<string, string>;

type Memo = {
  at: number;
  posters: CoverMap;
  titles: CoverMap;
};

type PosterEntry = { mal_id: number; image: string };
type TitleEntry = { title: string; posterUrl: string | null };

let memo: Memo | null = null;
let inFlight: Promise<CoverMap> | null = null;
const titleFlights = new Map<string, Promise<string | null>>();
let dbLoaded = false;

function asMap(entries: Record<string, string> | undefined | null): CoverMap {
  const map: CoverMap = new Map();
  for (const [key, value] of Object.entries(entries || {})) {
    if (key && value) map.set(key, value);
  }
  return map;
}

async function readCache(): Promise<{ posters: CoverMap; titles: CoverMap }> {
  if (dbLoaded && memo) return { posters: memo.posters, titles: memo.titles };
  try {
    const row = await prisma.epgCache.findUnique({ where: { channelId: CACHE_KEY } });
    const data = row?.data as unknown as
      | { posters?: Record<string, string>; titleCovers?: Record<string, string> }
      | null;
    dbLoaded = true;
    return { posters: asMap(data?.posters), titles: asMap(data?.titleCovers) };
  } catch {
    // A missing table row just means we resolve from AniList.
    dbLoaded = true;
    return { posters: new Map(), titles: new Map() };
  }
}

async function writeCache(posters: CoverMap, titles: CoverMap): Promise<void> {
  if (!posters.size && !titles.size) return;
  try {
    const posterObject: Record<string, string> = {};
    posters.forEach((url, id) => {
      posterObject[id] = url;
    });
    const titleObject: Record<string, string> = {};
    titles.forEach((url, key) => {
      titleObject[key] = url;
    });
    await prisma.epgCache.upsert({
      where: { channelId: CACHE_KEY },
      update: { data: { posters: posterObject, titleCovers: titleObject }, updatedAt: new Date() },
      create: { channelId: CACHE_KEY, data: { posters: posterObject, titleCovers: titleObject } },
    });
  } catch {
    // Non-fatal: the in-memory copy still serves this instance.
  }
}

async function fetchBatch(ids: number[]): Promise<CoverMap> {
  const out: CoverMap = new Map();
  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: COVER_QUERY, variables: { ids } }),
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return out;
    const json = (await res.json()) as {
      data?: {
        Page?: {
          media?: {
            idMal?: number;
            coverImage?: { extraLarge?: string; large?: string };
          }[];
        };
      };
    };
    for (const media of json?.data?.Page?.media ?? []) {
      const url = media?.coverImage?.extraLarge || media?.coverImage?.large;
      if (media?.idMal && url) out.set(String(media.idMal), url);
    }
  } catch {
    // Best effort: a poster is not worth failing a page over.
  }
  return out;
}

async function loadCovers(ids: number[]): Promise<CoverMap> {
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += BATCH) chunks.push(ids.slice(i, i + BATCH));
  const maps = await Promise.all(chunks.map(fetchBatch));
  const merged: CoverMap = new Map();
  for (const map of maps) map.forEach((url, id) => merged.set(id, url));
  return merged;
}

/** Removes language/season noise before an AniList title comparison. */
function cleanDubTitle(value: string): string {
  return (value || "")
    .replace(/\s*\((?:Hindi|Tamil|Telugu|Kannada|Malayalam|Bengali|Marathi|English|Dub(?:bed)?|Movie|Film|TV|Series|Season\s*\d+|S\d+)[^)]*\)/gi, " ")
    .replace(/\b(?:hindi|tamil|telugu|kannada|malayalam|bengali|marathi|dubbed|dub|movie|film|tv series|season\s*\d+|s\d+)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dubTitleKey(value: string): string {
  return cleanDubTitle(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function coverOf(media: any): string | null {
  return media?.coverImage?.extraLarge || media?.coverImage?.large || null;
}

async function fetchTitleCover(search: string, key: string): Promise<string | null> {
  const existing = titleFlights.get(key);
  if (existing) return existing;

  const flight = (async () => {
    try {
      const res = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: TITLE_QUERY, variables: { search } }),
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 86400 },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: { Page?: { media?: any[] } } };
      const media = json?.data?.Page?.media || [];
      if (!media.length) return null;

      const names = media.map((item) => ({
        item,
        keys: [
          item?.title?.english,
          item?.title?.romaji,
          item?.title?.native,
          item?.title?.userPreferred,
        ]
          .map((title: string | undefined) => dubTitleKey(title || ""))
          .filter(Boolean),
      }));

      // Exact title wins. A unique, confident substring match is allowed for
      // scraped rows with a trailing season/episode marker. Ambiguous results
      // are rejected instead of showing a wrong series poster.
      const exact = names.find((entry) => entry.keys.includes(key));
      if (exact) return coverOf(exact.item);

      const partial = names.filter((entry) =>
        entry.keys.some((candidate) =>
          candidate.length >= 5 && key.length >= 5 &&
          (candidate.includes(key) || key.includes(candidate))
        )
      );
      const unique = Array.from(new Map(partial.map((entry) => [entry.item?.id, entry])).values());
      return unique.length === 1 ? coverOf(unique[0].item) : null;
    } catch {
      return null;
    }
  })().finally(() => {
    titleFlights.delete(key);
  });

  titleFlights.set(key, flight);
  return flight;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

function needsCoverRepair(url: string | null | undefined): boolean {
  if (!url) return true;
  return /myanimelist\.net|cdn\.mal\.|wordpress\.com\/wp-content|blogspot/i.test(url);
}

/**
 * Replaces `image` with AniList's cover for every entry that resolves by MAL id.
 */
export async function withFreshDubPosters<T extends PosterEntry>(entries: T[]): Promise<T[]> {
  if (!entries.length) return entries;

  const ids = Array.from(
    new Set(entries.map((e) => e.mal_id).filter((id) => Number.isFinite(id) && id > 0))
  );
  if (!ids.length) return entries;

  const now = Date.now();
  const stored = await readCache();
  if (!memo) memo = { at: now, posters: stored.posters, titles: stored.titles };

  const missing = ids.filter((id) => !memo?.posters.has(String(id)));
  const stale = !memo || now - memo.at > TTL_MS;
  if (stale || missing.length) {
    if (!inFlight) {
      inFlight = loadCovers(stale ? ids : missing).finally(() => {
        inFlight = null;
      });
    }
    const fetched = await inFlight;
    if (fetched.size) {
      const posters = new Map(memo.posters);
      fetched.forEach((url, id) => posters.set(id, url));
      memo = { at: now, posters, titles: memo.titles };
      void writeCache(posters, memo.titles);
    }
  }

  const resolved = memo?.posters ?? stored.posters;
  if (!resolved.size) return entries;

  return entries.map((entry) => {
    const cover = resolved.get(String(entry.mal_id));
    return cover && cover !== entry.image ? { ...entry, image: cover } : entry;
  });
}

/**
 * Repairs scraped dub rows that have no MAL id, using a strict title match.
 * Only missing/known-rotting URLs are looked up, and failures leave the
 * original URL untouched.
 */
export async function withFreshDubCovers<T extends TitleEntry>(entries: T[]): Promise<T[]> {
  const targets = entries.filter((entry) => needsCoverRepair(entry.posterUrl) && dubTitleKey(entry.title));
  if (!targets.length) return entries;

  const searches = new Map<string, string>();
  for (const entry of targets) {
    const key = dubTitleKey(entry.title);
    if (key && !searches.has(key)) searches.set(key, cleanDubTitle(entry.title) || entry.title);
  }
  if (!searches.size) return entries;

  const now = Date.now();
  const stored = await readCache();
  if (!memo) memo = { at: now, posters: stored.posters, titles: stored.titles };

  const keys = Array.from(searches.keys());
  const missing = keys.filter((key) => !memo?.titles.has(key));
  const stale = !memo || now - memo.at > TTL_MS;
  if (stale || missing.length) {
    const toFetch = stale ? keys : missing;
    await mapWithConcurrency(toFetch, TITLE_CONCURRENCY, async (key) => {
      const cover = await fetchTitleCover(searches.get(key) || key, key);
      if (cover && memo) memo.titles.set(key, cover);
    });
    if (memo) void writeCache(memo.posters, memo.titles);
  }

  const resolved = memo?.titles ?? stored.titles;
  if (!resolved.size) return entries;

  return entries.map((entry) => {
    const cover = resolved.get(dubTitleKey(entry.title));
    return cover && cover !== entry.posterUrl ? { ...entry, posterUrl: cover } : entry;
  });
}
