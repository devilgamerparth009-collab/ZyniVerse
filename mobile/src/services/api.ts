import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { NativeModules } from 'react-native';
import { directImageUrl, unproxyImageUrl } from '../lib/avatar-src';
import {
  isTrustedPlatformUrl,
  platformLabelForUrl,
  trustedExternalUrl,
} from '../utils/safeLinks';
import { lookupDirectFiller } from './fillerDirect';
import { supabaseSelect, withDirectFallback } from './supabasePublic';
import {
  directAiringSchedule,
  directBatch,
  directCharacterSearch,
  directCharacters,
  directCharactersByIds,
  directGenres,
  directListPath,
  directMediaByTitle,
  directMediaPage,
  directPagedPath,
  directSearch,
  directStreamingData,
  directSuggestions,
} from './anilistDirect';
import {
  Anime,
  CharacterEdge,
  CharactersResponse,
  DubStatus,
  DubScheduleLanguage,
  DubScheduleResponse,
  DubCatalogResponse,
  DubScheduleListResponse,
  DubLanguageStat,
  DubLanguagesResponse,
  DubGenreStat,
  DubGenresResponse,
  DubOverviewResponse,
  LiveDubScheduleResponse,
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
import {
  ChannelPostsResponse,
  ChannelSummary,
  ChannelPostView,
  CreateChannelInput,
  CreateChannelPostInput,
  CreateStoryInput,
  DiscoveredUser,
  FollowListResponse,
  PublicUser,
  ReactionState,
  StoryItem,
  SubscriptionState,
} from '../types/social';

export const WEB_HOST = 'https://zyverse.in';
const WEB_API = `${WEB_HOST}/api`;
const ANILIST_GQL = 'https://graphql.anilist.co';
// Sent with API requests so the server can prefer official app traffic over
// generic scrapers. Secret header is defense-in-depth (APK can be inspected) but
// allows server/WAF to distinguish official app builds from simple header spoofing.
const APP_CLIENT_HEADER = 'x-zyniverse-client';
const APP_CLIENT_VALUE = 'zyniverse-mobile-v1';
const APP_SECRET_HEADER = 'x-zyniverse-app-secret';
const APP_SECRET_VALUE = '7730b4e789b9bc920463bb47fe99cba6de35403c7b8305f5679718aa98ab81e5';

const DEVICE_KEY = 'zt_ct_device';
const SESSION_COOKIE_KEY = 'zt_session_cookie';
// The raw Auth.js JWT is stored separately so authenticated requests can send
// it as a Bearer token even when Android drops a manually set Cookie header.
const SESSION_TOKEN_KEY = 'zt_session_token';
// Last known profile is kept in the Keystore too. It is only a display
// fallback for transient API failures, never proof that a session is valid.
const CACHED_USER_KEY = 'zv_cached_user';
let cachedDevice: string | null = null;
let legacySessionMigration: Promise<void> | null = null;

// Lightweight last-known-good cache: serves fresh data when online and
// falls back to the cached copy when the network is unavailable. This keeps
// the app usable offline instead of showing a bare error screen.
const CACHE_PREFIX = 'zt_cache_v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
// When the API is unreachable (site down, travel, weak signal), an older copy
// is still far more useful than an empty screen. This window is only consulted
// after a live request fails or stalls — fresh data always wins when online.
const STALE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Filler lists change as episodes air; keep that cache short so a freshly
// published guide is not hidden behind a stale copy for hours.
const FILLER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT_MS = 25 * 1000;

async function cacheGet<T>(key: string, ttlMs = CACHE_TTL_MS): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; v: T };
    if (Date.now() - parsed.t > ttlMs) return null;
    return parsed.v;
  } catch {
    return null;
  }
}

async function cacheSet<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): Promise<void> {
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
 * request (cold scrape, upstream hiccup, weak mobile signal) falls back to the
 * last known copy — which is far better than a spinner.
 */
const CACHE_FIRST_GRACE_MS = 600;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** De-duplicates concurrent requests for the same key (e.g. Home + Browse). */
const inFlightReads = new Map<string, Promise<unknown>>();

async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = CACHE_TTL_MS
): Promise<T> {
  let network = inFlightReads.get(key) as Promise<T> | undefined;
  if (!network) {
    network = (async () => {
      const live = await fetcher();
      await cacheSet(key, live, ttlMs);
      return live;
    })();
    inFlightReads.set(key, network);
    network
      .catch(() => {})
      .finally(() => {
        if (inFlightReads.get(key) === network) inFlightReads.delete(key);
      });
  }

  const cached = (await cacheGet<T>(key, ttlMs)) ?? (await cacheGet<T>(key, STALE_CACHE_TTL_MS));
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

/**
 * Absolute URL for artwork shown in the app.
 *
 * The original host is used directly — the same URL the website renders — so
 * images load without a website hop. Components show a branded placeholder if
 * the upstream host fails.
 */
export function mediaImageUrl(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (/^data:|^blob:/i.test(raw)) return raw;
  return directImageUrl(unproxyImageUrl(raw));
}

/* ------------------------------------------------------------------ */
/* Dub catalog artwork                                                 */
/* ------------------------------------------------------------------ */

const DUB_POSTER_CACHE = new Map<string, string | null>();

function dubTitleKey(title?: string | null): string {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(season|episode|ep|dub|dubbed|hindi|tamil|telugu|english)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Direct AniList cover for a scraped title; original poster is the fallback. */
async function anilistPoster(title: string, original?: string | null): Promise<string | null> {
  const key = dubTitleKey(title);
  if (!key) return original || null;
  if (DUB_POSTER_CACHE.has(key)) return DUB_POSTER_CACHE.get(key) || original || null;
  try {
    const media = await directMediaByTitle(title);
    const poster =
      media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium || null;
    DUB_POSTER_CACHE.set(key, poster);
    return poster || original || null;
  } catch {
    return original || null;
  }
}

/** Hydrate scraped dub rows in small parallel batches without blocking the UI forever. */
async function hydrateDubPosters<T extends { title: string; posterUrl?: string | null }>(
  rows: T[]
): Promise<T[]> {
  if (!rows?.length) return rows;
  const out = [...rows];
  for (let i = 0; i < out.length; i += 6) {
    const chunk = out.slice(i, i + 6);
    const posters = await Promise.all(
      chunk.map((row) => anilistPoster(row.title, row.posterUrl))
    );
    chunk.forEach((row, index) => {
      out[i + index] = { ...row, posterUrl: posters[index] };
    });
  }
  return out;
}

async function hydrateLiveDubSchedule(data: any): Promise<any> {
  if (!data) return data;
  const [ongoing, upcoming] = await Promise.all([
    hydrateDubPosters((data.ongoing || []) as any[]),
    hydrateDubPosters((data.upcoming || []) as any[]),
  ]);
  return { ...data, ongoing, upcoming };
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const headers = new Headers(init?.headers || undefined);
  if (url.startsWith(WEB_API)) {
    if (!headers.has(APP_CLIENT_HEADER)) headers.set(APP_CLIENT_HEADER, APP_CLIENT_VALUE);
    if (APP_SECRET_VALUE && !headers.has(APP_SECRET_HEADER)) headers.set(APP_SECRET_HEADER, APP_SECRET_VALUE);
  }
  try {
    return await fetch(url, {
      // Lets React Native's native cookie jar attach the NextAuth session
      // automatically (Google / OAuth sign-in lives there).
      credentials: 'include',
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Request timed out. Check your connection.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const RETRYABLE_STATUSES = new Set([421, 425, 429]);
// 5xx is safe to retry for reads only; replaying a POST could duplicate a write.
const isIdempotentRequest = (init?: RequestInit) => {
  const method = (init?.method || 'GET').toUpperCase();
  return method === 'GET' || method === 'HEAD';
};

function friendlyHttpError(status: number, serverMessage?: string): string {
  if (status === 401) return 'Your session expired. Please sign in again.';
  if (status === 421) return 'Session check failed. Please try again.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status === 404) return serverMessage || 'Not found.';
  if (status >= 500) return serverMessage || 'ZyniVerse is having trouble. Please try again.';
  return serverMessage || `API Error: ${status}`;
}

async function requestJson<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  try {
    let lastStatus = 0;
    let lastMessage: string | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetchWithTimeout(url, init);
      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      }

      lastStatus = res.status;
      const body = await res.json().catch(() => null);
      lastMessage = (body && (body.error || body.message)) || undefined;

      // Vercel / carrier middleboxes occasionally answer a valid request with
      // 421 (Misdirected Request) or 429; both are transient and safe to retry.
      if (
        attempt === 0 &&
        (RETRYABLE_STATUSES.has(res.status) || (isIdempotentRequest(init) && res.status >= 500))
      ) {
        await new Promise((r) => setTimeout(r, 450));
        continue;
      }

      // 401 can happen when the platform cookie jar did not attach on the
      // first try. Retry once with the stored NextAuth cookie, if we have one.
      if (attempt === 0 && res.status === 401) {
        const stored = await readCookie();
        const cookie = cookieForHeader(stored);
        if (cookie) {
          init = {
            ...init,
            headers: { ...(init?.headers as Record<string, string>), Cookie: cookie },
          };
          continue;
        }
      }

      break;
    }

    throw new Error(friendlyHttpError(lastStatus, lastMessage));
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

  // AniList often has an official platform URL in `externalLinks` even when it
  // has no per-episode `streamingEpisodes` for a title. Surface those as watch
  // rows, but never pass an unvetted third-party URL to the UI.
  const directEpisodes = Array.isArray(raw.streamingEpisodes)
    ? raw.streamingEpisodes.filter((ep: any) => ep?.url)
    : [];
  if (directEpisodes.length === 0 && Array.isArray(raw.externalLinks)) {
    raw.streamingEpisodes = raw.externalLinks
      .filter((link: any) => isTrustedPlatformUrl(link?.url))
      .map((link: any) => ({
        title: link.site || 'Watch on official platform',
        url: link.url,
      }))
      .slice(0, 12);
  }
  return raw as Anime;
}

/* ------------------------------------------------------------------ */
/* Auth / session cookie handling                                      */
/* ------------------------------------------------------------------ */

/** Pull the raw JWT out of a `name=value` session cookie string. */
function tokenFromCookie(cookie: string | null): string | null {
  if (!cookie) return null;
  const marker = 'session-token=';
  const index = cookie.indexOf(marker);
  if (index === -1) return null;
  return (cookie.slice(index + marker.length).split(';')[0] || '').trim() || null;
}

/**
 * Older releases mirrored the session into AsyncStorage in plaintext. Move it
 * into the Android Keystore-backed SecureStore once, then erase every legacy
 * copy so a root/browser-based read cannot recover a usable JWT.
 */
function ensureLegacySessionMigrated(): Promise<void> {
  if (!legacySessionMigration) {
    legacySessionMigration = (async () => {
      const keys = [SESSION_COOKIE_KEY, SESSION_TOKEN_KEY, CACHED_USER_KEY];
      try {
        const [cookie, token] = await Promise.all([
          AsyncStorage.getItem(SESSION_COOKIE_KEY),
          AsyncStorage.getItem(SESSION_TOKEN_KEY),
        ]);
        if (cookie) await SecureStore.setItemAsync(SESSION_COOKIE_KEY, cookie);
        if (token) await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
      } catch {
        /* migration is best-effort; SecureStore is still authoritative */
      }
      try {
        await AsyncStorage.multiRemove(keys);
      } catch {
        /* ignore */
      }
    })().catch(() => undefined);
  }
  return legacySessionMigration;
}

async function saveSessionToStorage(stored: string, _user?: User | null): Promise<void> {
  // A different account must never see the previous one's cached reads.
  await clearReadCache();
  const token = tokenFromCookie(stored);
  try {
    await SecureStore.setItemAsync(SESSION_COOKIE_KEY, stored);
    if (token) await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch {}
  // Defense in depth: never leave a plaintext copy behind.
  try {
    await SecureStore.deleteItemAsync(CACHED_USER_KEY);
  } catch {}
  try {
    await AsyncStorage.multiRemove([SESSION_COOKIE_KEY, SESSION_TOKEN_KEY, CACHED_USER_KEY]);
  } catch {}
}

async function readCookie(): Promise<string | null> {
  await ensureLegacySessionMigrated();
  try {
    return await SecureStore.getItemAsync(SESSION_COOKIE_KEY);
  } catch {
    return null;
  }
}

async function readSessionToken(): Promise<string | null> {
  await ensureLegacySessionMigrated();
  try {
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const [storedCookie, token] = await Promise.all([readCookie(), readSessionToken()]);
  const headers: Record<string, string> = {};
  const cookie = cookieForHeader(storedCookie);
  if (cookie) headers.Cookie = cookie;
  // The Bearer token is the reliable auth channel on Android. The server
  // verifies the same JWT that Auth.js would read from the cookie.
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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

async function writeCachedUser(user: User): Promise<void> {
  try {
    await SecureStore.setItemAsync(CACHED_USER_KEY, JSON.stringify(user));
  } catch {
    /* cache is optional */
  }
}

async function readCachedUser(): Promise<User | null> {
  await ensureLegacySessionMigrated();
  try {
    const raw = await SecureStore.getItemAsync(CACHED_USER_KEY);
    const parsed = raw ? (JSON.parse(raw) as User) : null;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

async function clearCachedUser(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CACHED_USER_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Offline-safe identity for device-local storage. Unlike `getCurrentUser()`,
 * this never calls the network and is only an owner hint, never a session proof.
 */
export async function getCachedUser(): Promise<User | null> {
  return readCachedUser();
}

type SessionLookup =
  | { kind: 'user'; user: User }
  | { kind: 'unauthorized' }
  | { kind: 'transient'; status: number };

/**
 * Live session check. A 429/5xx/network failure is *not* a signed-out user —
 * it is usually a busy edge or a weak mobile link. Callers may fall back to the
 * last known profile for those, but never after a real 401.
 */
async function fetchSessionUser(): Promise<SessionLookup> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(`${WEB_API}/mobile/me`, {
        headers: { Accept: 'application/json', ...(await authHeader()) },
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (!json?.user?.id) return { kind: 'transient', status: 200 };
        const user: User = {
          id: json.user.id,
          username: json.user.name || json.user.email || 'User',
          email: json.user.email || '',
          avatar: json.user.image || undefined,
        };
        await writeCachedUser(user);
        return { kind: 'user', user };
      }
      if (res.status === 401) return { kind: 'unauthorized' };
      if (
        attempt === 0 &&
        (res.status === 421 || res.status === 425 || res.status === 429 || res.status >= 500)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      return { kind: 'transient', status: res.status };
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
    }
  }
  return { kind: 'transient', status: 0 };
}

let sessionLookupInFlight: Promise<SessionLookup> | null = null;
let transientSession: SessionLookup | null = null;
let transientSessionUntil = 0;

/**
 * Share one `/mobile/me` check across the screens that mount together, and
 * briefly reuse an offline/challenge result. Without this, navigating a few
 * screens while the API is down fires a fresh failing request every time.
 */
function lookupSession(): Promise<SessionLookup> {
  if (transientSession && Date.now() < transientSessionUntil) {
    return Promise.resolve(transientSession);
  }
  if (!sessionLookupInFlight) {
    sessionLookupInFlight = fetchSessionUser()
      .then((result) => {
        if (result.kind === 'transient') {
          transientSession = result;
          transientSessionUntil = Date.now() + 30 * 1000;
        } else {
          transientSession = null;
          transientSessionUntil = 0;
        }
        return result;
      })
      .finally(() => {
        sessionLookupInFlight = null;
      });
  }
  return sessionLookupInFlight;
}

export async function getCurrentUser(): Promise<User | null> {
  const [storedCookie, token] = await Promise.all([readCookie(), readSessionToken()]);
  if (!storedCookie && !token) return null;

  const result = await lookupSession();
  if (result.kind === 'user') return result.user;
  if (result.kind === 'unauthorized') {
    // A real 401/expired session must not keep showing a stale signed-in UI.
    await clearCachedUser();
    return null;
  }
  // Edge challenge, rate limit or offline: keep the last known profile visible
  // instead of showing "Profile unavailable" for a connection hiccup.
  return readCachedUser();
}

interface MobileSessionLoginResponse {
  ok: boolean;
  user?: { id?: string; username?: string; email?: string; avatar?: string | null };
  cookie?: string;
  error?: string;
  code?: string;
  mfaRequired?: boolean;
}

/**
 * Preferred APK sign-in: one authenticated request, server-side bcrypt check,
 * and an Auth.js-compatible session cookie returned in the response body.
 * This avoids the CSRF callback/redirect round trip that React Native cannot
 * reliably preserve.
 */
async function loginWithMobileSession(
  email: string,
  password: string,
  totp?: string
): Promise<User> {
  const res = await fetchWithTimeout(`${WEB_API}/mobile/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password, ...(totp ? { totp } : {}) }),
  });
  const payload = (await res.json().catch(() => null)) as MobileSessionLoginResponse | null;
  if (!res.ok || !payload?.ok) {
    const error = new Error(
      payload?.error || (res.status === 401 ? 'Invalid email or password.' : 'Could not sign in right now.')
    ) as Error & { status?: number; mfaRequired?: boolean; code?: string };
    error.status = res.status;
    error.mfaRequired = payload?.mfaRequired === true;
    error.code = payload?.code;
    throw error;
  }
  if (!payload.cookie || !payload.user?.id) {
    const error = new Error('Sign-in response was incomplete. Please try again.') as Error & {
      status?: number;
    };
    error.status = res.status;
    throw error;
  }

  const user: User = {
    id: payload.user.id,
    username: payload.user.username || payload.user.email || email,
    email: payload.user.email || email,
    avatar: payload.user.avatar || undefined,
  };
  // An older OAuth session can still sit in the native WebView jar. Remove it
  // so the explicit cookie below is the only one sent on authenticated calls.
  await clearNativeCookies();
  await saveSessionToStorage(payload.cookie, user);
  return user;
}

async function login(email: string, password: string, totp?: string): Promise<User> {
  // Single, browser-free path. The dedicated endpoint is deployed with this
  // release, so there is no CSRF callback or external redirect to fall back to.
  return loginWithMobileSession(email, password, totp);
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
  // Revoke on the server first so this JWT cannot be replayed from a copy.
  // A failed request must not prevent the local sign-out below.
  try {
    const token = await readSessionToken();
    if (token) {
      await fetchWithTimeout(`${WEB_API}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: '{}',
      });
    }
  } catch {
    /* offline logout still clears the device */
  }
  try {
    await SecureStore.deleteItemAsync(SESSION_COOKIE_KEY);
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    await SecureStore.deleteItemAsync(CACHED_USER_KEY);
  } catch {
    /* ignore */
  }
  try {
    await AsyncStorage.multiRemove([SESSION_COOKIE_KEY, SESSION_TOKEN_KEY, CACHED_USER_KEY]);
    // Reset the one-time migration so a future session is migrated afresh.
    legacySessionMigration = null;
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
  const [cookie, token] = await Promise.all([readCookie(), readSessionToken()]);
  return cookie !== null || token !== null;
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
/* Public media catalogue                                              */
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
      externalLinks { site url type language }
      streamingEpisodes { title url site thumbnail }
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

export interface StreamingLink {
  platform: string;
  url: string;
  kind: 'direct' | 'search';
}

/** Official platform searches, used only when AniList has no direct watch URL. */
function curatedStreamingSearches(title?: string | null): StreamingLink[] {
  const q = (title || '').trim().slice(0, 120);
  if (!q) return [];
  const encoded = encodeURIComponent(q);
  return [
    { platform: 'Crunchyroll', url: `https://www.crunchyroll.com/search?q=${encoded}`, kind: 'search' },
    { platform: 'JioHotstar', url: `https://www.jiohotstar.com/search?q=${encoded}`, kind: 'search' },
    { platform: 'SonyLIV', url: `https://www.sonyliv.com/search?q=${encoded}`, kind: 'search' },
    { platform: 'Netflix', url: `https://www.netflix.com/search?q=${encoded}`, kind: 'search' },
  ];
}

/**
 * Direct official links from AniList, then official platform searches.
 * No website hop: AniList is the source of truth and the device talks to it
 * directly. A failed lookup degrades to curated official search links.
 */
async function getStreamingLinks(id: number, title?: string): Promise<StreamingLink[]> {
  try {
    return await fetchWithCache(
      `streaming_links_${id}`,
      async () => {
        try {
          const data = await directStreamingData(id);
          const links: StreamingLink[] = [];
          const seen = new Set<string>();
          const add = (raw: string | null | undefined, platform?: string | null) => {
            const url = trustedExternalUrl(raw);
            if (!url || seen.has(url)) return;
            seen.add(url);
            links.push({
              platform: (platform || '').trim() || platformLabelForUrl(url),
              url,
              kind: 'direct',
            });
          };
          for (const episode of data.episodes) add(episode.url, episode.site || episode.title);
          for (const link of data.links) add(link.url, link.site);
          if (links.length > 0) return links.slice(0, 16);
          return curatedStreamingSearches(data.title || title);
        } catch {
          return curatedStreamingSearches(title);
        }
      },
      6 * 60 * 60 * 1000
    );
  } catch {
    return [];
  }
}

async function listAnime(
  path: string,
  params: Record<string, string> = {}
): Promise<Anime[]> {
  const key = `list_${path.replace(/[^a-zA-Z0-9]/g, '_')}_${Object.values(params).join('_')}`;
  return fetchWithCache(key, async () => {
    // Public lists come straight from AniList. On failure the cached copy (up
    // to 7 days old) is served by fetchWithCache; no website fallback is used.
    try {
      const arr = await directListPath(path, params);
      return ((arr || []) as any[]).map(normalizeAnime);
    } catch {
      return [];
    }
  });
}

async function pagedAnime(
  path: string,
  params: Record<string, string | number | undefined> = {},
  cacheKey?: string
): Promise<MediaPage> {
  const run = async (): Promise<MediaPage> => {
    try {
      const page = await directPagedPath(path, params);
      return {
        pageInfo: page?.pageInfo || { hasNextPage: false, total: 0 },
        media: ((page?.media || []) as any[]).map(normalizeAnime),
      };
    } catch {
      return { pageInfo: { hasNextPage: false, total: 0 }, media: [] };
    }
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
  const run = async (): Promise<MediaPage> => {
    // Search must surface a real network/AniList failure instead of turning it
    // into "No anime found". Browse uses that distinction to offer a retry.
    const result = await directMediaPage({
      page,
      perPage,
      search: params.search,
      genre: params.genre,
      sort: params.sort || 'POPULARITY_DESC',
      format: params.format,
      status: params.status,
      type: params.type || 'ANIME',
    });
    return {
      pageInfo: result?.pageInfo || { hasNextPage: false, total: 0 },
      media: ((result?.media || []) as any[]).map(normalizeAnime),
    };
  };
  return page === 1 ? fetchWithCache(key, run) : run();
}

const OFFLINE_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery',
  'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
];

async function suggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query.trim()) return [];
  return fetchWithCache(`suggest_${query.trim().toLowerCase()}`, async () => {
    try {
      const direct = await directSuggestions(query.trim());
      return Array.isArray(direct) ? direct : [];
    } catch {
      return [];
    }
  });
}

async function getGenres(): Promise<string[]> {
  return fetchWithCache('genres', async () => {
    try {
      const data = await directGenres();
      return Array.isArray(data)
        ? data.filter((g) => g !== 'Hentai' && g !== 'Ecchi')
        : OFFLINE_GENRES;
    } catch {
      return OFFLINE_GENRES;
    }
  });
}

async function getCharacters(mediaId: number, page = 1): Promise<CharactersResponse> {
  const key = `chars_${mediaId}_${page}`;
  return fetchWithCache(key, async () => {
    try {
      const data = await directCharacters(mediaId, page);
      return {
        id: data?.id ?? mediaId,
        title: data?.title,
        coverImage: data?.coverImage,
        pageInfo: data?.pageInfo || { hasNextPage: false, total: 0 },
        edges: (data?.edges || []) as CharacterEdge[],
      };
    } catch {
      return {
        id: mediaId,
        pageInfo: { hasNextPage: false, total: 0 },
        edges: [],
      } as CharactersResponse;
    }
  });
}

async function recommendations(genre: string, perPage = 18): Promise<Anime[]> {
  if (!genre) return [];
  return fetchWithCache(`recs_${genre}_${perPage}`, async () => {
    try {
      const arr = (await directListPath('/anilist/recommendations', { genre, perPage })) || [];
      return arr.map(normalizeAnime);
    } catch {
      return [];
    }
  });
}

async function batchMedia(ids: number[]): Promise<Anime[]> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id)))].slice(0, 50);
  if (unique.length === 0) return [];
  try {
    const direct = await directBatch(unique);
    return Array.isArray(direct) ? direct.map(normalizeAnime) : [];
  } catch {
    return [];
  }
}

export interface FillerLookupInput {
  anilistId?: number;
  malId?: number;
  title?: string;
  aliases?: string[];
}

interface FillerApiResponse {
  found: boolean;
  reason?: string;
  error?: string;
  total?: number;
  title?: string;
  fillerPercent?: number;
  episodes?: Array<{ episode: number; type: string; title?: string }>;
}

function parseFillerResponse(
  data: FillerApiResponse,
  anilistId: number,
  fallbackTitle?: string
): FillerData | null {
  // `found:false` (miss) and error payloads are both represented as null by
  // the app. The caller distinguishes them because errors throw in requestJson.
  if (!data || data.found !== true || !Array.isArray(data.episodes)) return null;
  const episodes = data.episodes.map((e) => {
    const rawType = String(e.type || '').toLowerCase();
    const type: FillerData['episodes'][number]['type'] =
      rawType === 'filler' ? 'filler' : rawType.includes('mixed') ? 'mixed' : 'canon';
    return { episode: Number(e.episode), type, title: e.title };
  });
  const totalFillers = episodes.filter((e) => e.type === 'filler').length;
  const total = Number(data.total) || episodes.length;
  return {
    animeId: anilistId,
    title: data.title || fallbackTitle || 'Unknown',
    totalEpisodes: total,
    totalFillers,
    fillerPercentage:
      data.fillerPercent != null
        ? Number(data.fillerPercent)
        : total > 0
          ? Math.round((totalFillers / total) * 100)
          : 0,
    episodes,
  } as FillerData;
}

const fillerInFlight = new Map<string, Promise<FillerData | null>>();

/**
 * Shared filler lookup. All identifiers are matched against the public
 * AniFiller dataset directly from the phone (no zyverse.in hop), falling back
 * from AniList id to MAL id to normalised title aliases. `null` means "no
 * guide"; a rejected promise means the download failed (the screen shows
 * Retry). Only real results enter the cache — misses and errors are never
 * cached, so a newly published guide is visible immediately and a transient
 * failure can be retried.
 */
async function getFiller(
  input: number | FillerLookupInput,
  legacyTitle?: string
): Promise<FillerData | null> {
  const options: FillerLookupInput =
    typeof input === 'number' ? { anilistId: input, title: legacyTitle } : input || {};
  const parsedId = Number(options.anilistId);
  const anilistId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 0;

  const title = options.title?.trim() || undefined;
  const malRaw = Number(options.malId);
  const malId = Number.isFinite(malRaw) && malRaw > 0 ? malRaw : undefined;
  const aliases = (options.aliases || [])
    .map((a) => String(a).trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!anilistId && !malId && !title) return null;

  const lookupKey = `filler_${anilistId}_${malId || 0}_${[title || '', ...aliases].join('|').toLowerCase()}`;
  const cached = await cacheGet<FillerData>(lookupKey, FILLER_CACHE_TTL_MS);

  let network = fillerInFlight.get(lookupKey) as Promise<FillerData | null> | undefined;
  if (!network) {
    network = (async () => {
      const data = await lookupDirectFiller({
        anilistId: anilistId || undefined,
        malId,
        title,
        aliases,
      });
      const parsed = data ? parseFillerResponse(data, anilistId, title) : null;
      if (parsed) await cacheSet(lookupKey, parsed, FILLER_CACHE_TTL_MS);
      return parsed;
    })();
    fillerInFlight.set(lookupKey, network);
    network
      .catch(() => {})
      .finally(() => {
        if (fillerInFlight.get(lookupKey) === network) fillerInFlight.delete(lookupKey);
      });
  }

  if (!cached) return network;

  // Paint the last good guide while a slow request finishes in the background.
  const first = await Promise.race([
    network.then(
      (value) => ({ kind: 'fresh' as const, value }),
      () => ({ kind: 'error' as const })
    ),
    wait(CACHE_FIRST_GRACE_MS).then(() => ({ kind: 'slow' as const })),
  ]);
  return first.kind === 'fresh' ? first.value : cached;
}

const ANITALY_REGIONAL_DUBS_URL = 'https://anitally.in/api/regional-dubs';
const MYDUBLIST_ENGLISH_URL =
  'https://raw.githubusercontent.com/Joelis57/MyDubList/main/dubs/confidence/normal/dubbed_english.json';

/** Same public datasets the website uses, queried directly from the phone. */
async function directDubStatus(malId: number): Promise<DubStatus> {
  const [regionalResult, englishResult] = await Promise.allSettled([
    fetchWithTimeout(ANITALY_REGIONAL_DUBS_URL, { timeoutMs: 8000 }),
    fetchWithTimeout(MYDUBLIST_ENGLISH_URL, { timeoutMs: 8000 }),
  ]);
  if (regionalResult.status === 'rejected' && englishResult.status === 'rejected') {
    throw new Error('Dub sources unavailable');
  }

  const regionalData =
    regionalResult.status === 'fulfilled' && regionalResult.value.ok
      ? ((await regionalResult.value.json().catch(() => null)) as any)
      : null;
  const englishData =
    englishResult.status === 'fulfilled' && englishResult.value.ok
      ? ((await englishResult.value.json().catch(() => null)) as any)
      : null;

  const englishDubIds = new Set<number>(
    Array.isArray(englishData?.dubbed)
      ? englishData.dubbed.map((id: unknown) => Number(id)).filter(Number.isFinite)
      : []
  );
  const rows: any[] = Array.isArray(regionalData?.data) ? regionalData.data : [];
  const match = rows.find((item) => Number(item?.mal_id) === malId);
  const comingSoon: string[] =
    typeof match?.coming_soon_languages === 'string'
      ? match.coming_soon_languages
          .split(',')
          .map((language: string) => language.trim())
          .filter(Boolean)
      : [];

  const hasEnglish = englishDubIds.has(malId);
  const hasHindi = !!(match?.has_hindi || comingSoon.includes('Hindi'));
  const hasTamil = !!(match?.has_tamil || comingSoon.includes('Tamil'));
  const hasTelugu = !!(match?.has_telugu || comingSoon.includes('Telugu'));

  return {
    malId,
    title: typeof match?.title === 'string' ? match.title : '',
    english: { available: hasEnglish },
    hindi: { available: hasHindi },
    tamil: { available: hasTamil },
    telugu: { available: hasTelugu },
  };
}

async function getDubStatus(malId: number): Promise<DubStatus> {
  return fetchWithCache(
    `dub_status_${malId}`,
    // Public dub datasets are queried directly. No website hop: a failed lookup
    // shows no badge (and reuses the offline cache) instead of calling zyverse.
    () => directDubStatus(malId),
    24 * 60 * 60 * 1000
  );
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

export interface DubCatalogQuery {
  kind?: 'series' | 'movie';
  language?: string;
  genre?: string;
  source?: string;
  q?: string;
  sort?: 'recent' | 'title' | 'rating' | 'year';
  page?: number;
  limit?: number;
}

/**
 * Imported Hindi / regional dub catalogue (series and movies). The website
 * syncs this straight from the Indian dub listing sites, so the app reads the
 * same rows through `/api/dub/catalog` instead of scraping anything itself.
 */
async function getDubCatalog(query: DubCatalogQuery): Promise<DubCatalogResponse> {
  const key = [
    'dub_catalog',
    query.kind || 'all',
    query.language || 'all',
    query.genre || 'all',
    query.source || 'all',
    query.sort || 'recent',
    query.q || '',
    query.page || 1,
  ].join('_');

  return fetchWithCache(key, async () => {
    const data = await requestJson<DubCatalogResponse>(
      buildUrl('/dub/catalog', {
        kind: query.kind,
        language: query.language,
        genre: query.genre,
        source: query.source,
        q: query.q,
        sort: query.sort,
        page: query.page ?? 1,
        limit: query.limit ?? 24,
      })
    );
    return { ...data, items: await hydrateDubPosters(data?.items || []) };
  });
}

async function getDubWeeklySchedule(): Promise<DubScheduleListResponse> {
  return fetchWithCache('dub_weekly_schedule', async () => {
    const data = await requestJson<DubScheduleListResponse>(`${WEB_API}/dub/schedule?limit=200`);
    const groups = await Promise.all(
      (data?.groups || []).map(async (group) => ({
        ...group,
        items: await hydrateDubPosters(group?.items || []),
      }))
    );
    const unscheduled = await hydrateDubPosters(data?.unscheduled || []);
    return { ...data, groups, unscheduled };
  });
}

/**
 * Live Anime Dub Hindi schedule (Ongoing + Upcoming). Short cache TTL because
 * the Dub Hub polls this endpoint every minute while it is on screen.
 */
async function getDubLiveSchedule(force = false): Promise<LiveDubScheduleResponse | null> {
  const key = 'dub_live_schedule';
  const ttl = 60 * 1000;
  if (force) {
    try {
      const live = await hydrateLiveDubSchedule(
        await requestJson<LiveDubScheduleResponse>(`${WEB_API}/dub/live-schedule`)
      ) as LiveDubScheduleResponse;
      await cacheSet(key, live, ttl);
      return live;
    } catch {
      return cacheGet<LiveDubScheduleResponse>(key, 6 * 60 * 60 * 1000);
    }
  }
  try {
    return await fetchWithCache(
      key,
      async () =>
        (await hydrateLiveDubSchedule(
          await requestJson<LiveDubScheduleResponse>(`${WEB_API}/dub/live-schedule`)
        )) as LiveDubScheduleResponse,
      ttl
    );
  } catch {
    return cacheGet<LiveDubScheduleResponse>(key, 6 * 60 * 60 * 1000);
  }
}

async function getDubLanguageStats(): Promise<DubLanguageStat[]> {
  const data = await fetchWithCache('dub_language_stats', () =>
    requestJson<DubLanguagesResponse>(`${WEB_API}/dub/languages`)
  );
  return Array.isArray(data?.languages) ? data.languages : [];
}

async function getDubGenres(kind?: 'series' | 'movie'): Promise<DubGenreStat[]> {
  const data = await fetchWithCache(`dub_genres_${kind || 'all'}`, () =>
    requestJson<DubGenresResponse>(buildUrl('/dub/genres', { kind }))
  );
  return Array.isArray(data?.genres) ? data.genres : [];
}

/** One request for the unified Dub Hub: stats, languages and genres. */
async function getDubOverview(): Promise<DubOverviewResponse | null> {
  try {
    return await fetchWithCache('dub_overview', () =>
      requestJson<DubOverviewResponse>(`${WEB_API}/dub/overview`)
    );
  } catch {
    return null;
  }
}

async function getSchedule(): Promise<ScheduleItem[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 6 * 3600;
  const to = now + 7 * 24 * 3600;

  return fetchWithCache(
    `schedule_${Math.floor(now / 1800)}`,
    async () => {
      let entries: any[] = [];
      try {
        entries = await directAiringSchedule(from, to);
      } catch {
        return [];
      }
      return entries.map((entry: any) => ({
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
    },
    30 * 60 * 1000
  );
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
  let results: any[] = [];
  try {
    results = await directSearch(query.trim());
  } catch {
    results = [];
  }
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
  // A brief cache keeps the profile screen usable when the edge returns a
  // transient 429/5xx. `getCurrentUser()` still performs the live session
  // check, so a signed-out user never sees this cached copy.
  return fetchWithCache<ProfileResponse>(
    'profile',
    () => authedGet<ProfileResponse>('/profile'),
    5 * 60 * 1000
  );
}

/** Fast first-paint profile: core rows only, no reviews/achievements/activity. */
async function getProfileSummary(): Promise<ProfileResponse> {
  return fetchWithCache<ProfileResponse>(
    'profile_summary',
    () => authedGet<ProfileResponse>('/mobile/profile-summary'),
    60 * 1000
  );
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

/** Custom lists owned by the signed-in user (private rows included). */
async function getCustomLists(userId: string): Promise<any[]> {
  const data = await authedGet<{ lists?: any[] }>('/lists', { mine: 1, userId, limit: 50 });
  return Array.isArray(data?.lists) ? data.lists : [];
}

/** Moments created by a specific user. */
async function getMoments(userId: string): Promise<any[]> {
  const data = await requestJson<{ moments?: any[] }>(buildUrl('/moments', { userId, limit: 20 }));
  return Array.isArray(data?.moments) ? data.moments : [];
}

async function getEconomy(): Promise<any> {
  return authedGet<any>('/economy');
}

async function claimDailyLogin(): Promise<any> {
  return authedGet<any>('/daily-login/claim');
}

async function deleteAccount(): Promise<void> {
  await authedPost('/account/delete', { confirm: 'DELETE' });
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

function pickDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Same deterministic hash as the website, so both platforms pick the same anime. */
function pickForDay<T>(list: T[], day: string): T {
  let hash = 0;
  for (let i = 0; i < day.length; i++) hash = (hash * 31 + day.charCodeAt(i)) >>> 0;
  return list[hash % list.length];
}

async function getAnimeOfTheDay(): Promise<import('../types').AnimeOfTheDay> {
  return fetchWithCache('aotd', async () => {
    const day = pickDayKey();
    // Deterministic pick from AniList only. If AniList is unreachable the caller
    // uses the cached copy; no website API call is made.
    const page = await directMediaPage({ perPage: 50, sort: 'TRENDING_DESC' });
    const anime = page.media.length > 0 ? pickForDay(page.media, day) : null;
    if (!anime) throw new Error('No trending anime available');
    const title =
      anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Unknown';
    return {
      day,
      anime: {
        id: anime.id,
        title,
        image:
          anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium || '',
        format: anime.format || '',
        episodes: anime.episodes || 0,
        genres: anime.genres || [],
        score: anime.averageScore || 0,
        popularity: anime.popularity || 0,
        status: anime.status || '',
        synopsis: anime.description || '',
      },
      why: `Today's pick is ${title}. Watch this trending anime and see if it matches your mood.`,
    } as import('../types').AnimeOfTheDay;
  });
}

async function getLeaderboard(limit = 50, offset = 0): Promise<import('../types').LeaderboardResponse> {
  return fetchWithCache(`leaderboard_${limit}_${offset}`, () =>
    withDirectFallback<import('../types').LeaderboardResponse>(
      async () => {
        const { rows, total } = await supabaseSelect<{
          userId: string;
          username: string;
          avatar: string | null;
          points: number;
          level: number;
          achievements: number;
        }>('public_zv_leaderboard', { limit, offset }, { count: true });
        return { entries: rows, total: total ?? rows.length };
      },
      () => requestJson<import('../types').LeaderboardResponse>(buildUrl('/leaderboard', { limit, offset })),
      (value) => !!value && Array.isArray(value.entries)
    )
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
 * The live TV grid is fetched from the upstream schedule at request time and can be slow.
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

/** Anonymous, aggregate episode reactions from the last N days. */
async function getHotEpisodes(days = 7, limit = 12): Promise<import('../types').HotEpisodesResponse> {
  return fetchWithCache(`episodes_hot_${days}_${limit}`, () =>
    requestJson<import('../types').HotEpisodesResponse>(
      buildUrl('/episodes/hot', { days, limit })
    )
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
    await writeCachedUser(user);
    return;
  }
  const live = await fetchSessionUser();
  if (live.kind === 'user') await writeCachedUser(live.user);
}

/**
 * Android shares its cookie jar between the WebView and React Native's
 * networking layer, so after an OAuth round-trip inside the WebView the session
 * cookie is already attached to every fetch. This flag tells the API client to
 * stop sending an explicit Cookie header and rely on that shared jar.
 */
export async function useNativeCookieJar(): Promise<void> {
  await saveSessionToStorage(NATIVE_JAR_MARKER);
  const live = await fetchSessionUser();
  if (live.kind === 'user') await writeCachedUser(live.user);
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
/* Chat, friends, feed, public profiles                                */
/* ------------------------------------------------------------------ */

export interface ChatUserRef {
  id: string;
  username: string;
  avatar?: string | null;
}

export interface ChatConversation {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  otherUser?: ChatUserRef | null;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
    isDeleted?: boolean;
  } | null;
  unreadCount?: number;
}

export interface ChatMessage {
  id: string;
  conversationId?: string;
  content: string;
  createdAt: string;
  sender: ChatUserRef;
  isDeleted?: boolean;
  /** New servers send a count map; older servers sent a flat row array. */
  reactions?: Record<string, number> | { id: string; emoji: string; userId: string }[];
  myReactions?: string[];
}

async function getConversations(): Promise<ChatConversation[]> {
  const data = await authedGet<any>('/chat/conversations');
  return data?.conversations || [];
}

async function getChatMessages(conversationId: string, limit = 50): Promise<ChatMessage[]> {
  const data = await authedGet<any>('/chat/messages', { conversationId, limit });
  return data?.messages || [];
}

async function sendChatMessage(conversationId: string, content: string): Promise<ChatMessage> {
  const data = await authedPost<any>('/chat/messages', { conversationId, content });
  return data?.message || data;
}

async function markConversationRead(conversationId: string): Promise<void> {
  await authedPost('/chat/conversations', { conversationId }, 'PUT');
}

async function startConversation(recipientId: string): Promise<ChatConversation | null> {
  const data = await authedPost<any>('/chat/conversations', { recipientId });
  return data?.conversation || null;
}

async function searchUsers(query: string): Promise<ChatUserRef[]> {
  if (!query.trim()) return [];
  const data = await authedGet<any>('/users/search', { q: query.trim() });
  const list = data?.users || data?.results || (Array.isArray(data) ? data : []);
  return list.map((u: any) => ({
    id: u.id,
    username: u.username || u.name || 'User',
    avatar: u.avatar || u.image || null,
  }));
}

export interface FriendItem {
  id: string;
  username: string;
  avatar?: string | null;
}

export interface FriendRequestRow {
  id: string;
  status?: string;
  createdAt?: string;
  sender?: ChatUserRef | null;
  receiver?: ChatUserRef | null;
}

async function getFriends(type: 'friends' | 'pending' | 'sent' = 'friends'): Promise<any> {
  return authedGet<any>('/friends', { type });
}

async function respondToFriendRequest(requestId: string, accept: boolean): Promise<void> {
  await authedPost(`/friends/${encodeURIComponent(requestId)}`, { action: accept ? 'accept' : 'decline' }, 'PUT');
}

async function removeFriend(friendId: string): Promise<void> {
  await authedPost(`/friends/${encodeURIComponent(friendId)}`, undefined, 'DELETE');
}

async function sendFriendRequest(receiverId: string): Promise<void> {
  await authedPost('/friends', { receiverId });
}

async function getFeed(mode: 'foryou' | 'following' = 'foryou', limit = 20): Promise<any> {
  return requestJson<any>(buildUrl('/feed', { mode, limit }));
}

async function getPublicProfile(username: string): Promise<any> {
  return requestJson<any>(buildUrl(`/users/${encodeURIComponent(username)}`));
}

async function toggleFollow(followingId: string, follow: boolean): Promise<void> {
  await authedPost('/follow', { followingId }, follow ? 'POST' : 'DELETE');
}

/* ------------------------------------------------------------------ */
/* Social v1.5.0 — discovery, follow lists, channels, stories          */
/* ------------------------------------------------------------------ */

/** Normalises the people search response (older routes used `results`). */
function asPublicUser(raw: Record<string, unknown>): PublicUser {
  return {
    id: String(raw.id ?? ''),
    username: String(raw.username ?? raw.name ?? 'User'),
    avatar: (raw.avatar ?? raw.image ?? null) as string | null,
    bio: (raw.bio ?? null) as string | null,
  };
}

async function discoverUsers(limit = 24): Promise<DiscoveredUser[]> {
  const data = await authedGet<{ users?: DiscoveredUser[] }>('/users/discover', { limit });
  return (data?.users || []).map((raw) => ({
    ...asPublicUser(raw as unknown as Record<string, unknown>),
    isFollowing: !!raw.isFollowing,
    isFriend: !!raw.isFriend,
    mutualFollowers: Number(raw.mutualFollowers) || 0,
    reason: String(raw.reason || 'Recommended for you'),
  }));
}

async function searchPeople(query: string): Promise<DiscoveredUser[]> {
  if (!query.trim()) return [];
  const data = await authedGet<{
    users?: DiscoveredUser[];
    results?: DiscoveredUser[];
  }>('/users/search', { q: query.trim() });
  const list = data?.users || data?.results || [];
  return list.map((raw) => ({
    ...asPublicUser(raw as unknown as Record<string, unknown>),
    isFollowing: !!raw.isFollowing,
    isFriend: !!raw.isFriend,
    mutualFollowers: Number(raw.mutualFollowers) || 0,
    reason: String(raw.reason || 'People you may know'),
  }));
}

async function getFollowList(
  userId: string,
  mode: 'followers' | 'following',
  limit = 50,
  cursor?: string
): Promise<FollowListResponse> {
  const data = await authedGet<FollowListResponse>(`/users/${encodeURIComponent(userId)}/${mode}`, {
    limit,
    ...(cursor ? { cursor } : {}),
  });
  return {
    users: (data?.users || []).map((raw) => asPublicUser(raw as unknown as Record<string, unknown>)),
    nextCursor: data?.nextCursor ?? null,
  };
}

async function listChannels(): Promise<ChannelSummary[]> {
  const data = await authedGet<{ channels?: ChannelSummary[] }>('/channels');
  return data?.channels || [];
}

async function createChannel(input: CreateChannelInput): Promise<ChannelSummary> {
  const data = await authedPost<{ channel: ChannelSummary }>('/channels', input);
  return data.channel;
}

async function getChannel(slug: string): Promise<ChannelSummary> {
  const data = await authedGet<{ channel: ChannelSummary }>(
    `/channels/${encodeURIComponent(slug)}`
  );
  return data.channel;
}

async function subscribeChannel(slug: string, subscribe: boolean): Promise<SubscriptionState> {
  return authedPost<SubscriptionState>(
    `/channels/${encodeURIComponent(slug)}/subscribe`,
    undefined,
    subscribe ? 'POST' : 'DELETE'
  );
}

async function getChannelPosts(
  slug: string,
  limit = 30,
  cursor?: string
): Promise<ChannelPostsResponse> {
  const data = await authedGet<ChannelPostsResponse>(
    `/channels/${encodeURIComponent(slug)}/posts`,
    { limit, ...(cursor ? { cursor } : {}) }
  );
  return { posts: data?.posts || [], nextCursor: data?.nextCursor ?? null };
}

async function createChannelPost(
  slug: string,
  input: CreateChannelPostInput
): Promise<ChannelPostView> {
  const data = await authedPost<{ post: ChannelPostView }>(
    `/channels/${encodeURIComponent(slug)}/posts`,
    input
  );
  return data.post;
}

async function deleteChannelPost(slug: string, postId: string): Promise<void> {
  await authedPost(
    `/channels/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}`,
    undefined,
    'DELETE'
  );
}

async function reactChannelPost(
  slug: string,
  postId: string,
  emoji: string
): Promise<ReactionState> {
  return authedPost<ReactionState>(
    `/channels/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/react`,
    { emoji }
  );
}

async function listStories(limit = 60): Promise<StoryItem[]> {
  const data = await authedGet<{ stories?: StoryItem[] }>('/stories', { limit });
  return data?.stories || [];
}

async function createStory(input: CreateStoryInput): Promise<StoryItem> {
  const data = await authedPost<{ story: StoryItem }>('/stories', input);
  return data.story;
}

async function viewStory(id: string): Promise<number> {
  const data = await authedPost<{ success: true; viewCount: number }>(
    `/stories/${encodeURIComponent(id)}/view`
  );
  return Number(data?.viewCount) || 0;
}

async function reactChatMessage(messageId: string, emoji: string): Promise<ReactionState> {
  return authedPost<ReactionState>(
    `/chat/messages/${encodeURIComponent(messageId)}/react`,
    { emoji }
  );
}

async function deleteChatMessage(messageId: string): Promise<void> {
  await authedPost(`/chat/messages/${encodeURIComponent(messageId)}`, undefined, 'DELETE');
}

async function sendTyping(conversationId: string, isTyping: boolean): Promise<void> {
  // Ephemeral signal: a dropped request must never interrupt the conversation.
  await authedPost('/chat/typing', { conversationId, isTyping }).catch(() => {});
}

/** Polling fallback that also reads optional typing metadata when present. */
async function getChatMessagesWithTyping(
  conversationId: string,
  limit = 50
): Promise<{ messages: ChatMessage[]; typingUsers: string[] }> {
  const data = await authedGet<{
    messages?: ChatMessage[];
    typing?: string | string[] | { username?: string }[];
    typingUsers?: string | string[];
  }>('/chat/messages', { conversationId, limit });
  const rawTyping = data?.typingUsers ?? data?.typing;
  let typingUsers: string[] = [];
  if (typeof rawTyping === 'string') typingUsers = [rawTyping];
  else if (Array.isArray(rawTyping)) {
    typingUsers = rawTyping
      .map((t) => (typeof t === 'string' ? t : t?.username || ''))
      .filter(Boolean);
  }
  return { messages: data?.messages || [], typingUsers };
}

/* ------------------------------------------------------------------ */
/* Tournament helpers — public AniList reads, shared DB writes          */
/* ------------------------------------------------------------------ */

export interface TournamentCharacterResult {
  id: number;
  name: string;
  nameNative?: string | null;
  image?: string | null;
  favourites?: number;
}

/** Character picker source. Never needs the website UI or its HTML. */
async function searchTournamentCharacters(query: string): Promise<TournamentCharacterResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    return await directCharacterSearch(q, 20);
  } catch {
    // Offline/rate-limited: the cached copy (if any) is served by the caller.
    return [];
  }
}

/**
 * Tournament rows store an artwork URL captured at creation time. Refresh it
 * from AniList on read so older/user-created events show the same character
 * images as the website, without depending on a cached proxy.
 */
async function hydrateTournamentImages<T>(detail: T): Promise<T> {
  const payload: any = detail;
  if (!payload) return detail;
  const ids = new Set<number>();
  const collect = (participant: any) => {
    const id = Number(participant?.charId);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  };
  (payload.tournament?.participants || []).forEach(collect);
  const collectMatch = (match: any) => {
    collect(match?.charA);
    collect(match?.charB);
    collect(match?.winner);
  };
  (payload.matches || []).forEach(collectMatch);
  (payload.rounds || []).forEach((round: any) => (round?.matches || []).forEach(collectMatch));
  if (ids.size === 0) return detail;

  let refreshed: Map<number, { name?: string; image?: string | null; favourites?: number }>;
  try {
    refreshed = await directCharactersByIds([...ids]);
  } catch {
    return detail;
  }
  if (refreshed.size === 0) return detail;

  const apply = (participant: any) => {
    const info = refreshed.get(Number(participant?.charId));
    if (!info) return;
    if (info.image) {
      participant.charImage = info.image;
      if (!participant.franchiseCover) participant.franchiseCover = info.image;
    }
    if (!participant.charName && info.name) participant.charName = info.name;
  };
  (payload.tournament?.participants || []).forEach(apply);
  (payload.matches || []).forEach((match: any) => {
    apply(match?.charA);
    apply(match?.charB);
    apply(match?.winner);
  });
  (payload.rounds || []).forEach((round: any) =>
    (round?.matches || []).forEach((match: any) => {
      apply(match?.charA);
      apply(match?.charB);
      apply(match?.winner);
    })
  );
  return detail;
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
  streaming: { links: getStreamingLinks },
  filler: { get: getFiller },
  dubStatus: { get: getDubStatus },
  dubSchedule: { get: getDubSchedule },
  dub: {
    catalog: getDubCatalog,
    weeklySchedule: getDubWeeklySchedule,
    liveSchedule: getDubLiveSchedule,
    languages: getDubLanguageStats,
    genres: getDubGenres,
    overview: getDubOverview,
  },
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
  profile: { get: getProfile, summary: getProfileSummary, update: updateProfile, uploadImage },
  account: {
    customLists: getCustomLists,
    moments: getMoments,
    economy: getEconomy,
    claimDaily: claimDailyLogin,
    delete: deleteAccount,
  },
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

  chat: {
    conversations: getConversations,
    messages: getChatMessages,
    send: sendChatMessage,
    markRead: markConversationRead,
    start: startConversation,
    searchUsers,
  },

  friends: {
    list: getFriends,
    respond: respondToFriendRequest,
    remove: removeFriend,
    request: sendFriendRequest,
  },

  feed: { get: getFeed },
  users: { publicProfile: getPublicProfile },
  follow: toggleFollow,

  discover: { list: discoverUsers, search: searchPeople },
  followLists: { list: getFollowList },
  channels: {
    list: listChannels,
    create: createChannel,
    get: getChannel,
    subscribe: subscribeChannel,
    posts: getChannelPosts,
    createPost: createChannelPost,
    deletePost: deleteChannelPost,
    reactPost: reactChannelPost,
  },
  stories: { list: listStories, create: createStory, view: viewStory },
  chatExtras: {
    react: reactChatMessage,
    delete: deleteChatMessage,
    typing: sendTyping,
    messagesWithTyping: getChatMessagesWithTyping,
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
    hotEpisodes: getHotEpisodes,
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

  searchTournamentCharacters,

  tournaments: {
    list: async () => {
      // Real-time shared state: a timestamp + no-cache keeps tournaments made
      // on the website visible in the app on the next visit, without waiting
      // for the public CDN window to expire.
      const fromWebsite = async () => {
        const data = await requestJson<any>(
          `${WEB_API}/character-tournaments?limit=100&t=${Date.now()}`,
          { headers: { 'Cache-Control': 'no-cache' } }
        );
        const items = (Array.isArray(data)
          ? data
          : data?.tournaments || data?.data || []) as any[];
        return items.map((item) => ({
          ...item,
          characterCount: item?._count?.participants ?? item?.characterCount ?? item?.size ?? 0,
        })) as import('../types').CharacterTournament[];
      };

      // Public, PII-free view on the same shared database. The website keeps
      // writing through the server routes, so sync is unchanged. Anything
      // missing/paused falls straight back to the website API.
      return withDirectFallback<import('../types').CharacterTournament[]>(
        async () => {
          const { rows } = await supabaseSelect<any>('public_zv_tournaments', { limit: 100 });
          const items = rows.map((item: any) => ({
            ...item,
            characterCount: item?._count?.participants ?? item?.characterCount ?? item?.size ?? 0,
          })) as any[];
          // Same order as GET /api/character-tournaments.
          items.sort(
            (a, b) =>
              (a.statusRank ?? 9) - (b.statusRank ?? 9) ||
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          return items as import('../types').CharacterTournament[];
        },
        fromWebsite,
        (value) => Array.isArray(value)
      );
    },
    detail: async (id: string) => {
      // The device id makes the server include this voter's `myVotes` /
      // `myPollVote` state. Without it guests always look like they have never
      // voted, so the vote buttons can never show the correct state.
      const data = await requestJson<any>(`${WEB_API}/character-tournaments/${id}?t=${Date.now()}`, {
        headers: {
          'X-Device-Id': await getDeviceId(),
          'Cache-Control': 'no-cache',
          ...(await authHeader()),
        },
      });
      const detail = (data?.data || data) as import('../types').CharacterTournamentDetail;
      return hydrateTournamentImages(detail);
    },
    /** Creates in the same shared database the website uses, so both see it. */
    create: async (input: {
      title: string;
      description?: string;
      size: number;
      mode: 'bracket' | 'qualifying';
      bracketSize?: number;
      posterUrl?: string;
      participants: Array<{
        charId: number;
        charName: string;
        charImage?: string | null;
        franchiseCover?: string | null;
      }>;
    }) => {
      const created = await authedPost<any>('/character-tournaments', input);
      return (created?.data || created) as { id: string };
    },
    /** Creator controls; the website uses these same shared routes. */
    start: async (id: string) => authedPost<any>(`/character-tournaments/${id}/start`, {}),
    finalizeQualifying: async (id: string) =>
      authedPost<any>(`/character-tournaments/${id}/finalize-qualifying`, {}),
    finalize: async (id: string) => authedPost<any>(`/character-tournaments/${id}/finalize`, {}),
    /** Vote in a live bracket matchup. One vote per match, guests allowed. */
    matchVote: async (id: string, matchId: string, choice: 'A' | 'B') => {
      const res = await fetchWithTimeout(
        `${WEB_API}/character-tournaments/${id}/matches/${matchId}/vote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': await getDeviceId(),
            ...(await authHeader()),
          },
          body: JSON.stringify({ choice }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || `API Error: ${res.status}`);
      }
      return res.json() as Promise<{ success: boolean; votesA: number; votesB: number }>;
    },
    pollVoteGet: async (id: string): Promise<{ myPollVote: string | null }> => {
      const res = await fetchWithTimeout(`${WEB_API}/character-tournaments/${id}/poll-vote`, {
        headers: { 'X-Device-Id': await getDeviceId(), ...(await authHeader()) },
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
          ...(await authHeader()),
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
