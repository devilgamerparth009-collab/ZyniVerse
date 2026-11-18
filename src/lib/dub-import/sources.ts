/**
 * Domain resolution for the Hindi / regional dub sources we import.
 *
 * Both listing sites move domains every few months (animedubhindi.link →
 * .com → …, desidubanime.me → …), so the importer never hardcodes a host at
 * call time. It tries the last host that worked (stored in DubSourceState),
 * then probes a list of known candidates, validates the page with a marker
 * string, and remembers whichever answered. A stale domain therefore heals
 * itself on the next sync — no redeploy, no code change.
 *
 * For sources with a schedule endpoint the homepage marker is no longer
 * enough: a host that serves the homepage but 404s on `/schedule.php` is a
 * broken host for this app. Such hosts are quarantined for a short while and
 * deprioritised, and the first candidate that answers BOTH checks is written
 * back to DubSourceState. `.link` is simply one of several candidates (it is
 * listed first); nothing here assumes it is the only valid public host.
 */
import { prisma } from "@/lib/prisma";

export type DubSourceId = "animedubhindi" | "desidubanime";

export interface DubSourceConfig {
  id: DubSourceId;
  name: string;
  shortName: string;
  /** Human-facing note shown on the website / app. */
  description: string;
  accent: string;
  /** Candidate hosts, best guess first. */
  candidates: string[];
  /** A substring that must appear on the homepage for the host to count. */
  marker: string;
  /** Path that must also answer for sources whose schedule we import. */
  schedulePath?: string;
}

export const DUB_SOURCES: Record<DubSourceId, DubSourceConfig> = {
  animedubhindi: {
    id: "animedubhindi",
    name: "Anime Dub Hindi",
    shortName: "ADH",
    description: "Hindi, Tamil, Telugu and multi-audio anime episodes and movies.",
    accent: "#f97316",
    candidates: [
      "https://www.animedubhindi.link",
      "https://www.animedubhindi.com",
      "https://www.animedubhindi.in",
      "https://www.animedubhindi.org",
      "https://www.animedubhindi.net",
      "https://animedubhindi.link",
      "https://animedubhindi.com",
    ],
    marker: "Anime Dub Hindi",
    schedulePath: "/schedule.php",
  },
  desidubanime: {
    id: "desidubanime",
    name: "Desi Dub Anime",
    shortName: "DDA",
    description: "Indian regional dubs with episode lists, ratings and genres.",
    accent: "#22d3ee",
    candidates: [
      "https://www.desidubanime.me",
      "https://www.desidubanime.com",
      "https://www.desidubanime.in",
      "https://www.desidubanime.link",
      "https://www.desidubanime.org",
      "https://www.desidubanime.net",
      "https://desidubanime.me",
    ],
    marker: "DesiDubAnime",
  },
};

export const DUB_SOURCE_IDS = Object.keys(DUB_SOURCES) as DubSourceId[];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** fetch with a hard timeout; callers get plain text. */
export async function fetchText(
  url: string,
  { timeoutMs = 12000, accept = "text/html" }: { timeoutMs?: number; accept?: string } = {}
): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    headers: {
      "User-Agent": UA,
      Accept: accept,
      "Accept-Language": "en-IN,en;q=0.9",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

const MEMORY_TTL_MS = 5 * 60 * 1000;
const QUARANTINE_TTL_MS = 30 * 60 * 1000;

/** Cache is keyed by strictness so a schedule-only winner cannot be reused by the catalogue stage. */
const memory = new Map<string, { baseUrl: string; at: number }>();
/** Hosts whose homepage works but whose schedule endpoint does not. */
const quarantine = new Map<string, number>();

interface HostProbe {
  homepage: boolean;
  /** null when the source has no schedule endpoint to validate. */
  schedule: boolean | null;
}

function quarantineKey(source: DubSourceId, baseUrl: string): string {
  return `${source}:${baseUrl}`;
}

/**
 * Homepage marker plus, for schedule-capable sources, a real `/schedule.php`
 * response. A 404/placeholder counts as a failure (fetchText throws on !ok),
 * so the stored `.org` host that only passes the homepage cannot win.
 */
async function probeHost(baseUrl: string, cfg: DubSourceConfig): Promise<HostProbe> {
  let html: string;
  try {
    html = await fetchText(`${baseUrl}/`, { timeoutMs: 9000 });
  } catch {
    return { homepage: false, schedule: false };
  }
  if (!html.includes(cfg.marker)) return { homepage: false, schedule: false };
  if (!cfg.schedulePath) return { homepage: true, schedule: null };

  try {
    const scheduleHtml = await fetchText(`${baseUrl}${cfg.schedulePath}`, { timeoutMs: 9000 });
    const looksLikeSchedule =
      scheduleHtml.includes("date-block") ||
      scheduleHtml.includes("time-block") ||
      scheduleHtml.includes("data-release") ||
      /class=["'][^"']*\bcard\b/.test(scheduleHtml);
    return { homepage: true, schedule: looksLikeSchedule };
  } catch {
    return { homepage: true, schedule: false };
  }
}

function remember(cacheKey: string, baseUrl: string): void {
  memory.set(cacheKey, { baseUrl, at: Date.now() });
}

async function persistWinner(source: DubSourceId, baseUrl: string): Promise<void> {
  try {
    await prisma.dubSourceState.upsert({
      where: { source },
      create: { source, baseUrl, status: "ok", lastCheckedAt: new Date() },
      update: { baseUrl, status: "ok", lastCheckedAt: new Date(), lastError: null },
    });
  } catch {
    // Non-fatal: resolution still works for this run.
  }
}

/**
 * Returns a working base URL for a source. Order:
 *   1. in-memory cache (5 min)
 *   2. last known good host from the database
 *   3. probe every candidate in parallel-ish batches
 *
 * Hosts answering both checks are always preferred and are written back to
 * DubSourceState, which is what heals a stale stored host. When
 * `scheduleCritical` is true (the schedule stage), a homepage-only host is
 * never accepted; other callers may fall back to one so a temporary schedule
 * outage does not break catalogue browsing or source redirects.
 */
export async function resolveSourceBase(
  source: DubSourceId,
  { force = false, scheduleCritical = false }: { force?: boolean; scheduleCritical?: boolean } = {}
): Promise<string> {
  const cfg = DUB_SOURCES[source];
  const needsSchedule = Boolean(cfg.schedulePath);
  const cacheKey = `${source}:${scheduleCritical && needsSchedule ? "schedule" : "any"}`;
  const hit = memory.get(cacheKey);
  if (!force && hit && Date.now() - hit.at < MEMORY_TTL_MS) return hit.baseUrl;

  let stored: string | null = null;
  try {
    const state = await prisma.dubSourceState.findUnique({ where: { source } });
    stored = state?.baseUrl ?? null;
  } catch {
    // Table might not exist yet on a fresh environment; fall through to probes.
  }

  const now = Date.now();
  const isQuarantined = (url: string): boolean => {
    const until = quarantine.get(quarantineKey(source, url));
    return typeof until === "number" && until > now;
  };

  // Stored host first (unless quarantined), then candidates; quarantined hosts
  // go last so they can still heal after the TTL without a redeploy.
  const unq = cfg.candidates.filter((c) => !isQuarantined(c));
  const q = cfg.candidates.filter(isQuarantined);
  const ordered = [
    ...(stored && !isQuarantined(stored) ? [stored] : []),
    ...unq.filter((c) => c !== stored),
    ...q.filter((c) => c !== stored),
  ];

  let homepageFallback: string | null = null;

  for (let i = 0; i < ordered.length; i += 3) {
    const batch = ordered.slice(i, i + 3);
    const results = await Promise.all(batch.map((base) => probeHost(base, cfg)));

    // A host that fails the schedule check is quarantined even when it is the
    // stored one, so the next resolution prefers a working candidate.
    results.forEach((result, index) => {
      if (result.homepage && result.schedule === false) {
        quarantine.set(quarantineKey(source, batch[index]), now + QUARANTINE_TTL_MS);
      }
    });

    const strictIndex = results.findIndex(
      (result) => result.homepage && (!needsSchedule || result.schedule === true)
    );
    if (strictIndex >= 0) {
      const winner = batch[strictIndex];
      quarantine.delete(quarantineKey(source, winner));
      remember(cacheKey, winner);
      if (winner !== stored) await persistWinner(source, winner);
      return winner;
    }

    if (!scheduleCritical) {
      const fallbackIndex = results.findIndex((result) => result.homepage);
      if (fallbackIndex >= 0) homepageFallback = batch[fallbackIndex];
    }
  }

  if (homepageFallback) {
    // Do not persist a fallback over a known schedule-capable host: the next
    // strict resolution still gets a chance to heal DubSourceState.
    remember(cacheKey, homepageFallback);
    return homepageFallback;
  }

  if (stored && !scheduleCritical) {
    memory.set(cacheKey, { baseUrl: stored, at: Date.now() });
    return stored;
  }

  throw new Error(
    `No working ${needsSchedule && scheduleCritical ? "schedule-capable " : ""}domain found for ${cfg.name}.`
  );
}

export function clearDomainCache(source?: DubSourceId): void {
  if (source) {
    for (const key of [...memory.keys()]) {
      if (key.startsWith(`${source}:`)) memory.delete(key);
    }
    for (const key of [...quarantine.keys()]) {
      if (key.startsWith(`${source}:`)) quarantine.delete(key);
    }
    return;
  }
  memory.clear();
  quarantine.clear();
}
