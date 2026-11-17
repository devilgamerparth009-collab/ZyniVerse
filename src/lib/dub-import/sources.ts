/**
 * Domain resolution for the Hindi / regional dub sources we import.
 *
 * Both listing sites move domains every few months (animedubhindi.link →
 * .com → …, desidubanime.me → …), so the importer never hardcodes a host at
 * call time. It tries the last host that worked (stored in DubSourceState),
 * then probes a list of known candidates, validates the page with a marker
 * string, and remembers whichever answered. A stale domain therefore heals
 * itself on the next sync — no redeploy, no code change.
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
const memory = new Map<string, { baseUrl: string; at: number }>();

async function probe(baseUrl: string, marker: string): Promise<boolean> {
  try {
    const html = await fetchText(`${baseUrl}/`, { timeoutMs: 9000 });
    return html.includes(marker);
  } catch {
    return false;
  }
}

/**
 * Returns a working base URL for a source. Order:
 *   1. in-memory cache (5 min)
 *   2. last known good host from the database
 *   3. probe every candidate in parallel-ish batches
 */
export async function resolveSourceBase(
  source: DubSourceId,
  { force = false }: { force?: boolean } = {}
): Promise<string> {
  const cfg = DUB_SOURCES[source];
  const hit = memory.get(source);
  if (!force && hit && Date.now() - hit.at < MEMORY_TTL_MS) return hit.baseUrl;

  let stored: string | null = null;
  try {
    const state = await prisma.dubSourceState.findUnique({ where: { source } });
    stored = state?.baseUrl ?? null;
  } catch {
    // Table might not exist yet on a fresh environment; fall through to probes.
  }

  const ordered = stored
    ? [stored, ...cfg.candidates.filter((c) => c !== stored)]
    : [...cfg.candidates];

  // Probe in small batches so a dead host never eats the whole budget.
  for (let i = 0; i < ordered.length; i += 3) {
    const batch = ordered.slice(i, i + 3);
    const results = await Promise.all(batch.map((base) => probe(base, cfg.marker)));
    const winner = batch[results.indexOf(true)];
    if (winner) {
      memory.set(source, { baseUrl: winner, at: Date.now() });
      try {
        await prisma.dubSourceState.upsert({
          where: { source },
          create: { source, baseUrl: winner, status: "ok", lastCheckedAt: new Date() },
          update: { baseUrl: winner, status: "ok", lastCheckedAt: new Date(), lastError: null },
        });
      } catch {
        // Non-fatal: resolution still works for this run.
      }
      return winner;
    }
  }

  if (stored) {
    memory.set(source, { baseUrl: stored, at: Date.now() });
    return stored;
  }
  throw new Error(`No working domain found for ${cfg.name}.`);
}

export function clearDomainCache(source?: DubSourceId): void {
  if (source) memory.delete(source);
  else memory.clear();
}
