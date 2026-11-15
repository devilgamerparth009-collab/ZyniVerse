import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { NativeModules } from 'react-native';
import {
  Anime,
  CharacterEdge,
  CharactersResponse,
  DubStatus,
  DubScheduleLanguage,
  DubScheduleResponse,
  FillerData,
  ForumCategory,
  ForumPost,
  ForumThread,
  DnaProfile,
  MangaChapter,
  MangaEntry,
  MangaListResponse,
  MediaPage,
  NotificationItem,
  ProfileResponse,
  ReviewItem,
  ScheduleItem,
  SearchSuggestion,
  User,
  VibeResponse,
  WatchParty,
  WatchPartyMessage,
  WatchPartySearchResult,
  WatchPartySyncState,
  WatchlistItem,
} from '../types';

const WEB_HOST = 'https://zyverse.in';
const WEB_API = `${WEB_HOST}/api`;
const ANILIST_GQL = 'https://graphql.anilist.co';

const DEVICE_KEY = 'zt_ct_device';
const SESSION_COOKIE_KEY = 'zt_session_cookie';
let cachedDevice: string | null = null;

// Lightweight last-known-good cache: serves fresh data when online and
// falls back to the cached copy when the network is unavailable. This keeps
// the app usable offline instead of showing a bare error screen.
const CACHE_PREFIX = 'zt_cache_v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const REQUEST_TIMEOUT_MS = 25 * 1000;

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; v: T };
    if (Date.now() - parsed.t > CACHE_TTL_MS) return null;
    return parsed.v;
  } catch {
    return null;
  }
}

async function cacheSet<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${CACHE_PREFIX}_${key}`,
      JSON.stringify({ t: Date.now(), v: value } as { t: number; v: T })
    );
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/**
 * How long a cached copy may hold the screen while the network request keeps
 * running. The CDN answers a warm route in ~50 ms, so a fast network always
 * wins the race and the user still sees live data. Only a genuinely slow
 * request (cold scrape, AniList hiccup, weak mobile signal) falls back to the
 * last known copy — which is far better than a spinner.
 */
const CACHE_FIRST_GRACE_MS = 600;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** De-duplicates concurrent requests for the same key (e.g. Home + Browse). */
const inFlightReads = new Map<string, Promise<unknown>>();

async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  let network = inFlightReads.get(key) as Promise<T> | undefined;
  if (!network) {
    network = (async () => {
      const live = await fetcher();
      await cacheSet(key, live);
      return live;
    })();
    inFlightReads.set(key, network);
    network
      .catch(() => {})
      .finally(() => {
        if (inFlightReads.get(key) === network) inFlightReads.delete(key);
      });
  }

  const cached = await cacheGet<T>(key);
  if (cached === null) return network;

  const first = await Promise.race([
    network.then(
      (value) => ({ kind: 'fresh' as const, value }),
      (error) => ({ kind: 'error' as const, error })
    ),
    wait(CACHE_FIRST_GRACE_MS).then(() => ({ kind: 'slow' as const })),
  ]);

  if (first.kind === 'fresh') return first.value;
  if (first.kind === 'error') return cached;
  // Slow network: paint the cached copy now, let the request finish quietly so
  // the next visit is fresher.
  network.catch(() => {});
  return cached;
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const base = `${WEB_API}${path}`;
  if (!params) return base;
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return query ? `${base}?${query}` : base;
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Request timed out. Check your connection.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  try {
    const res = await fetchWithTimeout(url, init);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg =
        (body && (body.error || body.message)) || `API Error: ${res.status}`;
      throw new Error(msg);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Request timed out. Check your connection.');
    throw e;
  }
}

export async function getDeviceId(): Promise<string> {
  if (cachedDevice) return cachedDevice;
  try {
    let d = await AsyncStorage.getItem(DEVICE_KEY);
    if (!d || !/^[A-Za-z0-9_-]{8,64}$/.test(d)) {
      d = `ztm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem(DEVICE_KEY, d);
    }
    cachedDevice = d;
    return d;
  } catch {
    return `ztm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

function normalizeAnime(raw: any): Anime {
  if (!raw) return raw;
  if (raw.idMal != null && raw.malId == null) raw.malId = raw.idMal;
  if (raw.malId != null && raw.idMal == null) raw.idMal = raw.malId;
  return raw as Anime;
}

/* ------------------------------------------------------------------ */
/* Auth / session cookie handling                                      */
/* ------------------------------------------------------------------ */

async function saveSessionToStorage(stored: string, user?: User | null): Promise<void> {
  // A different account must never see the previous one's cached reads.
  await clearReadCache();
  try {
    await SecureStore.setItemAsync(SESSION_COOKIE_KEY, stored);
  } catch {}
  try {
    await AsyncStorage.setItem(SESSION_COOKIE_KEY, stored);
    if (user) {
      await AsyncStorage.setItem('zv_cached_user', JSON.stringify(user));
    }
  } catch {}
}

async function readCookie(): Promise<string | null> {
  try {
    const val = await SecureStore.getItemAsync(SESSION_COOKIE_KEY);
    if (val) return val;
  } catch {}
  try {
    return await AsyncStorage.getItem(SESSION_COOKIE_KEY);
  } catch {
    return null;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const cookie = cookieForHeader(await readCookie());
  return cookie ? { Cookie: cookie } : {};
}

function extractAuthCookies(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw =
      (res.headers as any)?.get?.('set-cookie') ||
      (res.headers as any)?.map?.['set-cookie'];
    const values: string[] = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
    // Only keep NextAuth cookie name/value pairs. Set-Cookie attributes
    // (Path, Expires with commas, HttpOnly, ...) must never be echoed back.
    const re = /(?:__Secure-|__Host-)?(?:authjs|next-auth)\.[A-Za-z0-9._-]+=[^;,\s]*/g;
    for (const value of values) {
      const matches = value.match(re) || [];
      for (const pair of matches) {
        const eq = pair.indexOf('=');
        if (eq > 0) out[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

function serializeCookies(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function hasSessionCookie(jar: Record<string, string>): boolean {
  return Object.keys(jar).some((k) => k.includes('session-token'));
}

// React Native's Android networking layer keeps its own cookie jar (backed by
// the WebView CookieManager), which persists across app restarts. When the
// platform hides the Set-Cookie header we mark the session as "native jar" and
// let fetch attach the cookie automatically instead of sending a Cookie header.
const NATIVE_JAR_MARKER = '__native_cookie_jar__';

function cookieForHeader(stored: string | null): string | undefined {
  return stored && stored !== NATIVE_JAR_MARKER ? stored : undefined;
}

async function fetchSessionUser(storedCookie: string | null): Promise<User | null> {
  try {
    const cookie = cookieForHeader(storedCookie);
    const res = await fetchWithTimeout(`${WEB_HOST}/api/auth/session`, {
      headers: { Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.user) return null;
    return {
      id: json.user.id || '',
      username: json.user.name || json.user.email || 'User',
      email: json.user.email || '',
      avatar: json.user.image || undefined,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const stored = await readCookie();
  if (!stored) {
    try {
      const cached = await AsyncStorage.getItem('zv_cached_user');
      if (cached) return JSON.parse(cached) as User;
    } catch {}
    return null;
  }
  const live = await fetchSessionUser(stored);
  if (live) {
    try {
      await AsyncStorage.setItem('zv_cached_user', JSON.stringify(live));
    } catch {}
    return live;
  }
  try {
    const cached = await AsyncStorage.getItem('zv_cached_user');
    if (cached) return JSON.parse(cached) as User;
  } catch {}
  return null;
}

async function login(email: string, password: string): Promise<User> {
  const csrfRes = await fetchWithTimeout(`${WEB_HOST}/api/auth/csrf`, {
    headers: { Accept: 'application/json' },
  });
  const csrf = (await csrfRes.json().catch(() => ({ csrfToken: '' }))) as {
    csrfToken: string;
  };
  if (!csrf.csrfToken) throw new Error('Could not reach ZyniVerse login');

  const jar = extractAuthCookies(csrfRes);
  const cookieHeader = serializeCookies(jar);

  // `X-Auth-Return-Redirect` makes Auth.js answer with a JSON body instead of a
  // 302. React Native follows redirects unconditionally, which would drop the
  // session Set-Cookie header; a plain 200 keeps it visible to fetch().
  const res = await fetchWithTimeout(`${WEB_HOST}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'X-Auth-Return-Redirect': '1',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password,
      callbackUrl: `${WEB_HOST}/`,
      json: 'true',
    }).toString(),
  });

  let callbackError: string | null = null;
  try {
    const payload = await res.json();
    const url = typeof payload?.url === 'string' ? payload.url : '';
    const match = url.match(/[?&]error=([^&]+)/);
    if (match) callbackError = decodeURIComponent(match[1]);
  } catch {
    /* not JSON – fall through to the session check */
  }

  if (callbackError) {
    throw new Error(
      callbackError === 'CredentialsSignin'
        ? 'Invalid email or password'
        : 'Sign in failed. Please try again.'
    );
  }

  const merged = { ...jar, ...extractAuthCookies(res) };
  const captured = hasSessionCookie(merged);
  const stored = captured ? serializeCookies(merged) : NATIVE_JAR_MARKER;

  const user = await fetchSessionUser(stored);
  if (!user) {
    throw new Error('Invalid email or password');
  }
  await saveSessionToStorage(stored, user);
  return user;
}

async function register(
  email: string,
  username: string,
  password: string
): Promise<User> {
  await requestJson(`${WEB_API}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'register', email, username, password }),
  });
  return login(email, password);
}

async function clearNativeCookies(): Promise<void> {
  try {
    const networking = (NativeModules as any)?.Networking;
    if (networking?.clearCookies) {
      await new Promise<void>((resolve) => {
        try {
          networking.clearCookies(() => resolve());
        } catch {
          resolve();
        }
      });
    }
  } catch {
    /* ignore */
  }
}

async function logout(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_COOKIE_KEY);
  } catch {
    /* ignore */
  }
  try {
    await AsyncStorage.removeItem(SESSION_COOKIE_KEY);
    await AsyncStorage.removeItem('zv_cached_user');
  } catch {
    /* ignore */
  }
  // Drop the platform cookie jar too, otherwise the next request could still
  // carry the old session even though the app UI is signed out.
  await clearNativeCookies();
  await clearReadCache();
}

/**
 * Wipes every cached read. Personalized payloads (liked/followed flags) must
 * never survive an account switch, so this runs on both sign-in and sign-out.
 */
async function clearReadCache(): Promise<void> {
  inFlightReads.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(`${CACHE_PREFIX}_`));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export async function isLoggedIn(): Promise<boolean> {
  return (await readCookie()) !== null;
}

/**
 * Whether the in-app WebView needs a session hand-off before opening a
 * signed-in page. OAuth sign-ins already live in the platform cookie jar that
 * Android shares with the WebView, so only an explicitly stored cookie (email
 * sign-in) has to be bridged.
 */
export async function needsWebBridge(): Promise<boolean> {
  const stored = await readCookie();
  return !!stored && stored !== NATIVE_JAR_MARKER;
}

/** Two-minute token that `/auth/mobile-web` exchanges for a real cookie. */
export async function getWebBridgeToken(): Promise<string | null> {
  try {
    const data = await authedGet<{ token?: string }>('/auth/mobile-web-token');
    return data?.token || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* AniList / public media                                              */
/* ------------------------------------------------------------------ */

const ANIME_DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      idMal
      title { romaji english native userPreferred }
      coverImage { extraLarge large medium color }
      bannerImage
      description(asHtml: false)
      type
      format
      status(version: 2)
      episodes
      duration
      countryOfOrigin
      source(version: 2)
      genres
      averageScore
      meanScore
      popularity
      favourites
      startDate { year month day }
      endDate { year month day }
      season
      seasonYear
      studios(isMain: true) { nodes { id name } }
      trailer { id site thumbnail }
      siteUrl
      nextAiringEpisode { episode airingAt }
    }
  }`;

async function animeById(id: number): Promise<Anime> {
  return fetchWithCache(`anime_${id}`, async () => {
    const res = await fetchWithTimeout(ANILIST_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: ANIME_DETAIL_QUERY, variables: { id } }),
    });
    if (!res.ok) throw new Error(`Could not load anime (${res.status})`);
    const json = await res.json().catch(() => null);
    if (json?.errors?.length) throw new Error(json.errors[0].message || 'Anime not found');
    if (!json?.data?.Media) throw new Error('Anime not found');
    return normalizeAnime(json.data.Media);
  });
}

async function listAnime(
  path: string,
  params: Record<string, string> = {}
): Promise<Anime[]> {
  const key = `list_${path.replace(/[^a-zA-Z0-9]/g, '_')}_${Object.values(params).join('_')}`;
  return fetchWithCache(key, async () => {
    const data = await requestJson<any>(buildUrl(path, params));
    const arr = Array.isArray(data) ? data : data?.media || data?.results || [];
    return (arr as any[]).map(normalizeAnime);
  });
}

async function pagedAnime(
  path: string,
  params: Record<string, string | number | undefined> = {},
  cacheKey?: string
): Promise<MediaPage> {
  const run = async (): Promise<MediaPage> => {
    const data = await requestJson<any>(buildUrl(path, params));
    return {
      pageInfo: data?.pageInfo || { hasNextPage: false, total: 0 },
      media: ((data?.media || []) as any[]).map(normalizeAnime),
    };
  };
  if (cacheKey) return fetchWithCache(cacheKey, run);
  return run();
}

async function browse(params: {
  page?: number;
  perPage?: number;
  search?: string;
  genre?: string;
  sort?: string;
  format?: string;
  status?: string;
  type?: 'ANIME' | 'MANGA';
}): Promise<MediaPage> {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 24;
  const key = `browse_${page}_${perPage}_${params.search || ''}_${params.genre || ''}_${
    params.sort || ''
  }_${params.format || ''}_${params.status || ''}_${params.type || 'ANIME'}`;
  return pagedAnime(
    '/anilist/search-media',
    {
      page,
      perPage,
      search: params.search,
      genre: params.genre,
      sort: params.sort || 'POPULARITY_DESC',
      format: params.format,
      status: params.status,
      type: params.type || 'ANIME',
    },
    page === 1 ? key : undefined
  );
}

async function suggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query.trim()) return [];
  return fetchWithCache(`suggest_${query.trim().toLowerCase()}`, async () => {
    const data = await requestJson<any[]>(
      buildUrl('/anilist/suggestions', { q: query.trim() })
    );
    return Array.isArray(data) ? data : [];
  });
}

async function getGenres(): Promise<string[]> {
  return fetchWithCache('genres', async () => {
    const data = await requestJson<string[]>(`${WEB_API}/anilist/genres`);
    return Array.isArray(data) ? data.filter((g) => g !== 'Hentai' && g !== 'Ecchi') : [];
  });
}

async function getCharacters(mediaId: number, page = 1): Promise<CharactersResponse> {
  const key = `chars_${mediaId}_${page}`;
  return fetchWithCache(key, async () => {
    const data = await requestJson<CharactersResponse>(
      buildUrl(`/anilist/characters/${mediaId}`, { page, perPage: 25 })
    );
    return {
      id: data?.id ?? mediaId,
      title: data?.title,
      coverImage: data?.coverImage,
      pageInfo: data?.pageInfo || { hasNextPage: false, total: 0 },
      edges: (data?.edges || []) as CharacterEdge[],
    };
  });
}

async function recommendations(genre: string, perPage = 18): Promise<Anime[]> {
  if (!genre) return [];
  return fetchWithCache(`recs_${genre}_${perPage}`, async () => {
    const data = await requestJson<any[]>(
      buildUrl('/anilist/recommendations', { genre, perPage })
    );
    return (Array.isArray(data) ? data : []).map(normalizeAnime);
  });
}

async function batchMedia(ids: number[]): Promise<Anime[]> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id)))].slice(0, 50);
  if (unique.length === 0) return [];
  return requestJson<{ media: Anime[] }>(`${WEB_API}/anilist/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: unique }),
  }).then((d) => (d?.media || []).map(normalizeAnime));
}

async function getFiller(id: number): Promise<FillerData> {
  return fetchWithCache(`filler_${id}`, async () => {
    const data = await requestJson<any>(`${WEB_API}/filler/${id}`);
    const episodes = ((data?.episodes || []) as any[]).map((e) => {
      const rawType = String(e.type || '').toLowerCase();
      const type: FillerData['episodes'][number]['type'] =
        rawType === 'filler' ? 'filler' : rawType.includes('mixed') ? 'mixed' : 'canon';
      return { episode: e.episode, type, title: e.title };
    });
    const totalFillers = episodes.filter((e) => e.type === 'filler').length;
    const total = Number(data?.total) || episodes.length;
    return {
      animeId: id,
      title: data?.title || 'Unknown',
      totalEpisodes: total,
      totalFillers,
      fillerPercentage:
        data?.fillerPercent != null
          ? Number(data.fillerPercent)
          : total > 0
            ? Math.round((totalFillers / total) * 100)
            : 0,
      episodes,
    };
  });
}

async function getDubStatus(malId: number): Promise<DubStatus> {
  const data = await requestJson<any>(`${WEB_API}/anime-dub-status?malId=${malId}`);
  const details = data?.details || {};
  const available: string[] = (data?.available || []).map((l: string) =>
    String(l).toLowerCase()
  );
  return {
    malId,
    title: data?.title || '',
    english: { available: !!details.hasEnglish || available.includes('english') },
    hindi: { available: !!details.hasHindi || available.includes('hindi') },
    tamil: { available: !!details.hasTamil || available.includes('tamil') },
    telugu: { available: !!details.hasTelugu || available.includes('telugu') },
  } as DubStatus;
}

async function getDubSchedule(language: DubScheduleLanguage): Promise<DubScheduleResponse> {
  const data = await fetchWithCache(`dub_schedule_${language}`, () =>
    requestJson<any>(`${WEB_API}/dub-schedule?language=${language}`)
  );
  if (!data?.success) throw new Error(data?.error || 'Could not load dub schedule');
  return {
    success: true,
    source: data.source,
    counts: data.counts || {
      total: 0,
      hindi: 0,
      tamil: 0,
      telugu: 0,
      english: 0,
      currentSeason: 0,
      available: 0,
      comingSoon: 0,
      recent: 0,
    },
    data: {
      currentSeason: data.data?.currentSeason || [],
      available: data.data?.available || [],
      comingSoon: data.data?.comingSoon || [],
      recent: data.data?.recent || [],
    },
  };
}

async function getSchedule(): Promise<ScheduleItem[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 6 * 3600;
  const to = now + 7 * 24 * 3600;
  const data = await requestJson<any[]>(
    `${WEB_API}/anilist/airing-schedule?from=${from}&to=${to}`
  );
  if (!Array.isArray(data)) return [];
  return data.map((entry: any) => ({
    mediaId: entry?.media?.id,
    title:
      entry?.media?.title?.english ||
      entry?.media?.title?.romaji ||
      'Unknown',
    episode: entry?.episode,
    airingAt: entry?.airingAt ? new Date(entry.airingAt * 1000).toISOString() : '',
    timeUntilAiring: entry?.airingAt ? entry.airingAt - now : 0,
    media: normalizeAnime(entry?.media),
  })) as ScheduleItem[];
}

async function search(
  query: string,
  type: 'all' | 'anime' | 'manga'
): Promise<Anime[]> {
  if (!query.trim()) return [];
  if (type === 'manga') {
    const page = await browse({ search: query.trim(), type: 'MANGA', perPage: 30 });
    return page.media;
  }
  const data = await requestJson<any>(
    buildUrl('/anilist/search', { q: query.trim() })
  );
  let results: any[] = data?.results || [];
  if (type === 'anime') results = results.filter((r) => r.type === 'ANIME');
  return results.map(normalizeAnime);
}

/* ------------------------------------------------------------------ */
/* Authenticated user data                                             */
/* ------------------------------------------------------------------ */

async function authedGet<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  return requestJson<T>(buildUrl(path, params), { headers: await authHeader() });
}

async function authedPost<T>(
  path: string,
  body?: unknown,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
): Promise<T> {
  return requestJson<T>(buildUrl(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function getWatchlist(): Promise<WatchlistItem[]> {
  const data = await authedGet<{ items: WatchlistItem[] }>('/watchlist');
  return data?.items || [];
}

async function addToWatchlist(input: {
  mediaId: number;
  status: string;
  type?: string;
  mediaTitle?: string;
  mediaImage?: string;
}): Promise<void> {
  await authedPost('/watchlist', {
    mediaId: input.mediaId,
    type: input.type || 'ANIME',
    action: 'add',
    status: input.status,
    mediaTitle: input.mediaTitle,
    mediaImage: input.mediaImage,
  });
}

async function editWatchlist(input: {
  mediaId: number;
  status?: string;
  progress?: number;
  total?: number;
  score?: number | null;
  type?: string;
}): Promise<void> {
  await authedPost('/watchlist', {
    ...input,
    mediaId: input.mediaId,
    type: input.type || 'ANIME',
    action: 'edit',
  });
}

async function removeFromWatchlist(mediaId: number): Promise<void> {
  await authedPost('/watchlist', { mediaId, action: 'remove' });
}

async function rateAnime(mediaId: number, score: number, type = 'ANIME'): Promise<void> {
  await authedPost('/watchlist', {
    mediaId,
    type,
    action: 'rate',
    score,
  });
}

async function getProfile(): Promise<ProfileResponse> {
  return authedGet<ProfileResponse>('/profile');
}

async function updateProfile(patch: {
  username?: string;
  bio?: string;
  avatar?: string;
  banner?: string;
  signature?: string;
  themeColor?: string;
  currentPassword?: string;
  newPassword?: string;
}): Promise<void> {
  await authedPost('/profile', patch, 'PATCH');
}

/**
 * Uploads a local image (picked from the gallery) to the website and returns
 * the public URL. Used by the profile editor so people can actually choose a
 * picture instead of pasting a URL.
 */
async function uploadImage(file: {
  uri: string;
  name?: string;
  type?: string;
}): Promise<string> {
  const name = file.name || `upload-${Date.now()}.jpg`;
  const type = file.type || guessMime(name);
  const form = new FormData();
  // React Native accepts this `{ uri, name, type }` shape for file parts.
  form.append('file', { uri: file.uri, name, type } as any);

  const res = await fetchWithTimeout(`${WEB_API}/upload`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...(await authHeader()) },
    body: form,
    timeoutMs: 45000,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      (body && (body.error || body.message)) || `Upload failed (${res.status})`
    );
  }

  const data = (await res.json()) as { url?: string };
  if (!data?.url) throw new Error('Upload did not return a URL');
  return data.url.startsWith('http') ? data.url : `${WEB_HOST}${data.url}`;
}

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function trackEpisode(input: {
  mediaId: number;
  episode: number;
  title?: string;
  totalEpisodes?: number;
}): Promise<void> {
  await authedPost('/track/episode', input);
}

async function untrackEpisode(mediaId: number, episode: number): Promise<void> {
  await authedPost('/track/episode', { mediaId, episode }, 'DELETE');
}

async function getReviews(mediaId: number): Promise<ReviewItem[]> {
  const data = await requestJson<{ reviews: ReviewItem[] }>(
    buildUrl('/reviews', { mediaId })
  );
  return data?.reviews || [];
}

async function submitReview(input: {
  mediaId: number;
  rating: number;
  comment?: string;
  mediaTitle?: string;
  mediaImage?: string;
}): Promise<void> {
  await authedPost('/reviews', input);
}

async function getAchievements(): Promise<any> {
  return authedGet('/achievements/user');
}

/* ------------------------------------------------------------------ */
/* Forum                                                               */
/* ------------------------------------------------------------------ */

async function getForumCategories(): Promise<ForumCategory[]> {
  const data = await requestJson<{ categories: ForumCategory[] }>(
    `${WEB_API}/forum/categories`
  );
  return data?.categories || [];
}

async function getForumThreads(params: {
  category?: string;
  animeId?: number;
  page?: number;
  limit?: number;
  sort?: 'recent' | 'popular' | 'top';
  search?: string;
}): Promise<{ threads: ForumThread[]; total: number; page: number; limit: number }> {
  const data = await requestJson<any>(
    buildUrl('/forum/threads', {
      category: params.category,
      animeId: params.animeId,
      page: params.page || 1,
      limit: params.limit || 20,
      sort: params.sort || 'recent',
      search: params.search,
    })
  );
  return {
    threads: data?.threads || [],
    total: data?.total || 0,
    page: data?.page || 1,
    limit: data?.limit || 20,
  };
}

async function getForumThread(
  id: string,
  page = 1
): Promise<{ thread: ForumThread; posts: ForumPost[]; total: number; page: number; limit: number }> {
  const data = await requestJson<any>(
    buildUrl(`/forum/threads/${encodeURIComponent(id)}`, { page, limit: 50 })
  );
  return {
    thread: data?.thread,
    posts: data?.posts || [],
    total: data?.total || 0,
    page: data?.page || 1,
    limit: data?.limit || 50,
  };
}

async function createForumThread(input: {
  categoryId?: string;
  title: string;
  content: string;
  animeId?: number;
  animeTitle?: string;
  animeImage?: string;
}): Promise<ForumThread> {
  const data = await authedPost<{ thread: ForumThread }>('/forum/threads', input);
  return data.thread;
}

async function createForumPost(threadId: string, content: string): Promise<ForumPost> {
  const data = await authedPost<{ post: ForumPost }>(
    `/forum/threads/${encodeURIComponent(threadId)}/posts`,
    { content }
  );
  return data.post;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

async function getNotifications(limit = 50): Promise<{
  notifications: NotificationItem[];
  unreadCount: number;
  total: number;
}> {
  const data = await authedGet<any>('/notifications', { limit });
  return {
    notifications: data?.notifications || [],
    unreadCount: data?.unreadCount || 0,
    total: data?.total || 0,
  };
}

async function getUnreadCount(): Promise<number> {
  try {
    const data = await authedGet<{ count: number }>('/notifications/unread');
    return data?.count || 0;
  } catch {
    return 0;
  }
}

async function markNotificationsRead(): Promise<void> {
  await authedPost('/notifications', undefined, 'PUT');
}

async function getNotificationPrefs(): Promise<import('../types').NotificationPrefs> {
  const data = await authedGet<{ prefs: import('../types').NotificationPrefs }>(
    '/notifications/preferences'
  );
  return data?.prefs;
}

async function updateNotificationPrefs(
  patch: Partial<import('../types').NotificationPrefs>
): Promise<void> {
  await authedPost('/notifications/preferences', patch, 'PUT');
}

/* ------------------------------------------------------------------ */
/* Fun Zone — anime of the day, leaderboard, news, polls, quiz, games,  */
/* OSTs and wallpapers (all backed by the public website API)           */
/* ------------------------------------------------------------------ */

async function getAnimeOfTheDay(): Promise<import('../types').AnimeOfTheDay> {
  return fetchWithCache('aotd', () =>
    requestJson<import('../types').AnimeOfTheDay>(`${WEB_API}/anime-of-the-day`)
  );
}

async function getLeaderboard(limit = 50, offset = 0): Promise<import('../types').LeaderboardResponse> {
  return fetchWithCache(`leaderboard_${limit}_${offset}`, () =>
    requestJson<import('../types').LeaderboardResponse>(buildUrl('/leaderboard', { limit, offset }))
  );
}

async function getNews(type = 'all', period = 'all'): Promise<import('../types').NewsItem[]> {
  return fetchWithCache(`news_${type}_${period}`, async () => {
    const data = await requestJson<{ news: import('../types').NewsItem[] }>(
      buildUrl('/news', { type, period })
    );
    return data?.news || [];
  });
}

async function getPolls(
  page = 1,
  perPage = 20,
  activeOnly = false
): Promise<import('../types').PollsResponse> {
  const data = await requestJson<any>(
    buildUrl('/polls', { page, perPage, active: activeOnly ? 'true' : undefined })
  );
  return {
    polls: data?.polls || [],
    total: data?.total || 0,
    page: data?.page || page,
    perPage: data?.perPage || perPage,
  };
}

async function votePoll(pollId: string, optionId: string): Promise<import('../types').PollItem> {
  const data = await authedPost<{ poll: import('../types').PollItem }>(
    `/polls/${encodeURIComponent(pollId)}/vote`,
    { optionId }
  );
  return data.poll;
}

async function getDailyQuiz(): Promise<{
  questions: import('../types').QuizQuestion[];
  date: string;
}> {
  return fetchWithCache('quiz_daily', () =>
    requestJson<{ questions: import('../types').QuizQuestion[]; date: string }>(
      `${WEB_API}/quiz/daily`
    )
  );
}

async function checkQuizAnswer(
  questionId: string,
  answer: string
): Promise<import('../types').QuizCheckResult> {
  return requestJson<import('../types').QuizCheckResult>(`${WEB_API}/quiz/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, answer }),
  });
}

type GameMode = 'plot' | 'silhouette' | 'ost';

function gameEndpoint(mode: GameMode): string {
  return mode === 'plot'
    ? '/games/guess-plot'
    : mode === 'silhouette'
    ? '/games/silhouette'
    : '/games/guess-ost';
}

async function getDailyGame(mode: GameMode): Promise<any> {
  return fetchWithCache(`game_${mode}`, () =>
    requestJson<any>(`${WEB_API}${gameEndpoint(mode)}`)
  );
}

async function guessGame(
  mode: GameMode,
  guess: string,
  attempts: number
): Promise<import('../types').GameGuessResult> {
  return requestJson<import('../types').GameGuessResult>(`${WEB_API}${gameEndpoint(mode)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guess, attempts }),
  });
}

async function getOSTs(params: {
  search?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<import('../types').OSTResponse> {
  return requestJson<import('../types').OSTResponse>(
    buildUrl('/ost', {
      search: params.search,
      type: params.type,
      page: params.page ?? 1,
      limit: params.limit ?? 30,
    })
  );
}

async function getWallpapers(params: {
  sort?: 'recent' | 'popular' | 'downloads';
  category?: string;
  search?: string;
  page?: number;
  perPage?: number;
}): Promise<import('../types').WallpapersResponse> {
  return requestJson<import('../types').WallpapersResponse>(
    buildUrl('/wallpapers', {
      sort: params.sort || 'popular',
      category: params.category,
      search: params.search,
      page: params.page ?? 1,
      perPage: params.perPage ?? 24,
    })
  );
}

async function likeWallpaper(id: string): Promise<void> {
  await authedPost(`/wallpapers/${encodeURIComponent(id)}/like`, undefined);
}

/* ------------------------------------------------------------------ */
/* TV guide, reels & live dub uploads                                  */
/* ------------------------------------------------------------------ */

async function getTvSchedule(day?: string): Promise<import('../types').TvScheduleResponse> {
  const key = `tv_schedule_${day || 'today'}`;
  return fetchWithCache(key, () =>
    requestJson<import('../types').TvScheduleResponse>(
      buildUrl('/tv-schedule', { day }),
      { timeoutMs: 15000 }
    )
  );
}

/**
 * Last good TV grid, read straight from storage. Screens use this to paint
 * instantly on open and refresh underneath instead of showing a spinner.
 */
async function peekTvSchedule(day?: string): Promise<import('../types').TvScheduleResponse | null> {
  return cacheGet<import('../types').TvScheduleResponse>(`tv_schedule_${day || 'today'}`);
}

/**
 * The live TV grid is scraped from epg.pw at request time and can be slow.
 * It is therefore best-effort: a timeout simply means "no live grid right now".
 */
async function getTvScheduleLive(day?: string): Promise<import('../types').TvScheduleResponse | null> {
  try {
    const res = await fetchWithTimeout(buildUrl('/tv-schedule/live', { day }), {
      headers: { Accept: 'application/json' },
      timeoutMs: 12000,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as import('../types').TvScheduleResponse;
    return data?.channels?.length ? data : null;
  } catch {
    return null;
  }
}

async function getReels(
  page = 1,
  limit = 10,
  sort: 'newest' | 'popular' = 'newest',
  options: { following?: boolean; username?: string } = {}
): Promise<import('../types').ReelsResponse> {
  const key = `reels_${page}_${limit}_${sort}_${options.following ? 'f' : 'a'}_${options.username || ''}`;
  return fetchWithCache(key, async () => {
    const data = await requestJson<any>(
      buildUrl('/reels', {
        page,
        limit,
        sort,
        ...(options.following ? { following: 1 } : {}),
        ...(options.username ? { username: options.username } : {}),
      }),
      { headers: await authHeader() }
    );
    return {
      reels: data?.reels || [],
      hasMore: !!data?.hasMore,
      nextCursor: data?.nextCursor ?? null,
      page,
    };
  });
}

/** Follows (or unfollows) a creator. Returns the new state. */
async function toggleFollowUser(userId: string, follow: boolean): Promise<boolean> {
  if (!userId) return false;
  if (follow) {
    await authedPost('/follow', { followingId: userId });
    return true;
  }
  await authedPost('/follow', { followingId: userId }, 'DELETE');
  return false;
}

async function likeReel(id: string): Promise<void> {
  await authedPost(`/reels/${encodeURIComponent(id)}/like`, undefined);
}

async function viewReel(id: string): Promise<void> {
  try {
    await requestJson(`${WEB_API}/reels/${encodeURIComponent(id)}/view`, { method: 'POST' });
  } catch {
    // view counting is best-effort
  }
}

async function getLiveDubs(): Promise<import('../types').LiveDubsResponse> {
  return fetchWithCache('live_dubs', () =>
    requestJson<import('../types').LiveDubsResponse>(`${WEB_API}/live-dubs`)
  );
}

async function getReelComments(id: string): Promise<any> {
  return requestJson<any>(`${WEB_API}/reels/${encodeURIComponent(id)}/comments`);
}

async function postReelComment(id: string, content: string): Promise<any> {
  return authedPost(`/reels/${encodeURIComponent(id)}/comments`, { content });
}

async function reportReel(id: string, reason: string): Promise<any> {
  return authedPost(`/reels/${encodeURIComponent(id)}/report`, { reason });
}

async function postReel(payload: {
  videoUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  duration?: number;
  animeId?: number;
  animeTitle?: string;
}): Promise<any> {
  return authedPost('/reels', payload);
}

/** Stores a NextAuth session cookie captured from OAuth or login. */
export async function setSessionCookie(cookie: string, user?: User | null): Promise<void> {
  await saveSessionToStorage(cookie, user);
  if (user) {
    try {
      await AsyncStorage.setItem('zv_cached_user', JSON.stringify(user));
    } catch {}
    return;
  }
  const live = await fetchSessionUser(cookie);
  if (live) {
    try {
      await AsyncStorage.setItem('zv_cached_user', JSON.stringify(live));
    } catch {}
  }
}

/**
 * Android shares its cookie jar between the WebView and React Native's
 * networking layer, so after an OAuth round-trip inside the WebView the session
 * cookie is already attached to every fetch. This flag tells the API client to
 * stop sending an explicit Cookie header and rely on that shared jar.
 */
export async function useNativeCookieJar(): Promise<void> {
  await saveSessionToStorage(NATIVE_JAR_MARKER);
  const user = await fetchSessionUser(NATIVE_JAR_MARKER);
  if (user) {
    try {
      await AsyncStorage.setItem('zv_cached_user', JSON.stringify(user));
    } catch {}
  }
}

/** Which social providers are actually enabled on the server right now. */
export async function getAuthProviders(): Promise<Record<string, { id: string; name: string }>> {
  try {
    return await requestJson<Record<string, { id: string; name: string }>>(
      `${WEB_HOST}/api/auth/providers`
    );
  } catch {
    return { credentials: { id: 'credentials', name: 'Credentials' } };
  }
}

/**
 * Asks the website to start an OAuth flow the way its own buttons do (a CSRF
 * protected POST). Auth.js answers with the provider URL as JSON, which can
 * then be opened in the in-app WebView. A plain GET on the same endpoint is
 * what produces the "Server configuration" error page, so this is the fix.
 */
export async function startOAuth(
  provider: 'google' | 'github' | 'discord'
): Promise<string> {
  const csrfRes = await fetchWithTimeout(`${WEB_HOST}/api/auth/csrf`, { timeoutMs: 20000 });
  const csrf = (await csrfRes.json().catch(() => ({ csrfToken: '' }))) as { csrfToken?: string };
  if (!csrf?.csrfToken) throw new Error('Could not reach ZyniVerse sign-in');

  const jar = extractAuthCookies(csrfRes);
  const cookieHeader = serializeCookies(jar);

  const res = await fetchWithTimeout(
    `${WEB_HOST}/api/auth/signin/${provider}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'X-Auth-Return-Redirect': '1',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: `csrfToken=${encodeURIComponent(csrf.csrfToken)}&callbackUrl=${encodeURIComponent(
        `${WEB_HOST}/auth/mobile-done`
      )}`,
      timeoutMs: 20000,
    }
  );

  const data = (await res.json().catch(() => ({}))) as { url?: string };
  if (!data?.url) throw new Error('Sign-in could not be started. Please try again.');
  return data.url;
}

/* ------------------------------------------------------------------ */
/* Watch parties                                                       */
/* ------------------------------------------------------------------ */

async function getWatchParties(mine = false): Promise<WatchParty[]> {
  const data = await requestJson<{ parties?: WatchParty[] }>(
    buildUrl('/watch-party', mine ? { mine: 'true' } : undefined),
    { headers: await authHeader() }
  );
  return data?.parties || [];
}

async function getWatchParty(id: string): Promise<WatchParty> {
  // Cache-bust: a party is live state, never serve a stale copy.
  const data = await requestJson<{ party: WatchParty }>(
    buildUrl(`/watch-party/${id}`, { t: String(Date.now()) })
  );
  return data.party;
}

async function createWatchParty(input: {
  mediaId: number;
  mediaTitle: string;
  mediaImage?: string | null;
  coverImage?: string | null;
  clubId?: string;
}): Promise<WatchParty> {
  const data = await authedPost<{ party: WatchParty }>('/watch-party', input);
  return data.party;
}

async function updateWatchParty(
  id: string,
  patch: Record<string, unknown>
): Promise<WatchParty> {
  const data = await authedPost<{ party: WatchParty }>(`/watch-party/${id}`, patch, 'PUT');
  return data.party;
}

async function getWatchPartySync(id: string): Promise<WatchPartySyncState> {
  const data = await requestJson<{ party: WatchPartySyncState }>(
    buildUrl(`/watch-party/${id}/sync`, { t: String(Date.now()) })
  );
  return data.party;
}

async function joinWatchParty(id: string): Promise<void> {
  await authedPost(`/watch-party/${id}/join`);
}

async function leaveWatchParty(id: string): Promise<void> {
  await authedPost(`/watch-party/${id}/join`, undefined, 'DELETE');
}

async function searchWatchPartyAnime(q: string): Promise<WatchPartySearchResult[]> {
  const data = await requestJson<{ results?: WatchPartySearchResult[] }>(
    buildUrl('/watch-party/search', { q })
  );
  return data?.results || [];
}

/**
 * Party chat lives in the shared activity feed: every message is an Activity
 * row whose text starts with `[PARTY:<id>]`. Reading the latest 50 rows and
 * filtering client-side mirrors the web room exactly and needs no new schema.
 */
async function getWatchPartyMessages(id: string): Promise<WatchPartyMessage[]> {
  const data = await requestJson<{ activities?: any[] }>(
    buildUrl('/activity', { limit: '50' }),
    { headers: await authHeader() }
  );
  const tag = `[PARTY:${id}]`;
  return (data?.activities || [])
    .filter((a) => typeof a?.message === 'string' && a.message.startsWith(tag))
    .map((a) => ({
      id: String(a.id),
      userId: a.userId || a.user?.id || null,
      username: a.user?.username || 'Fan',
      avatar: a.user?.avatar || null,
      message: String(a.message).slice(tag.length).trim(),
      createdAt: a.createdAt,
    }))
    .reverse();
}

/* ------------------------------------------------------------------ */
/* Manga tracker                                                       */
/* ------------------------------------------------------------------ */

async function getMangaCatalog(
  tab: 'trending' | 'popular' | 'top' = 'trending',
  perPage = 24,
  type?: string
): Promise<Anime[]> {
  return listAnime('/anilist/manga', {
    tab,
    perPage: String(perPage),
    ...(type ? { type } : {}),
  });
}

async function getMangaList(params: {
  status?: string;
  type?: string;
  q?: string;
  sort?: string;
  page?: number;
  perPage?: number;
} = {}): Promise<MangaListResponse> {
  const query: Record<string, string> = {};
  if (params.status) query.status = params.status;
  if (params.type) query.type = params.type;
  if (params.q) query.q = params.q;
  if (params.sort) query.sort = params.sort;
  if (params.page) query.page = String(params.page);
  if (params.perPage) query.perPage = String(params.perPage);
  return authedGet<MangaListResponse>('/manga/list', query);
}

async function saveMangaEntry(input: {
  mediaId: number;
  title: string;
  coverImage?: string | null;
  status?: string;
  chapters?: number;
  volumes?: number;
  totalChapters?: number | null;
  totalVolumes?: number | null;
  score?: number | null;
  subType?: string;
}): Promise<MangaEntry> {
  const data = await authedPost<{ entry: MangaEntry }>('/manga/list', input);
  return data.entry;
}

async function removeMangaEntry(mediaId: number): Promise<void> {
  await authedPost('/manga/list', { mediaId }, 'DELETE');
}

async function getMangaChapters(
  mediaId: number
): Promise<{ chapters: MangaChapter[]; entry: MangaEntry | null }> {
  const data = await authedGet<{ chapters?: MangaChapter[]; entry?: MangaEntry | null }>(
    '/manga/chapters',
    { mediaId }
  );
  return { chapters: data?.chapters || [], entry: data?.entry || null };
}

async function toggleMangaChapter(input: {
  mediaId: number;
  chapter: number;
  title?: string | null;
  read?: boolean;
  mangaDexId?: string | null;
}): Promise<MangaChapter> {
  const data = await authedPost<{ chapter: MangaChapter }>('/manga/chapters', {
    read: true,
    ...input,
  });
  return data.chapter;
}

/* ------------------------------------------------------------------ */
/* Vibe + Anime DNA                                                    */
/* ------------------------------------------------------------------ */

async function getVibe(): Promise<VibeResponse> {
  return requestJson<VibeResponse>(buildUrl('/vibe'));
}

async function getAnimeDna(username: string): Promise<DnaProfile> {
  const data = await requestJson<{ profile: DnaProfile }>(
    buildUrl(`/dna/${encodeURIComponent(username)}`)
  );
  return data.profile;
}

/* ------------------------------------------------------------------ */
/* Public API object                                                   */
/* ------------------------------------------------------------------ */

export const api = {
  get: <T>(endpoint: string, options?: { params?: Record<string, string> }) =>
    requestJson<T>(buildUrl(endpoint, options?.params)),

  trending: {
    get: (perPage = 18) => listAnime('/anilist/trending', { perPage: String(perPage) }),
  },
  popular: {
    get: (perPage = 18) => listAnime('/anilist/popular', { perPage: String(perPage) }),
  },
  topRated: {
    get: (perPage = 18) => listAnime('/anilist/top-rated', { perPage: String(perPage) }),
  },
  seasonal: {
    get: (perPage = 18) =>
      pagedAnime('/anilist/seasonal', { perPage }, `seasonal_${perPage}`).then((p) => p.media),
  },
  upcoming: {
    get: (page = 1, perPage = 18) =>
      pagedAnime('/anilist/upcoming', { page, perPage }, page === 1 ? `upcoming_${perPage}` : undefined),
  },

  browse,
  suggestions,
  genres: getGenres,
  characters: getCharacters,
  recommendations,
  batch: batchMedia,

  anime: { get: animeById, list: listAnime },
  filler: { get: getFiller },
  dubStatus: { get: getDubStatus },
  dubSchedule: { get: getDubSchedule },
  schedule: { get: getSchedule },
  search,

  auth: {
    login,
    register,
    logout,
    current: getCurrentUser,
    isLoggedIn,
    providers: getAuthProviders,
    startOAuth,
    setCookie: setSessionCookie,
    useNativeJar: useNativeCookieJar,
    useNativeCookieJar,
    needsWebBridge,
    webBridgeToken: getWebBridgeToken,
  },

  watchlist: {
    get: getWatchlist,
    add: addToWatchlist,
    edit: editWatchlist,
    remove: removeFromWatchlist,
    rate: rateAnime,
  },
  profile: { get: getProfile, update: updateProfile, uploadImage },
  track: { episode: trackEpisode, untrack: untrackEpisode },
  reviews: { list: getReviews, submit: submitReview },
  achievements: { get: getAchievements },

  forum: {
    categories: getForumCategories,
    threads: getForumThreads,
    thread: getForumThread,
    createThread: createForumThread,
    createPost: createForumPost,
  },

  notifications: {
    list: getNotifications,
    unreadCount: getUnreadCount,
    markAllRead: markNotificationsRead,
    prefs: { get: getNotificationPrefs, update: updateNotificationPrefs },
  },

  fun: {
    animeOfTheDay: getAnimeOfTheDay,
    leaderboard: getLeaderboard,
    news: getNews,
    polls: getPolls,
    votePoll,
    quiz: { daily: getDailyQuiz, check: checkQuizAnswer },
    game: { get: getDailyGame, guess: guessGame },
    osts: getOSTs,
    wallpapers: getWallpapers,
    likeWallpaper,
    tvSchedule: getTvSchedule,
    tvSchedulePeek: peekTvSchedule,
    tvScheduleLive: getTvScheduleLive,
    reels: getReels,
    postReel,
    likeReel,
    viewReel,
    reelComments: getReelComments,
    postReelComment,
    reportReel,
    toggleFollow: toggleFollowUser,
    liveDubs: getLiveDubs,
  },

  watchParty: {
    list: getWatchParties,
    get: getWatchParty,
    create: createWatchParty,
    update: updateWatchParty,
    sync: getWatchPartySync,
    join: joinWatchParty,
    leave: leaveWatchParty,
    search: searchWatchPartyAnime,
    messages: getWatchPartyMessages,
    send: (id: string, message: string) => updateWatchParty(id, { message }),
  },

  manga: {
    catalog: getMangaCatalog,
    list: getMangaList,
    save: saveMangaEntry,
    remove: removeMangaEntry,
    chapters: getMangaChapters,
    toggleChapter: toggleMangaChapter,
  },

  vibe: { get: getVibe },
  dna: { get: getAnimeDna },

  tournaments: {
    list: async () => {
      const data = await requestJson<any>(`${WEB_API}/character-tournaments`);
      return (Array.isArray(data)
        ? data
        : data?.tournaments || data?.data || []) as import('../types').CharacterTournament[];
    },
    detail: async (id: string) => {
      const data = await requestJson<any>(`${WEB_API}/character-tournaments/${id}`);
      return (data?.data || data) as import('../types').CharacterTournamentDetail;
    },
    pollVoteGet: async (id: string): Promise<{ myPollVote: string | null }> => {
      const res = await fetchWithTimeout(`${WEB_API}/character-tournaments/${id}/poll-vote`, {
        headers: { 'X-Device-Id': await getDeviceId() },
      });
      if (!res.ok) return { myPollVote: null };
      return res.json();
    },
    pollVoteCast: async (id: string, participantId: string) => {
      const res = await fetchWithTimeout(`${WEB_API}/character-tournaments/${id}/poll-vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': await getDeviceId(),
        },
        body: JSON.stringify({ participantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || `API Error: ${res.status}`);
      }
      return res.json();
    },
  },
};

export { getCurrentUser as getSessionUser };
