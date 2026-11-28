/**
 * Direct Supabase REST reads for public, PII-free views.
 *
 * Rules enforced here:
 *  - Only the publishable/anon key is ever read. No service-role key, no DB
 *    password, no Auth.js token is available to the APK.
 *  - Only hard-coded view names are accepted, so a call site can never turn
 *    this into a generic "read any table" escape hatch.
 *  - Direct reads are opt-in via EXPO_PUBLIC_DIRECT_PUBLIC_READS=1 and stay off
 *    until the SQL migration has been applied and the Supabase project is
 *    active. When off (or failing), callers use the existing website API.
 *  - Repeated failures open a short circuit breaker so a paused/billing-blocked
 *    project does not add latency to every screen.
 */

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const OPT_IN = process.env.EXPO_PUBLIC_DIRECT_PUBLIC_READS === '1';

const VIEW_ALLOWLIST = new Set([
  'public_zv_tournaments',
  'public_zv_leaderboard',
  'public_zv_posts',
  'public_zv_profiles',
  'public_zv_dub_catalog',
  'public_zv_dub_schedule',
  'public_zv_dub_sources',
  'public_zv_vibe_activity',
  'public_zv_vibe_titles',
  'public_zv_vibe_rooms',
  'public_zv_vibe_pulse',
] as const);

export type PublicView = typeof VIEW_ALLOWLIST extends Set<infer T> ? T : never;

const DEFAULT_TIMEOUT_MS = 4000;
const FAILURE_LIMIT = 3;
const BREAKER_MS = 10 * 60 * 1000;

let consecutiveFailures = 0;
let breakerUntil = 0;

function safeEndpoint(): boolean {
  if (!SUPABASE_URL || !SUPABASE_KEY || !OPT_IN) return false;
  try {
    // Bare-check without constructing a URL object: works on every RN runtime.
    if (!SUPABASE_URL.startsWith('https://')) return false;
    if (/zyverse\.in/i.test(SUPABASE_URL)) return false;
    const host = SUPABASE_URL.slice('https://'.length).split('/')[0];
    return host.length > 3 && !host.includes('@') && !host.includes(' ');
  } catch {
    return false;
  }
}

/** True only when opt-in, credentials and a sane endpoint are all present. */
export function directReadsEnabled(): boolean {
  if (!safeEndpoint()) return false;
  return Date.now() >= breakerUntil;
}

/** Callers use this to short-circuit BEFORE paying the fallback cost. */
export function directReadsConfigured(): boolean {
  return safeEndpoint();
}

function recordSuccess(): void {
  consecutiveFailures = 0;
  breakerUntil = 0;
}

function recordFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_LIMIT) breakerUntil = Date.now() + BREAKER_MS;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const parts: string[] = [];
  Object.keys(params)
    .sort()
    .forEach((key) => {
      const value = params[key];
      if (value === undefined || value === null || value === '') return;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    });
  return parts.length ? `?${parts.join('&')}` : '';
}

export interface SelectResult<T> {
  rows: T[];
  /** Parsed from Content-Range when `count: true`; otherwise null. */
  total: number | null;
}

/**
 * SELECT from an allow-listed public view using the anon/publishable key.
 * Throws on any problem — callers must fall back to the website API.
 */
export async function supabaseSelect<T>(
  view: PublicView,
  params: Record<string, string | number | boolean | undefined> = {},
  options: { timeoutMs?: number; count?: boolean; headers?: Record<string, string> } = {}
): Promise<SelectResult<T>> {
  if (!directReadsEnabled()) throw new Error('Direct public reads are disabled');
  if (!VIEW_ALLOWLIST.has(view)) throw new Error(`View not allowed: ${view}`);

  const url = `${SUPABASE_URL}/rest/v1/${view}${buildQuery(params)}`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    : null;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
        ...(options.count ? { Prefer: 'count=exact' } : {}),
        ...(options.headers || {}),
      },
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (!response.ok) throw new Error(`Supabase REST ${response.status}`);

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('Unexpected Supabase payload');

    let total: number | null = null;
    if (options.count) {
      const range = response.headers.get('content-range');
      const parsed = range ? Number(range.split('/')[1]) : Number.NaN;
      total = Number.isFinite(parsed) ? parsed : null;
    }

    recordSuccess();
    return { rows: payload as T[], total };
  } catch (error) {
    recordFailure();
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Direct-first with an automatic website fallback. Keeps behaviour identical
 * while the SQL view is missing or the Supabase project is paused.
 */
export async function withDirectFallback<T>(
  direct: () => Promise<T>,
  fallback: () => Promise<T>,
  isValid?: (value: T) => boolean
): Promise<T> {
  if (!directReadsEnabled()) return fallback();
  try {
    const value = await direct();
    if (isValid && !isValid(value)) throw new Error('Direct payload failed validation');
    return value;
  } catch {
    return fallback();
  }
}
