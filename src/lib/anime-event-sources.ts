import { prisma } from "./prisma";
import { logError } from "./logger";

/**
 * Server-only source checks for /events.
 *
 * Field ownership is deliberately narrow:
 *   - dates and venue names may come only from the organiser's own JSON-LD /
 *     official page, or from a year-specific Wikipedia venue note;
 *   - attendance is never stored because there is no free authoritative feed;
 *   - announcements are kept only when they carry a traceable source URL.
 *
 * Everything else stays as a curated listing with a link to the organiser.
 * News/aggregator pages are not consulted, and no external source may invent
 * a date, a venue, or an announcement.
 */

const USER_AGENT = "ZyniVerseEventsSync/1.0 (https://zyverse.in)";
const FETCH_TIMEOUT_MS = 9000;
const WIKI_API = "https://en.wikipedia.org/w/api.php";

interface EventSourceTarget {
  slug: string;
  family: string;
  year: number;
  officialUrl: string;
  officialHost: string;
  wikiTitle?: string;
  checkJsonLd?: boolean;
  textVenuePattern?: RegExp;
  textVenueValue?: string;
  badge: "official" | "reference" | "curated";
}

export const EVENT_SOURCE_TARGETS: EventSourceTarget[] = [
  {
    slug: "anime-expo-2026",
    family: "Anime Expo",
    year: 2026,
    officialUrl: "https://www.anime-expo.org",
    officialHost: "anime-expo.org",
    wikiTitle: "Anime Expo",
    checkJsonLd: true,
    badge: "official",
  },
  {
    slug: "jump-festa-2027",
    family: "Jump Festa",
    year: 2027,
    officialUrl: "https://www.jumpfesta.com",
    officialHost: "jumpfesta.com",
    wikiTitle: "Jump Festa",
    badge: "reference",
  },
  {
    slug: "otakon-2026",
    family: "Otakon",
    year: 2026,
    officialUrl: "https://otakon.com",
    officialHost: "otakon.com",
    wikiTitle: "Otakon",
    checkJsonLd: true,
    badge: "reference",
  },
  {
    slug: "sdcc-2026-anime",
    family: "Comic-Con",
    year: 2026,
    officialUrl: "https://www.comic-con.org",
    officialHost: "comic-con.org",
    wikiTitle: "San Diego Comic-Con",
    badge: "reference",
  },
  {
    slug: "anime-japan-2027",
    family: "AnimeJapan",
    year: 2027,
    officialUrl: "https://anime-japan.jp/en/",
    officialHost: "anime-japan.jp",
    wikiTitle: "AnimeJapan",
    textVenuePattern: /held at\s+(INTEX Osaka)[^!]*2027/i,
    textVenueValue: "INTEX Osaka, Osaka, Japan",
    badge: "official",
  },
  {
    slug: "comiket-2026-winter",
    family: "Comiket",
    year: 2026,
    officialUrl: "https://www.comiket.co.jp",
    officialHost: "comiket.co.jp",
    wikiTitle: "Comiket",
    badge: "reference",
  },
  {
    slug: "anime-india-delhi-2026",
    family: "Anime India",
    year: 2026,
    officialUrl: "https://animeindia.live",
    officialHost: "animeindia.live",
    badge: "curated",
  },
  {
    slug: "annec-2026",
    family: "Annecy",
    year: 2026,
    officialUrl: "https://www.annecy.org",
    officialHost: "annecy.org",
    wikiTitle: "Annecy International Animation Film Festival",
    badge: "reference",
  },
  {
    slug: "anime-fest-2026",
    family: "Anime Festival Asia",
    year: 2026,
    officialUrl: "https://www.animefestival.asia",
    officialHost: "animefestival.asia",
    badge: "curated",
  },
  {
    slug: "anime-nyc-2026",
    family: "Anime NYC",
    year: 2026,
    officialUrl: "https://animenyc.com",
    officialHost: "animenyc.com",
    wikiTitle: "Anime NYC",
    badge: "reference",
  },
];

export interface EventSourceBadge {
  label: string;
  url: string;
  tone: EventSourceTarget["badge"];
}

export function getEventSourceBadge(slug: string, website: string): EventSourceBadge {
  const target = EVENT_SOURCE_TARGETS.find((item) => item.slug === slug);
  if (!target) {
    return { label: "Curated listing", url: website, tone: "curated" };
  }

  const labels: Record<EventSourceTarget["badge"], string> = {
    official: "Official source",
    reference: "Organiser + reference",
    curated: "Curated listing",
  };

  return {
    label: labels[target.badge],
    url: target.officialUrl || website,
    tone: target.badge,
  };
}

interface JsonRecord {
  [key: string]: unknown;
}

export interface EventSourcePatch {
  slug: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  country?: string;
  sourceUrl: string;
  sourceName: string;
  sourceKind: "official" | "wikipedia";
}

export interface EventSyncResultRow {
  slug: string;
  status: "updated" | "unchanged" | "no-safe-fields" | "missing-row";
  fields?: string[];
  note?: string;
}

export interface AnimeEventSyncResult {
  checked: number;
  matched: number;
  updated: number;
  attendanceCleared: number;
  announcementsRemoved: number;
  officialSourcesChecked: number;
  wikipediaSourcesChecked: number;
  results: EventSyncResultRow[];
  error?: string;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function hostMatches(hostname: string, allowed: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return normalized === allowed || normalized.endsWith(`.${allowed}`);
}

async function fetchChecked(url: string, allowedHost: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const finalHost = new URL(res.url || url).hostname;
  if (!hostMatches(finalHost, allowedHost)) {
    throw new Error(`Redirect left the official domain (${finalHost})`);
  }

  return res.text();
}

/** Collect every schema.org Event node, including nodes inside @graph. */
export function collectEventNodes(node: unknown, out: JsonRecord[] = []): JsonRecord[] {
  const record = asRecord(node);
  if (!record) {
    if (Array.isArray(node)) {
      for (const item of node) collectEventNodes(item, out);
    }
    return out;
  }

  const types = Array.isArray(record["@type"])
    ? record["@type"].map((item) => String(item).toLowerCase())
    : [String(record["@type"] ?? "").toLowerCase()];
  if (types.includes("event")) out.push(record);

  for (const value of Object.values(record)) collectEventNodes(value, out);
  return out;
}

/** YYYY-MM-DD only. Timestamps keep their published calendar date, not a UTC shift. */
export function parseEventDate(value: unknown): string | null {
  const raw = asText(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== `${match[1]}-${match[2]}-${match[3]}`) return null;
  return match[0];
}

function parseJsonLdLocation(value: unknown): string | null {
  if (typeof value === "string") return cleanText(value) || null;
  const place = asRecord(value);
  if (!place) return null;

  const name = asText(place.name);
  if (name) return cleanText(name);

  const parts = [
    asText(place.streetAddress),
    asText(place.addressLocality),
    asText(place.addressRegion),
  ]
    .filter((part): part is string => Boolean(part))
    .map(cleanText);
  return parts.length > 0 ? [...new Set(parts)].join(", ") : null;
}

/** Keep only an event whose own name matches the tracked family and edition year. */
export function eventNodeMatchesTarget(node: JsonRecord, target: EventSourceTarget): boolean {
  const name = cleanText(String(node.name ?? node.headline ?? ""));
  if (!name) return false;

  const lower = name.toLowerCase();
  const familyTokens = target.family.toLowerCase().split(/\s+/);
  if (!familyTokens.every((token) => lower.includes(token))) return false;
  if (!lower.includes(String(target.year))) return false;

  return true;
}

export function parseOfficialJsonLd(html: string, target: EventSourceTarget): EventSourcePatch | null {
  const blocks = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ].map((match) => match[1]);

  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue;
    }

    for (const node of collectEventNodes(parsed)) {
      if (!eventNodeMatchesTarget(node, target)) continue;

      const startDate = parseEventDate(node.startDate);
      const endDate = parseEventDate(node.endDate ?? node.endTime);
      const location = parseJsonLdLocation(node.location);
      if (!startDate && !endDate && !location) continue;

      return {
        slug: target.slug,
        ...(startDate ? { startDate } : {}),
        ...(endDate && (!startDate || endDate >= startDate) ? { endDate } : {}),
        ...(location ? { location } : {}),
        sourceUrl: target.officialUrl,
        sourceName: "Official event schema",
        sourceKind: "official",
      };
    }
  }

  return null;
}

export function cleanWikiText(value: string): string {
  return cleanText(
    value
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
      .replace(/<ref[^>]*\/>/gi, "")
      .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/''+/g, "")
  );
}

export function infoboxField(content: string, field: string): string | null {
  const match = content.match(new RegExp(`^\\|\\s*${field}\\s*=\\s*(.+)$`, "im"));
  if (!match) return null;

  // Keep <br> separators: the venue cell can list several year ranges, and
  // flattening them would make every year appear to match every edition.
  const raw = match[1]
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .trim();
  return raw || null;
}

/**
 * Wikipedia venue cells can list several editions. Never take the first venue:
 * it may belong to an older year (AnimeJapan used Tokyo Big Sight through 2026).
 * Only a segment that explicitly names this edition's year may change a venue.
 */
export function pickVenueForYear(raw: string | null, year: number): string | null {
  if (!raw) return null;
  const segments = raw
    .split(/<br\s*\/?>/i)
    .map((segment) => cleanWikiText(segment).trim())
    .filter(Boolean);

  const dated = segments.find((segment) => segment.includes(String(year)));
  if (!dated) return null;

  return dated
    .replace(/\((?:19|20)\d{2}[^)]*\)/g, "")
    .replace(/,$/, "")
    .trim() || null;
}

function mapWikiCountry(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.toLowerCase();
  if (value.includes("united states") || value === "usa" || value.includes("u.s.")) return "USA";
  if (value.includes("japan")) return "Japan";
  if (value.includes("singapore")) return "Singapore";
  if (value.includes("india")) return "India";
  if (value.includes("france")) return "France";
  return null;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function alreadyCovers(current: string, candidate: string): boolean {
  const a = normalized(current);
  const b = normalized(candidate);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

async function collectOfficialPatches(): Promise<{ patches: EventSourcePatch[]; checked: number; error?: string }> {
  const patches: EventSourcePatch[] = [];
  const targets = EVENT_SOURCE_TARGETS.filter((target) => target.checkJsonLd || target.textVenuePattern);
  const errors: string[] = [];

  await Promise.all(
    targets.map(async (target) => {
      try {
        const html = await fetchChecked(target.officialUrl, target.officialHost);

        if (target.checkJsonLd) {
          const patch = parseOfficialJsonLd(html, target);
          if (patch) patches.push(patch);
        }

        if (target.textVenuePattern && target.textVenueValue) {
          const match = html.match(target.textVenuePattern);
          if (match) {
            patches.push({
              slug: target.slug,
              location: target.textVenueValue,
              sourceUrl: target.officialUrl,
              sourceName: "Official event website",
              sourceKind: "official",
            });
          }
        }
      } catch (error) {
        errors.push(`${target.slug}: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  return {
    patches,
    checked: targets.length,
    ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
  };
}

interface WikipediaPage {
  title: string;
  missing?: boolean;
  revisions?: Array<{ slots?: { main?: { content?: string } } }>;
}

interface WikipediaResponse {
  error?: { info?: string };
  query?: { redirects?: Array<{ from: string; to: string }>; pages?: WikipediaPage[] };
}

async function collectWikipediaPatches(): Promise<{ patches: EventSourcePatch[]; checked: number; error?: string }> {
  const targets = EVENT_SOURCE_TARGETS.filter((target) => Boolean(target.wikiTitle));
  if (targets.length === 0) return { patches: [], checked: 0 };

  try {
    const titles = targets.map((target) => target.wikiTitle as string);
    const url = `${WIKI_API}?action=query&format=json&formatversion=2&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=${encodeURIComponent(titles.join("|"))}`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Wikipedia responded with ${res.status}`);

    const json: WikipediaResponse = await res.json();
    if (json.error?.info) throw new Error(json.error.info);

    const redirects = new Map((json.query?.redirects ?? []).map((item) => [item.from, item.to]));
    const pages = new Map((json.query?.pages ?? []).map((page) => [page.title, page]));
    const patches: EventSourcePatch[] = [];

    for (const target of targets) {
      const title = target.wikiTitle as string;
      const page = pages.get(redirects.get(title) ?? title);
      if (!page || page.missing) continue;

      const content = page.revisions?.[0]?.slots?.main?.content ?? "";
      const venue = pickVenueForYear(infoboxField(content, "venue"), target.year);
      const country = mapWikiCountry(infoboxField(content, "country"));
      if (!venue && !country) continue;

      patches.push({
        slug: target.slug,
        ...(venue ? { location: venue } : {}),
        ...(country ? { country } : {}),
        sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
        sourceName: "Wikipedia venue reference",
        sourceKind: "wikipedia",
      });
    }

    return { patches, checked: targets.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(error, "anime-event-sources-wikipedia");
    return { patches: [], checked: targets.length, error: message };
  }
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toDateOnly(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/**
 * Remove facts that cannot currently be sourced. This is intentionally broad:
 * there is no field that records why an attendance figure was entered, and a
 * trailer URL alone is not proof that an announcement was made at an event.
 */
async function cleanUnsourcedFacts(): Promise<{ attendanceCleared: number; announcementsRemoved: number }> {
  const attendance = await prisma.animeEvent.updateMany({
    where: { attendance: { not: null } },
    data: { attendance: null },
  });

  const rows = await prisma.animeAnnouncement.findMany({
    select: { id: true, sourceUrl: true },
  });
  const untraceable = rows
    .filter((row) => !row.sourceUrl?.trim())
    .map((row) => row.id);
  const announcements = untraceable.length > 0
    ? await prisma.animeAnnouncement.deleteMany({ where: { id: { in: untraceable } } })
    : { count: 0 };

  return {
    attendanceCleared: attendance.count,
    announcementsRemoved: announcements.count,
  };
}

export async function syncAnimeEventSources(): Promise<AnimeEventSyncResult> {
  const result: AnimeEventSyncResult = {
    checked: 0,
    matched: 0,
    updated: 0,
    attendanceCleared: 0,
    announcementsRemoved: 0,
    officialSourcesChecked: 0,
    wikipediaSourcesChecked: 0,
    results: [],
  };

  const [official, wikipedia] = await Promise.all([collectOfficialPatches(), collectWikipediaPatches()]);
  result.officialSourcesChecked = official.checked;
  result.wikipediaSourcesChecked = wikipedia.checked;

  const errors = [official.error, wikipedia.error].filter((item): item is string => Boolean(item));
  if (errors.length > 0) result.error = errors.join("; ");

  const rows = await prisma.animeEvent.findMany({
    where: { slug: { in: EVENT_SOURCE_TARGETS.map((target) => target.slug) } },
    select: {
      id: true,
      slug: true,
      startDate: true,
      endDate: true,
      location: true,
      country: true,
    },
  });
  const rowBySlug = new Map(rows.map((row) => [row.slug, row]));

  const patchesBySlug = new Map<string, EventSourcePatch[]>();
  for (const patch of [...official.patches, ...wikipedia.patches]) {
    const list = patchesBySlug.get(patch.slug) ?? [];
    list.push(patch);
    patchesBySlug.set(patch.slug, list);
  }

  for (const target of EVENT_SOURCE_TARGETS) {
    result.checked += 1;
    const row = rowBySlug.get(target.slug);
    const patches = patchesBySlug.get(target.slug) ?? [];
    if (!row) {
      result.results.push({ slug: target.slug, status: "missing-row" });
      continue;
    }
    if (patches.length === 0) {
      result.results.push({ slug: target.slug, status: "no-safe-fields" });
      continue;
    }
    result.matched += 1;

    const data: {
      startDate?: Date;
      endDate?: Date;
      location?: string;
      country?: string;
    } = {};
    const fields: string[] = [];

    for (const patch of patches) {
      if (patch.startDate && toDateKey(row.startDate) !== patch.startDate) {
        data.startDate = toDateOnly(patch.startDate);
        fields.push("startDate");
      }
      if (patch.endDate && toDateKey(row.endDate) !== patch.endDate) {
        data.endDate = toDateOnly(patch.endDate);
        fields.push("endDate");
      }
      if (patch.location && !alreadyCovers(row.location, patch.location)) {
        data.location = patch.location;
        fields.push("location");
      }
      if (patch.country && !alreadyCovers(row.country, patch.country)) {
        data.country = patch.country;
        fields.push("country");
      }
    }

    const uniqueFields = [...new Set(fields)];
    if (uniqueFields.length === 0) {
      result.results.push({ slug: target.slug, status: "unchanged" });
      continue;
    }

    try {
      await prisma.animeEvent.update({
        where: { id: row.id },
        data,
      });
      result.updated += 1;
      result.results.push({ slug: target.slug, status: "updated", fields: uniqueFields });
    } catch (error) {
      logError(error, "anime-event-sources-update", { slug: target.slug });
      result.results.push({
        slug: target.slug,
        status: "unchanged",
        note: "Update failed; existing data kept",
      });
    }
  }

  const cleaned = await cleanUnsourcedFacts();
  result.attendanceCleared = cleaned.attendanceCleared;
  result.announcementsRemoved = cleaned.announcementsRemoved;

  return result;
}
