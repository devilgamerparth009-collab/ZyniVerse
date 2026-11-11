/**
 * Fresh poster artwork for the dub hubs.
 *
 * The editorial dub dataset stores MyAnimeList CDN URLs that were correct when
 * it was written. MAL rotates those paths (`/images/anime/<id>/<hash>.jpg`), so
 * a third of them now 404 — which is exactly why posters went missing on the
 * website's dub pages and in the app's Dub Schedule screen.
 *
 * AniList's cover images are stable, so we resolve every entry by `idMal` and
 * prefer those. Two batched GraphQL calls cover the whole dataset, and the
 * result is kept in three places so a rate-limit window can never blank the
 * grid again:
 *   1. a module memo (per lambda instance),
 *   2. Next's data cache (24h) on the fetch itself,
 *   3. the `epgCache` table under a reserved key (survives cold starts).
 */

import { prisma } from "./prisma";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const TTL_MS = 24 * 60 * 60 * 1000;
const BATCH = 50;
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

type WithPoster = { mal_id: number; image: string };

type CoverMap = Map<number, string>;

let memo: { at: number; map: CoverMap } | null = null;
let inFlight: Promise<CoverMap> | null = null;
let dbLoaded = false;

async function readDb(): Promise<CoverMap> {
  const map: CoverMap = new Map();
  if (dbLoaded) return map;
  try {
    const row = await prisma.epgCache.findUnique({ where: { channelId: CACHE_KEY } });
    const data = row?.data as unknown as { posters?: Record<string, string> } | null;
    for (const [id, url] of Object.entries(data?.posters || {})) {
      const n = Number(id);
      if (Number.isFinite(n) && url) map.set(n, url);
    }
    dbLoaded = true;
  } catch {
    // Best effort — a missing table row just means we resolve from AniList.
  }
  return map;
}

async function writeDb(map: CoverMap): Promise<void> {
  if (!map.size) return;
  try {
    const posters: Record<string, string> = {};
    map.forEach((url, id) => {
      posters[String(id)] = url;
    });
    await prisma.epgCache.upsert({
      where: { channelId: CACHE_KEY },
      update: { data: { posters }, updatedAt: new Date() },
      create: { channelId: CACHE_KEY, data: { posters } },
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
      if (media?.idMal && url) out.set(media.idMal, url);
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

/**
 * Replaces `image` with AniList's cover for every entry that resolves.
 * Entries AniList does not know keep whatever URL they already had.
 */
export async function withFreshDubPosters<T extends WithPoster>(
  entries: T[]
): Promise<T[]> {
  if (!entries.length) return entries;

  const ids = Array.from(
    new Set(entries.map((e) => e.mal_id).filter((id) => Number.isFinite(id) && id > 0))
  );
  if (!ids.length) return entries;

  const now = Date.now();
  const stored = await readDb();
  if (!memo && stored.size) memo = { at: now, map: stored };

  const missing = ids.filter((id) => !memo?.map.has(id));
  const stale = !memo || now - memo.at > TTL_MS;
  if (stale || missing.length) {
    if (!inFlight) {
      inFlight = loadCovers(stale ? ids : missing).finally(() => {
        inFlight = null;
      });
    }
    const fetched = await inFlight;
    if (fetched.size) {
      const merged: CoverMap = new Map(memo?.map ?? stored);
      fetched.forEach((url, id) => merged.set(id, url));
      memo = { at: now, map: merged };
      void writeDb(merged);
    }
  }

  const resolved = memo?.map ?? stored;
  if (!resolved.size) return entries;

  return entries.map((entry) => {
    const cover = resolved.get(entry.mal_id);
    return cover && cover !== entry.image ? { ...entry, image: cover } : entry;
  });
}
