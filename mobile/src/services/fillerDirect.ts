/**
 * Direct filler lookup for the Android app.
 *
 * The website's /api/filler/[id] route reads one public AniFiller release JSON
 * and does all matching in memory. There is no reason for the phone to call
 * zyverse.in just to get that same file: we download it straight from GitHub,
 * keep it on device, and reuse the website's strict lookup order:
 * AniList id -> MAL id -> normalised title/alias/slug.
 *
 * The guide result itself is still cached by getFiller() in api.ts (5 minutes).
 * This module only caches the shared 2.5MB dataset (24 hours fresh, 7 days
 * stale) so one download serves every anime and survives weak/offline moments.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const FILLER_JSON_URL =
  'https://github.com/AniraTeam/AniFiller/releases/latest/download/anifiller.json';
const RAW_CACHE_KEY = 'zt_anifiller_raw_v1';
const TIME_CACHE_KEY = 'zt_anifiller_time_v1';

const DATA_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// The full release file is ~2.5MB and GitHub's first-byte latency can be slow
// on mobile, so this deliberately exceeds the 25s default used for API reads.
const DOWNLOAD_TIMEOUT_MS = 60 * 1000;

interface FillerEpisode {
  episode: number;
  title?: string;
  type: string;
  aired_date?: string;
}

interface FillerShow {
  slug: string;
  title: string;
  mappings?: { anilist_id?: number; mal_id?: number };
  episodes?: FillerEpisode[];
}

export interface DirectFillerLookup {
  anilistId?: number;
  malId?: number;
  title?: string;
  aliases?: string[];
}

/** Shape consumed by parseFillerResponse() in api.ts. */
export interface DirectFillerResponse {
  found: true;
  title: string;
  total: number;
  fillerPercent: number;
  episodes: Array<{ episode: number; type: string; title?: string }>;
}

interface DatasetCache {
  data: FillerShow[];
  timestamp: number;
}

let datasetCache: DatasetCache | null = null;
let datasetRequest: Promise<FillerShow[]> | null = null;

function isFillerShowArray(value: unknown): value is FillerShow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (show) =>
        show &&
        typeof show === 'object' &&
        typeof (show as FillerShow).title === 'string' &&
        Array.isArray((show as FillerShow).episodes)
    )
  );
}

function parseDataset(raw: string): FillerShow[] {
  const parsed: unknown = JSON.parse(raw);
  if (!isFillerShowArray(parsed)) throw new Error('Invalid AniFiller dataset');
  return parsed;
}

async function readCachedDataset(): Promise<{ raw: string | null; timestamp: number }> {
  try {
    const [raw, timestamp] = await AsyncStorage.multiGet([RAW_CACHE_KEY, TIME_CACHE_KEY]);
    return { raw: raw[1], timestamp: Number(timestamp[1]) || 0 };
  } catch {
    return { raw: null, timestamp: 0 };
  }
}

async function writeCachedDataset(raw: string, timestamp: number): Promise<void> {
  try {
    // Store the original text, not a re-stringified object: it is smaller and
    // avoids a second JSON.stringify pass over ~12k episodes on the UI thread.
    await AsyncStorage.multiSet([
      [RAW_CACHE_KEY, raw],
      [TIME_CACHE_KEY, String(timestamp)],
    ]);
  } catch {
    // Storage limits differ by device. The in-memory copy still works for this
    // session, so a failed cache write must not fail the lookup.
  }
}

async function downloadDataset(): Promise<{ raw: string; timestamp: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(FILLER_JSON_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AniFiller download failed (${response.status})`);
    const raw = await response.text();
    if (!raw) throw new Error('AniFiller download was empty');
    return { raw, timestamp: Date.now() };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Filler guide download timed out. Check your connection.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function loadDataset(): Promise<FillerShow[]> {
  const now = Date.now();
  if (datasetCache && now - datasetCache.timestamp < DATA_TTL_MS) {
    return datasetCache.data;
  }
  if (datasetRequest) return datasetRequest;

  const request = (async () => {
    const cached = await readCachedDataset();

    if (cached.raw && cached.timestamp > 0 && now - cached.timestamp < DATA_TTL_MS) {
      try {
        const data = parseDataset(cached.raw);
        datasetCache = { data, timestamp: cached.timestamp };
        return data;
      } catch {
        // Corrupt/partial storage write: ignore it and download a clean copy.
      }
    }

    try {
      const fresh = await downloadDataset();
      const data = parseDataset(fresh.raw);
      datasetCache = { data, timestamp: fresh.timestamp };
      await writeCachedDataset(fresh.raw, fresh.timestamp);
      return data;
    } catch (error) {
      if (datasetCache && Date.now() - datasetCache.timestamp < STALE_TTL_MS) {
        return datasetCache.data;
      }
      if (cached.raw && cached.timestamp > 0 && Date.now() - cached.timestamp < STALE_TTL_MS) {
        try {
          const data = parseDataset(cached.raw);
          datasetCache = { data, timestamp: cached.timestamp };
          return data;
        } catch {
          // Fall through to the original download error.
        }
      }
      throw error;
    }
  })();

  datasetRequest = request;
  request
    .catch(() => {})
    .finally(() => {
      if (datasetRequest === request) datasetRequest = null;
    });
  return request;
}

function normalizeTitle(value: string): string {
  let text = value.toLowerCase();
  if (typeof text.normalize === 'function') {
    try {
      text = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    } catch {
      // Older Hermes builds may not ship Unicode normalisation; the
      // alphanumeric filter below still handles the common ASCII case.
    }
  }
  return text.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Every string we are willing to compare. Only derived from real rows. */
function titleCandidates(...values: (string | undefined)[]): string[] {
  const candidates: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const raw = value.trim();
    if (!raw) continue;
    const normalized = normalizeTitle(raw);
    if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
    // "Frieren: Beyond Journey's End" -> "frieren"; slugs use dashes.
    for (const variant of [raw.split(':')[0], raw.replace(/[-_]+/g, ' ')]) {
      const extra = normalizeTitle(variant || '');
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
  if (shorter.length < 5) return false;
  if (!longer.startsWith(`${shorter} `)) return false;
  return shorter.length / longer.length >= 0.35;
}

function matchByTitle(all: FillerShow[], lookup: DirectFillerLookup): FillerShow | null {
  const wanted = titleCandidates(lookup.title, ...(lookup.aliases || []));
  if (wanted.length === 0) return null;

  const exact = all.filter((show) =>
    showCandidates(show).some((candidate) => wanted.includes(candidate))
  );
  if (exact.length === 1) return exact[0];

  const prefix = all.filter((show) =>
    showCandidates(show).some((candidate) =>
      wanted.some((wantedCandidate) => isSafePrefix(wantedCandidate, candidate))
    )
  );
  return prefix.length === 1 ? prefix[0] : null;
}

export interface FillerGuideSummary {
  slug: string;
  title: string;
  anilistId?: number;
  malId?: number;
  fillerCount: number;
  episodeCount: number;
}

/** Lightweight rows for the native "all filler lists" browser. */
export async function listDirectFillerGuides(search = ''): Promise<FillerGuideSummary[]> {
  const all = await loadDataset();
  const needle = normalizeTitle(search);
  return all
    .map((show) => {
      const episodes = show.episodes || [];
      return {
        slug: show.slug,
        title: show.title,
        anilistId: Number(show.mappings?.anilist_id) || undefined,
        malId: Number(show.mappings?.mal_id) || undefined,
        fillerCount: episodes.filter((episode) => episode.type.toLowerCase() === 'filler').length,
        episodeCount: episodes.length,
      };
    })
    .filter((guide) => !needle || normalizeTitle(guide.title).includes(needle))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Returns null for an honest "no guide" (same as the website route). Throws on
 * download/parse failure so the existing Retry UI in FillerGuideScreen works.
 */
export async function lookupDirectFiller(
  lookup: DirectFillerLookup
): Promise<DirectFillerResponse | null> {
  const all = await loadDataset();
  const anilistId = Number(lookup.anilistId);
  const malId = Number(lookup.malId);

  let show: FillerShow | null = null;
  if (Number.isFinite(anilistId) && anilistId > 0) {
    show = all.find((item) => Number(item.mappings?.anilist_id) === anilistId) || null;
  }
  if (!show && Number.isFinite(malId) && malId > 0) {
    show = all.find((item) => Number(item.mappings?.mal_id) === malId) || null;
  }
  if (!show) show = matchByTitle(all, lookup);
  if (!show) return null;

  const episodes = (show.episodes || []).map((episode) => ({
    episode: Number(episode.episode),
    type: String(episode.type || ''),
    title: typeof episode.title === 'string' ? episode.title : undefined,
  }));
  const total = episodes.length;
  const filler = episodes.filter((episode) => episode.type.toLowerCase() === 'filler').length;

  return {
    found: true,
    title: show.title,
    total,
    fillerPercent: total > 0 ? Math.round((filler / total) * 100) : 0,
    episodes,
  };
}
