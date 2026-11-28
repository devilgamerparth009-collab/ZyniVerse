// Convention data is updated from different sources for different fields.
// Organiser/ticket pages own storeable facts; news feeds are advisory signals;
// aggregators such as Roster Con are discovery-only and never publish here.
//
// This module is deliberately free of Next.js/Prisma imports so the parsers,
// field precedence and diff rules can be unit tested and reused by CLI scripts.

import { load } from "cheerio";
import { getIndiaDateKey, toDateKey } from "./convention-dates";

export type ConventionSourceKind = "official" | "ticket" | "news" | "aggregator";

export type ConventionWatchField =
  | "name"
  | "startDate"
  | "endDate"
  | "venue"
  | "city"
  | "state"
  | "ticketUrl"
  | "image";

export const CORE_FIELDS: ConventionWatchField[] = [
  "name",
  "startDate",
  "endDate",
  "venue",
  "city",
  "state",
  "image",
];

export const APPLICABLE_FIELDS: ConventionWatchField[] = [
  ...CORE_FIELDS,
  "ticketUrl",
];

interface JsonRecord {
  [key: string]: unknown;
}

export interface ConventionWatchRow {
  id: string;
  name: string;
  city: string;
  state: string;
  venue: string;
  website: string;
  ticketUrl: string | null;
  image: string | null;
  startDate: string | Date;
  endDate: string | Date;
  organizers: string[];
  tags: string[];
  /** The CLI only ever passes public rows; tests can assert hidden rows are excluded. */
  isPublic?: boolean;
  status?: string;
}

export interface SourceDefinition {
  id: string;
  label: string;
  kind: ConventionSourceKind;
  url: string;
  authoritativeFor: string[];
  advisoryFor: string[];
  /** false means the URL is tracked for context only, not parsed for facts. */
  parseable?: boolean;
  excluded?: boolean;
  note?: string;
}

export interface NewsItem {
  title: string;
  link: string;
  description?: string;
  publishedAt?: string;
}

export interface ReviewProposal {
  eventId: string;
  field: ConventionWatchField;
  currentValue: string | null;
  proposedValue: string;
  sourceId: string;
  sourceLabel: string;
  sourceKind: ConventionSourceKind;
  sourceUrl: string;
  confidence: "high" | "medium";
  status: "needs-review";
  decision: "pending" | "approved" | "rejected";
  checkedAt: string;
  note?: string;
}

export interface ReviewNote {
  eventId: string | null;
  kind: string;
  message: string;
  sourceId: string;
  sourceUrl: string;
  detailUrl?: string;
  checkedAt: string;
}

export interface SourceSnapshot {
  eventId: string;
  sources: SourceDefinition[];
}

export interface ConventionReviewQueue {
  generatedAt: string;
  mode: "review-only";
  policy: SourceDefinition[];
  sourceMap: SourceSnapshot[];
  proposals: ReviewProposal[];
  notes: ReviewNote[];
  errors: Array<{ eventId: string | null; sourceId: string; message: string }>;
}

export interface FetchPageResult {
  ok: boolean;
  status: number;
  html: string;
}

export type FetchPage = (url: string) => Promise<FetchPageResult>;

export const SOURCE_CATALOG: SourceDefinition[] = [
  {
    id: "comic-con-official",
    label: "Comic Con India official city page",
    kind: "official",
    url: "https://www.comicconindia.com/",
    authoritativeFor: ["coreFacts", "mainStageSchedule"],
    advisoryFor: ["guests"],
    note: "City pages own published dates, venue and the Main Stage schedule.",
  },
  {
    id: "comic-con-tickets",
    label: "Comic Con India official ticket portal",
    kind: "ticket",
    url: "https://tickets.comicconindia.com/",
    authoritativeFor: ["coreFacts", "ticketUrl", "ticketAvailability"],
    advisoryFor: ["offerPrices"],
    note: "JSON-LD is used for exact dates, image and live ticket links.",
  },
  {
    id: "anime-india-official",
    label: "Anime India official site",
    kind: "official",
    url: "https://animeindia.live/",
    authoritativeFor: ["coreFacts", "guests", "ticketUrl"],
    advisoryFor: ["announcements"],
    note: "City pages own dates, venue, guests and the official ticket links they publish.",
  },
  {
    id: "district-tickets",
    label: "District / BookMyShow ticket listing",
    kind: "ticket",
    url: "https://www.district.in/",
    authoritativeFor: ["ticketAvailability"],
    advisoryFor: ["ticketLinks"],
    parseable: false,
    note: "Availability only. Never used as a full convention calendar source.",
  },
  {
    id: "ota-tokyo-official",
    label: "Ōta TOKYO official site (JSON-LD)",
    kind: "official",
    url: "https://otatokyo.jp/",
    authoritativeFor: ["coreFacts", "ticketUrl", "ticketAvailability"],
    advisoryFor: ["performers"],
    note: "JSON-LD owns dates, venue and ticket state for Ōta TOKYO Delhi.",
  },
  {
    id: "ann-news",
    label: "Anime News Network",
    kind: "news",
    url: "https://www.animenewsnetwork.com/news/rss.xml",
    authoritativeFor: [],
    advisoryFor: ["announcements"],
    note: "Fast announcement signal only; never writes event fields.",
  },
  {
    id: "nodwin-news",
    label: "NODWIN Gaming news",
    kind: "news",
    url: "https://nodwingaming.com/feed/",
    authoritativeFor: [],
    advisoryFor: ["announcements"],
    note: "Fast announcement signal only; never writes event fields.",
  },
  {
    id: "animationxpress-news",
    label: "AnimationXpress news",
    kind: "news",
    url: "https://www.animationxpress.com/feed/",
    authoritativeFor: [],
    advisoryFor: ["announcements", "guests"],
    note: "Useful for Indian guest/event coverage; never writes event fields.",
  },
  {
    id: "rostercon-discovery",
    label: "Roster Con India (discovery only)",
    kind: "aggregator",
    url: "https://rostercon.com/en/location/india",
    authoritativeFor: [],
    advisoryFor: ["discovery"],
    excluded: true,
    note: "Not a convention organiser. Only helps find leads; never auto-synced.",
  },
];

export const NEWS_FEEDS = SOURCE_CATALOG.filter((source) => source.kind === "news");

/** A proposal must come from a URL on the host its source is allowed to own. */
export const TRUSTED_SOURCE_HOSTS: Record<string, string[]> = {
  "comic-con-official": ["comicconindia.com", "www.comicconindia.com"],
  "comic-con-tickets": ["tickets.comicconindia.com"],
  "anime-india-official": ["animeindia.live", "www.animeindia.live"],
  "district-tickets": ["district.in", "www.district.in", "link.district.in", "district.ae", "www.district.ae"],
  "ota-tokyo-official": ["otatokyo.jp", "www.otatokyo.jp"],
};

/** Official city pages observed on 28 Nov 2026. Ticket-only rows get an explicit page here. */
const OFFICIAL_PAGE_OVERRIDES: Record<string, string> = {
  "comic-con-indore-2026": "https://www.comicconindia.com/all-cities-pages-2026/indore-comic-con-2027",
  "comic-con-chennai-2027": "https://www.comicconindia.com/all-cities-pages-2026/chennai-comic-con-2027",
  "comic-con-kochi-2027": "https://www.comicconindia.com/all-cities-pages-2026/kochi-comic-con-2027",
  "comic-con-pune-2027": "https://www.comicconindia.com/all-cities-pages-2026/pune-comic-con-2027",
  "comic-con-bengaluru-2027": "https://www.comicconindia.com/all-cities-pages-2026/bangalore-comic-con-2027",
};

type OrganizerFamily = "comic-con" | "anime-india" | "ota-tokyo";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8211;|&#x2013;/gi, "-")
    .replace(/&#8217;|&#x2019;/gi, "'");
}

function cleanText(value: string): string {
  const withoutSuperscripts = value.replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, "$1");
  return decodeHtml(withoutSuperscripts.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function monthNumber(token: string): number | null {
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const key = token.toLowerCase().replace(/[^a-z]/g, "").slice(0, 3);
  return months[key] ?? null;
}

function dateKey(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== key) return null;
  return key;
}

/** Parse organiser date copy without shifting calendar days through timezones. */
export function parsePublishedDateRange(value: string): { startDate: string; endDate: string } | null {
  const text = decodeHtml(value)
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  // Organiser copy uses both "5th - 6th Dec" and HTML like "5<sup>th</sup> - 6<sup>th</sup>".
  const ordinal = "\\d{1,2}\\s*(?:st|nd|rd|th)?";
  const dayFirstRange = new RegExp(`(${ordinal}(?:\\s*(?:-|to)\\s*${ordinal})+)\\s+([A-Za-z]+)\\s*,?\\s*(\\d{4})`, "i").exec(text);
  if (dayFirstRange) {
    const month = monthNumber(dayFirstRange[2]);
    const year = Number(dayFirstRange[3]);
    const days = (dayFirstRange[1].match(/\d{1,2}/g) ?? []).map(Number);
    const start = dateKey(year, month ?? 0, days[0]);
    const end = dateKey(year, month ?? 0, days[days.length - 1]);
    if (start && end) return { startDate: start, endDate: end };
  }

  const dayMonthYear = new RegExp(`(${ordinal})\\s*-\\s*(${ordinal})\\s+([A-Za-z]+)\\s*,?\\s*(\\d{4})`, "i").exec(text);
  if (dayMonthYear) {
    const month = monthNumber(dayMonthYear[3]);
    const year = Number(dayMonthYear[4]);
    const start = dateKey(year, month ?? 0, Number(dayMonthYear[1].match(/\d{1,2}/)?.[0] ?? 0));
    const end = dateKey(year, month ?? 0, Number(dayMonthYear[2].match(/\d{1,2}/)?.[0] ?? 0));
    if (start && end) return { startDate: start, endDate: end };
  }

  const monthFirstRange = new RegExp(`([A-Za-z]+)\\s+(${ordinal})\\s*-\\s*(${ordinal})\\s*,?\\s*(\\d{4})`, "i").exec(text);
  if (monthFirstRange) {
    const month = monthNumber(monthFirstRange[1]);
    const year = Number(monthFirstRange[4]);
    const start = dateKey(year, month ?? 0, Number(monthFirstRange[2].match(/\d{1,2}/)?.[0] ?? 0));
    const end = dateKey(year, month ?? 0, Number(monthFirstRange[3].match(/\d{1,2}/)?.[0] ?? 0));
    if (start && end) return { startDate: start, endDate: end };
  }

  const singleDay = new RegExp(`([A-Za-z]+)\\s+(${ordinal})\\s*,?\\s*(\\d{4})`, "i").exec(text);
  if (singleDay) {
    const month = monthNumber(singleDay[1]);
    const year = Number(singleDay[3]);
    const key = dateKey(year, month ?? 0, Number(singleDay[2].match(/\d{1,2}/)?.[0] ?? 0));
    if (key) return { startDate: key, endDate: key };
  }

  return null;
}

function dateKeyFromIso(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) return null;
  const key = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== key) return null;
  return key;
}

function extractJsonLd(html: string): JsonRecord[] {
  const nodes: JsonRecord[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(decodeHtml(match[1]));
      const queue: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      while (queue.length > 0) {
        const current = queue.shift();
        if (Array.isArray(current)) {
          queue.unshift(...current);
        } else if (isRecord(current)) {
          if (Array.isArray(current["@graph"])) queue.unshift(...current["@graph"]);
          nodes.push(current);
        }
      }
    } catch {
      // A malformed unrelated block must not prevent other sources from being checked.
    }
  }
  return nodes;
}

function findEventNode(html: string): JsonRecord | null {
  const event = extractJsonLd(html).find((node) => {
    const value = node["@type"];
    const types = Array.isArray(value) ? value : [value];
    return types.some((type) => type === "Event" || type === "Festival");
  });
  return event ?? null;
}

function offerAvailability(event: JsonRecord): string | null {
  const raw = event.offers;
  const offers = Array.isArray(raw) ? raw : [raw];
  for (const offer of offers) {
    if (!isRecord(offer)) continue;
    const availability = asString(offer.availability);
    if (availability) return availability.split("/").pop() ?? availability;
  }
  return null;
}

function canonicalUrl(html: string): string | null {
  const $ = load(html);
  return $("link[rel='canonical']").first().attr("href") ?? null;
}

function guestNames(html: string): string[] {
  const $ = load(html);
  const names = $(".cp-guest-name, .speaker-content h3")
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter((name) => name.length > 2 && !/guests|performances|experiences/i.test(name));
  return [...new Set(names)].slice(0, 12);
}

interface ParsedFacts {
  values: Partial<Record<ConventionWatchField, string>>;
  notes: Array<{ kind: string; message: string }>;
}

function emptyFacts(): ParsedFacts {
  return { values: {}, notes: [] };
}

function parseComicConTicketPage(html: string, sourceUrl: string): ParsedFacts {
  const facts = emptyFacts();
  const event = findEventNode(html);
  if (!event) return facts;

  const name = asString(event.name);
  if (name) facts.values.name = name;

  const startDate = dateKeyFromIso(event.startDate);
  const endDate = dateKeyFromIso(event.endDate);
  if (startDate) facts.values.startDate = startDate;
  if (endDate) facts.values.endDate = endDate;

  const image = asString(event.image);
  if (image) facts.values.image = image;

  const canonical = canonicalUrl(html);
  if (canonical && /^https:\/\/tickets\.comicconindia\.com\//i.test(canonical)) {
    facts.values.ticketUrl = canonical;
  }

  const availability = offerAvailability(event);
  if (availability) {
    facts.notes.push({ kind: "ticket-availability", message: `Official ticket portal reports: ${availability}.` });
  }

  void sourceUrl;
  return facts;
}

function isStandaloneCityLabel(value: string): boolean {
  return (
    value.length > 2 &&
    value.length <= 30 &&
    !/(centre|center|ground|grounds|hall|complex|exhibition|trade|lawns|prangan|palace|stadium|road|sector)/i.test(value)
  );
}

function parseComicConOfficialPage(html: string, row: ConventionWatchRow): ParsedFacts {
  const facts = emptyFacts();
  const $ = load(html);
  const heroHtml = $("h1.heading-123").first().html();
  if (heroHtml) {
    const lines = heroHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .split("\n")
      .map((line) => cleanText(line).replace(/,$/, ""))
      .filter(Boolean);
    if (lines.length > 0) {
      const range = parsePublishedDateRange(lines[0]);
      if (range) {
        facts.values.startDate = range.startDate;
        facts.values.endDate = range.endDate;
      }
      const locationLines = lines.slice(1);
      const lastLine = locationLines[locationLines.length - 1];
      const standaloneCity = locationLines.length > 1 && lastLine && isStandaloneCityLabel(lastLine) ? lastLine : null;
      const venueLines = standaloneCity ? locationLines.slice(0, -1) : locationLines;
      if (venueLines.length > 0) facts.values.venue = venueLines.join(", ");
      // Most city pages put the city after a comma in the venue line. Do not
      // guess that suffix as a city; the stored row is the safer source there.
      if (standaloneCity) facts.values.city = standaloneCity;
      void row;
    }
  }

  const scheduleRows = $("#main-stage .cp-ms-row").length;
  if (scheduleRows > 0) {
    facts.notes.push({
      kind: "schedule",
      message: `Official Main Stage schedule published (${scheduleRows} rows). Schedule is review-only; the convention table has no schedule field.`,
    });
  }

  const names = guestNames(html);
  if (names.length > 0) {
    facts.notes.push({ kind: "guests", message: `Official guest names present: ${names.join(", ")}.` });
  }

  return facts;
}

function parseOtaOfficialPage(html: string, sourceUrl: string): ParsedFacts {
  const facts = emptyFacts();
  const event = findEventNode(html);
  if (!event) return facts;

  const name = asString(event.name);
  if (name) facts.values.name = name;

  const startDate = dateKeyFromIso(event.startDate);
  const endDate = dateKeyFromIso(event.endDate);
  if (startDate) facts.values.startDate = startDate;
  if (endDate) facts.values.endDate = endDate;

  const location = isRecord(event.location) ? event.location : {};
  const address = isRecord(location.address) ? location.address : {};
  const locationName = asString(location.name);
  const street = asString(address.streetAddress);
  const locality = asString(address.addressLocality);
  const venue = [locationName, [street, locality].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  if (venue) facts.values.venue = venue;

  const images = Array.isArray(event.image) ? event.image : [event.image];
  const image = images.map(asString).find((value): value is string => Boolean(value));
  if (image) facts.values.image = image;

  if (/href=["']#tickets["']|id=["']tickets["']/i.test(html)) {
    facts.values.ticketUrl = new URL("#tickets", sourceUrl).toString();
  }

  const availability = offerAvailability(event);
  if (availability) {
    facts.notes.push({ kind: "ticket-availability", message: `Official JSON-LD reports: ${availability}.` });
  }

  return facts;
}

function parseAnimeIndiaOfficialPage(html: string): ParsedFacts {
  const facts = emptyFacts();
  const $ = load(html);
  const aboutText = cleanText($("#about").text()) || cleanText($("main").text());

  const range = parsePublishedDateRange(aboutText);
  if (range) {
    facts.values.startDate = range.startDate;
    facts.values.endDate = range.endDate;
  }

  const venuePatterns = [
    /transforming\s+([A-Z][A-Za-z0-9&.,'’\- ]{3,80}?)\s+into\s+(?:a|an|the)\b/i,
    /\bvenue\s*[:\-]\s*([A-Z][A-Za-z0-9&.,'’\- ]{3,80})/i,
  ];
  for (const pattern of venuePatterns) {
    const match = pattern.exec(aboutText);
    if (match?.[1]) {
      facts.values.venue = match[1].trim().replace(/\s+/g, " ");
      break;
    }
  }

  const ticketLinks = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || !/district\.(?:in|ae)/i.test(href)) return;
    if (!/ticket|book|pass/i.test(`${$(element).text()} ${href}`)) return;
    ticketLinks.add(href);
  });
  if (ticketLinks.size === 1) {
    facts.values.ticketUrl = [...ticketLinks][0];
  } else if (ticketLinks.size > 1) {
    facts.notes.push({
      kind: "ticket-links",
      message: `Multiple official District links found (${ticketLinks.size}); ticketUrl left for manual selection.`,
    });
  }

  const names = guestNames(html);
  if (names.length > 0) {
    facts.notes.push({ kind: "guests", message: `Official guest names present: ${names.join(", ")}.` });
  }

  return facts;
}

function parseSource(html: string, source: SourceDefinition, row: ConventionWatchRow): ParsedFacts {
  switch (source.id) {
    case "comic-con-tickets":
      return parseComicConTicketPage(html, source.url);
    case "comic-con-official":
      return parseComicConOfficialPage(html, row);
    case "ota-tokyo-official":
      return parseOtaOfficialPage(html, source.url);
    case "anime-india-official":
      return parseAnimeIndiaOfficialPage(html);
    default:
      return emptyFacts();
  }
}

function organizerFamily(row: ConventionWatchRow): OrganizerFamily | null {
  const haystack = `${row.id} ${row.name} ${row.website} ${row.organizers.join(" ")}`.toLowerCase();
  if (haystack.includes("otatokyo") || haystack.includes("ōta tokyo") || haystack.includes("ota tokyo")) return "ota-tokyo";
  if (haystack.includes("animeindia") || haystack.includes("anime india")) return "anime-india";
  if (haystack.includes("comicconindia") || haystack.includes("comic con")) return "comic-con";
  return null;
}

function sourceById(id: string): SourceDefinition {
  const source = SOURCE_CATALOG.find((item) => item.id === id);
  if (!source) throw new Error(`Unknown convention source: ${id}`);
  return source;
}

function withUrl(id: string, url: string, overrides: Partial<SourceDefinition> = {}): SourceDefinition {
  return { ...sourceById(id), url, ...overrides };
}

function isEventCityPage(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith("comicconindia.com") &&
      parsed.pathname.startsWith("/all-cities-pages-2026/")
    );
  } catch {
    return false;
  }
}

function isAnimeIndiaCityPage(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("animeindia.live") && parsed.pathname.replace(/\/$/, "").length > 0;
  } catch {
    return false;
  }
}

function isTrustedUrl(url: string | null, hosts: string[]): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && hosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function isArchivedEvent(row: ConventionWatchRow, checkedAt: string): boolean {
  return toDateKey(row.endDate) < getIndiaDateKey(new Date(checkedAt));
}

/** Different fields legitimately come from different sources. */
export function resolveSourcesFor(row: ConventionWatchRow, checkedAt: string = new Date().toISOString()): SourceDefinition[] {
  const family = organizerFamily(row);
  const sources: SourceDefinition[] = [];

  if (family === "comic-con") {
    const officialUrl = OFFICIAL_PAGE_OVERRIDES[row.id] ?? row.website;
    sources.push(withUrl("comic-con-official", officialUrl, {
      parseable: isEventCityPage(officialUrl),
      note: isEventCityPage(officialUrl)
        ? undefined
        : "No event-specific city page registered; ticket portal supplies structured facts.",
    }));
    sources.push(withUrl("comic-con-tickets", row.ticketUrl ?? sourceById("comic-con-tickets").url, {
      parseable: isTrustedUrl(row.ticketUrl, TRUSTED_SOURCE_HOSTS["comic-con-tickets"]),
      note: isTrustedUrl(row.ticketUrl, TRUSTED_SOURCE_HOSTS["comic-con-tickets"])
        ? undefined
        : "No official ticket URL registered for this row.",
    }));
  } else if (family === "anime-india") {
    const cityPage = isAnimeIndiaCityPage(row.website);
    const archivedSharedPage = cityPage && isArchivedEvent(row, checkedAt);
    sources.push(withUrl("anime-india-official", row.website || sourceById("anime-india-official").url, {
      parseable: cityPage && !archivedSharedPage,
      note: archivedSharedPage
        ? "Past archive row shares the current city page; not parsed for new facts."
        : cityPage
          ? undefined
          : "Only the organiser homepage is registered for this row; city page must be verified manually.",
    }));
    sources.push(withUrl("district-tickets", row.ticketUrl ?? sourceById("district-tickets").url));
  } else if (family === "ota-tokyo") {
    sources.push(withUrl("ota-tokyo-official", row.website || sourceById("ota-tokyo-official").url));
  }

  sources.push(...NEWS_FEEDS);
  sources.push(sourceById("rostercon-discovery"));
  return sources;
}

export function isAuthoritativeSourceForField(source: SourceDefinition, field: ConventionWatchField): boolean {
  return (
    (source.authoritativeFor.includes("coreFacts") && CORE_FIELDS.includes(field)) ||
    source.authoritativeFor.includes(field)
  );
}

export function canApplyProposal(proposal: ReviewProposal): boolean {
  if (proposal.decision !== "approved" || proposal.status !== "needs-review") return false;
  if (!APPLICABLE_FIELDS.includes(proposal.field)) return false;
  if (!isValidFieldValue(proposal.field, proposal.proposedValue)) return false;
  const source = SOURCE_CATALOG.find((item) => item.id === proposal.sourceId);
  if (!source || source.excluded || source.kind === "news") return false;
  if (!isTrustedUrl(proposal.sourceUrl, TRUSTED_SOURCE_HOSTS[source.id] ?? [])) return false;
  return isAuthoritativeSourceForField(source, proposal.field);
}

function isValidFieldValue(field: ConventionWatchField, value: string): boolean {
  if (!value || value.trim() !== value) return false;
  if (/<[^>]*>/.test(value)) return false;
  if (field === "startDate" || field === "endDate") {
    return dateKeyFromIso(value) === value;
  }
  if (field === "ticketUrl" || field === "image") {
    return isTrustedUrl(value, [
      ...TRUSTED_SOURCE_HOSTS["comic-con-official"],
      ...TRUSTED_SOURCE_HOSTS["comic-con-tickets"],
      ...TRUSTED_SOURCE_HOSTS["anime-india-official"],
      ...TRUSTED_SOURCE_HOSTS["district-tickets"],
      ...TRUSTED_SOURCE_HOSTS["ota-tokyo-official"],
    ]);
  }
  return value.length <= 300;
}

/** Only public, non-cancelled, non-archived rows are ever handed to the watcher. */
export function selectPublicWatchRows(
  rows: ConventionWatchRow[],
  checkedAt: string = new Date().toISOString()
): ConventionWatchRow[] {
  return rows.filter((row) =>
    row.isPublic === true &&
    row.status !== "cancelled" &&
    !isArchivedEvent(row, checkedAt)
  );
}

export interface ApprovedPatch {
  eventId: string;
  field: ConventionWatchField;
  value: string;
  proposal: ReviewProposal;
}

/**
 * Convert an approved review file into narrow DB patches. A proposal is only
 * applied if the current value still matches the reviewed snapshot, so a
 * newer manual edit is never overwritten by a stale approval.
 */
export function buildApprovedPatches(
  queue: ConventionReviewQueue,
  rows: ConventionWatchRow[]
): ApprovedPatch[] {
  const patches: ApprovedPatch[] = [];
  const seen = new Set<string>();

  for (const proposal of queue.proposals) {
    const key = `${proposal.eventId}:${proposal.field}`;
    if (seen.has(key)) continue;
    const row = rows.find((item) => item.id === proposal.eventId && item.isPublic === true);
    if (!row) continue;
    if (!canApplyProposal(proposal)) continue;
    if (comparable(proposal.currentValue) !== comparable(currentValueFor(row, proposal.field))) continue;
    seen.add(key);
    patches.push({ eventId: proposal.eventId, field: proposal.field, value: proposal.proposedValue, proposal });
  }

  return patches;
}

function currentValueFor(row: ConventionWatchRow, field: ConventionWatchField): string | null {
  switch (field) {
    case "startDate":
      return toDateKey(row.startDate);
    case "endDate":
      return toDateKey(row.endDate);
    case "image":
      return row.image;
    case "ticketUrl":
      return row.ticketUrl;
    default:
      return row[field] ?? null;
  }
}

function comparable(value: string | null): string {
  if (value === null) return "";
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, "");
  return value.trim().replace(/\s+/g, " ");
}

function proposalRank(proposal: ReviewProposal): number {
  return (proposal.confidence === "high" ? 2 : 1) + (proposal.sourceKind === "official" || proposal.sourceKind === "ticket" ? 2 : 0);
}

const VENUE_STOP_WORDS = new Set([
  "the", "of", "and", "centre", "center", "convention", "exhibition", "ground", "grounds",
  "hall", "complex", "international", "trade", "lawns", "prangan", "palace", "stadium",
  "new", "sector", "road", "street", "cd", "2", "25",
]);

function venueTokens(value: string, state: string): Set<string> {
  // The identity of a venue is usually before the first comma; the suffix is
  // often just the city/neighborhood and would create false matches.
  const primary = value.split(",")[0] ?? value;
  const stateWords = state.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const excluded = new Set([...VENUE_STOP_WORDS, ...stateWords]);
  return new Set((primary.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => !excluded.has(token)));
}

function hasVenueOverlap(current: string, proposed: string, row: ConventionWatchRow): boolean {
  const currentTokens = venueTokens(current, row.state);
  const proposedTokens = venueTokens(proposed, row.state);
  return [...currentTokens].some((token) => proposedTokens.has(token));
}

export function collectNewsNotes(
  rows: ConventionWatchRow[],
  itemsByFeed: Array<{ feed: SourceDefinition; items: NewsItem[] }>,
  checkedAt: string = new Date().toISOString()
): ReviewNote[] {
  const notes: ReviewNote[] = [];

  for (const { feed, items } of itemsByFeed) {
    for (const item of items) {
      const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
      for (const row of rows) {
        const family = organizerFamily(row);
        const keywords = [row.name.toLowerCase()];
        if (family === "comic-con") {
          keywords.push(`comic con ${row.city}`.toLowerCase(), `${row.city} comic con`.toLowerCase());
        }
        if (family === "anime-india") {
          keywords.push(`anime india ${row.city}`.toLowerCase(), `${row.city} anime india`.toLowerCase());
        }
        if (family === "ota-tokyo") {
          keywords.push("ota tokyo", "ōta tokyo");
        }
        if (!keywords.some((keyword) => haystack.includes(keyword))) continue;
        notes.push({
          eventId: row.id,
          kind: "news-signal",
          message: `News signal: ${item.title}. Verify against the organiser before changing event facts.`,
          sourceId: feed.id,
          sourceUrl: feed.url,
          detailUrl: item.link || undefined,
          checkedAt,
        });
      }
    }
  }

  return notes;
}

export async function buildConventionReview(options: {
  rows: ConventionWatchRow[];
  newsNotes?: ReviewNote[];
  fetchPage?: FetchPage;
  checkedAt?: string;
}): Promise<ConventionReviewQueue> {
  const checkedAt = options.checkedAt ?? new Date().toISOString();
  const fetchPage: FetchPage = options.fetchPage ?? (async (url) => {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "user-agent": "ZyniVerseConventionWatcher/1.0 (local review tool)" },
      signal: AbortSignal.timeout(15_000),
    });
    return { ok: response.ok, status: response.status, html: await response.text() };
  });

  const proposals: ReviewProposal[] = [];
  const notes: ReviewNote[] = [...(options.newsNotes ?? [])];
  const errors: ConventionReviewQueue["errors"] = [];
  const sourceMap: SourceSnapshot[] = options.rows.map((row) => ({
    eventId: row.id,
    sources: resolveSourcesFor(row, checkedAt),
  }));

  for (const row of options.rows) {
    for (const source of resolveSourcesFor(row, checkedAt)) {
      if (source.excluded || source.kind === "news") continue;

      if (source.parseable === false) {
        if (source.kind !== "ticket" || !source.authoritativeFor.includes("ticketAvailability")) continue;
        try {
          const response = await fetchPage(source.url);
          notes.push({
            eventId: row.id,
            kind: "ticket-availability",
            message: `Ticket listing HTTP ${response.status}: ${response.ok ? "link reachable; availability not parsed" : "link needs manual check"}.`,
            sourceId: source.id,
            sourceUrl: source.url,
            checkedAt,
          });
        } catch (error) {
          errors.push({ eventId: row.id, sourceId: source.id, message: String(error) });
        }
        continue;
      }

      try {
        const response = await fetchPage(source.url);
        if (!response.ok) {
          errors.push({ eventId: row.id, sourceId: source.id, message: `HTTP ${response.status}` });
          continue;
        }

        const parsed = parseSource(response.html, source, row);
        for (const [field, proposedValue] of Object.entries(parsed.values) as Array<[ConventionWatchField, string]>) {
          if (!isAuthoritativeSourceForField(source, field)) continue;
          const currentValue = currentValueFor(row, field);
          if (!proposedValue || comparable(proposedValue) === comparable(currentValue)) continue;
          // A shorter organiser label is a caution, not a reason to discard a
          // more specific hall/landmark already verified in the stored record.
          if (field === "venue" && currentValue && hasVenueOverlap(currentValue, proposedValue, row)) {
            notes.push({
              eventId: row.id,
              kind: "review-caution",
              message: `Source venue "${proposedValue}" overlaps the stored venue "${currentValue}". Kept the stored venue for manual review.`,
              sourceId: source.id,
              sourceUrl: source.url,
              checkedAt,
            });
            continue;
          }
          proposals.push({
            eventId: row.id,
            field,
            currentValue,
            proposedValue,
            sourceId: source.id,
            sourceLabel: source.label,
            sourceKind: source.kind,
            sourceUrl: source.url,
            confidence: "high",
            status: "needs-review",
            decision: "pending",
            checkedAt,
            note: source.note,
          });
        }

        for (const parsedNote of parsed.notes) {
          notes.push({
            eventId: row.id,
            kind: parsedNote.kind,
            message: parsedNote.message,
            sourceId: source.id,
            sourceUrl: source.url,
            checkedAt,
          });
        }

      } catch (error) {
        errors.push({ eventId: row.id, sourceId: source.id, message: String(error) });
      }
    }
  }

  const deduped = new Map<string, ReviewProposal>();
  for (const proposal of proposals) {
    const key = `${proposal.eventId}:${proposal.field}`;
    const existing = deduped.get(key);
    if (!existing || proposalRank(proposal) > proposalRank(existing)) deduped.set(key, proposal);
  }

  return {
    generatedAt: checkedAt,
    mode: "review-only",
    policy: SOURCE_CATALOG,
    sourceMap,
    proposals: [...deduped.values()].sort((a, b) => a.eventId.localeCompare(b.eventId) || a.field.localeCompare(b.field)),
    notes: notes.sort((a, b) => (a.eventId ?? "").localeCompare(b.eventId ?? "") || a.kind.localeCompare(b.kind)),
    errors,
  };
}

export function defaultFetchPage(url: string): Promise<FetchPageResult> {
  return fetch(url, {
    cache: "no-store",
    headers: { "user-agent": "ZyniVerseConventionWatcher/1.0 (local review tool)" },
    signal: AbortSignal.timeout(15_000),
  }).then(async (response) => ({
    ok: response.ok,
    status: response.status,
    html: await response.text(),
  }));
}
