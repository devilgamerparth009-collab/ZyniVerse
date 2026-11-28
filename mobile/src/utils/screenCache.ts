const cache = new Map<string, { ts: number; data: unknown }>();
const DEFAULT_TTL_MS = 60_000;

export function getScreenCache<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setScreenCache<T>(key: string, data: T): void {
  cache.set(key, { ts: Date.now(), data });
}

/** Drop one cached screen (or every cached screen) after a shared write. */
export function clearScreenCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}
