/**
 * Live mirror of the Anime Dub Hindi schedule page.
 *
 * The APK's Dub Hub has to look and behave like https://www.animedubhindi.link/schedule.php
 * (Ongoing + Upcoming sections, IST weekday/time and a real countdown). Rather
 * than duplicating editorial data by hand, we read the public page and expose a
 * small, stable JSON shape that the app can refresh every minute.
 *
 * Only factual metadata is kept and every item links back to a search on the
 * original site. If the markup changes, the route returns the last good result
 * instead of blanking the screen.
 */
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { getDubSchedule, type DubScheduleDTO } from "@/lib/dub-import/queries";

export interface LiveDubAiring {
  id: string;
  title: string;
  posterUrl: string | null;
  season: string | null;
  episodeInfo: string | null;
  languages: string[];
  dayLabel: string | null;
  timeLabel: string | null;
  dateLabel: string | null;
  releaseAt: string | null;
  sourceUrl: string;
}

export interface LiveDubSchedule {
  source: string;
  sourceUrl: string;
  timezone: "Asia/Kolkata";
  fetchedAt: string;
  ongoing: LiveDubAiring[];
  upcoming: LiveDubAiring[];
}

const SOURCE_BASE = (
  process.env.DUB_SCHEDULE_BASE || "https://www.animedubhindi.link"
).replace(/\/$/, "");
const SCHEDULE_URL = `${SOURCE_BASE}/schedule.php`;
// Cloudflare sometimes blocks serverless egress. Jina Reader can return the
// original HTML (`x-respond-with: html`) from its own network, so the app still
// mirrors the live page instead of showing an error. Set to "none" to disable.
const PROXY_BASE = (process.env.DUB_SCHEDULE_PROXY || "https://r.jina.ai").replace(/\/$/, "");
const CACHE_TTL_MS = 5 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const WEEKDAYS: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

let cached: { at: number; data: LiveDubSchedule } | null = null;

function clean(value: string | undefined | null): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function languageFromClass(className: string | undefined, text: string): string {
  const match = /lang-(\w+)/.exec(className || "");
  if (match) {
    const key = match[1].toLowerCase();
    const known: Record<string, string> = {
      hindi: "Hindi", tamil: "Tamil", telugu: "Telugu", bengali: "Bengali",
      bangla: "Bengali", malayalam: "Malayalam", kannada: "Kannada",
      english: "English", japanese: "Japanese",
    };
    if (known[key]) return known[key];
  }
  return clean(text);
}

/** "18 Jan 2027" + "09:30 PM" -> UTC instant, assuming IST (+05:30). */
function istDate(dateLabel: string | null, timeLabel: string | null): string | null {
  if (!dateLabel || !timeLabel) return null;
  const parts = dateLabel.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  const time = timeLabel.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!parts || !time) return null;
  const month = MONTHS[parts[2].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  let hours = Number(time[1]) % 12;
  if ((time[3] || "").toUpperCase() === "PM") hours += 12;
  const minutes = Number(time[2]);
  return new Date(
    Date.UTC(Number(parts[3]), month, Number(parts[1]), hours - 5, minutes - 30)
  ).toISOString();
}

function parseCard(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
  section: "ongoing" | "upcoming"
): LiveDubAiring | null {
  const title = clean(card.find("h2").first().text());
  if (!title) return null;

  const metas = card.find(".meta-box").toArray().map((el) => clean($(el).text())).filter(Boolean);
  const season = metas.find((m) => /season/i.test(m)) || null;
  const episodeInfo =
    metas.find((m) => /\bep\b|coming soon|tba/i.test(m)) || null;

  const languages = Array.from(
    new Set(
      card.find(".lang span").toArray()
        .map((el) => languageFromClass($(el).attr("class"), $(el).text()))
        .filter((value) => value && value.length < 24)
    )
  );

  const blocks = card.find(".date-time .date-block").toArray().map((el) => clean($(el).text()));
  const dayLabel = blocks.find((b) => /monday|tuesday|wednesday|thursday|friday|saturday|sunday|daily/i.test(b)) || null;
  const dateLabel = blocks.find((b) => /\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/.test(b)) || null;
  const timeLabel = clean(card.find(".time-block").first().text()) || null;
  const rawRelease = clean(card.find("[data-release]").first().attr("data-release"));
  const parsedRelease = rawRelease && !Number.isNaN(new Date(rawRelease).getTime())
    ? new Date(rawRelease).toISOString()
    : istDate(dateLabel, timeLabel);

  return {
    id: `${section}-${slug(title)}-${slug(season || "s1")}`,
    title,
    posterUrl: clean(card.find("img.poster").first().attr("src") || card.find("img").first().attr("src")) || null,
    season,
    episodeInfo,
    languages,
    dayLabel,
    timeLabel,
    dateLabel,
    releaseAt: section === "ongoing" ? parsedRelease : parsedRelease,
    sourceUrl: `${SOURCE_BASE}/?s=${encodeURIComponent(title)}`,
  };
}

function parseSchedule(html: string): LiveDubSchedule | null {
  const $ = cheerio.load(html);
  const read = (selector: string, section: "ongoing" | "upcoming") =>
    $(selector).toArray()
      .map((el) => parseCard($, $(el), section))
      .filter((item): item is LiveDubAiring => Boolean(item));

  const ongoing = read("#ongoingList .card", "ongoing");
  const upcoming = read("#upcomingList .card", "upcoming");

  // Markup fallback: sections are still identifiable by their nearest heading.
  // Use Cheerio's `prev()` wrapper rather than the raw domhandler `prev` field,
  // which is a nullable ChildNode and has no `.is()`/`.length`.
  if (!ongoing.length && !upcoming.length) {
    const sectionFor = (el: AnyNode): "ongoing" | "upcoming" | null => {
      let node = $(el).prev();
      while (node.length && !node.is("h4")) node = node.prev();
      const heading = clean(node.text()).toLowerCase();
      if (heading.includes("ongoing")) return "ongoing";
      if (heading.includes("upcoming")) return "upcoming";
      return null;
    };

    allCards: for (const el of $(".card").toArray()) {
      const section = sectionFor(el);
      if (!section) continue allCards;
      const item = parseCard($, $(el), section);
      if (item) (section === "ongoing" ? ongoing : upcoming).push(item);
    }
  }

  if (!ongoing.length && !upcoming.length) return null;
  return {
    source: "Anime Dub Hindi",
    sourceUrl: SCHEDULE_URL,
    timezone: "Asia/Kolkata",
    fetchedAt: new Date().toISOString(),
    ongoing,
    upcoming,
  };
}

async function fetchHtml(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function fetchFreshSchedule(): Promise<LiveDubSchedule | null> {
  const direct = await fetchHtml(SCHEDULE_URL, HEADERS, 12000);
  if (direct) {
    const parsed = parseSchedule(direct);
    if (parsed) return parsed;
  }

  if (PROXY_BASE && PROXY_BASE !== "none") {
    const proxied = await fetchHtml(
      `${PROXY_BASE}/${SCHEDULE_URL}`,
      { ...HEADERS, "x-respond-with": "html" },
      15000
    );
    if (proxied) {
      const parsed = parseSchedule(proxied);
      if (parsed) return parsed;
    }
  }
  return null;
}

/** Fallback countdown from the weekly slot when the stored timestamp has gone stale. */
function nextIstRelease(row: DubScheduleDTO): string | null {
  const existing = row.releaseAt ? new Date(row.releaseAt) : null;
  if (existing && !Number.isNaN(existing.getTime()) && existing.getTime() > Date.now()) {
    return existing.toISOString();
  }
  const time = row.timeLabel?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!time || !row.dayLabel) return existing?.toISOString() || null;

  const dayText = row.dayLabel.trim().toLowerCase();
  const weekday = dayText === "daily" ? null : WEEKDAYS[dayText.slice(0, 3)];
  if (dayText !== "daily" && weekday === undefined) return existing?.toISOString() || null;

  let hours = Number(time[1]) % 12;
  if ((time[3] || "").toUpperCase() === "PM") hours += 12;
  const minutes = Number(time[2]);
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const dayDelta = weekday === null ? 0 : (weekday - nowIst.getUTCDay() + 7) % 7;
  let candidate = Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate() + dayDelta,
    hours - 5,
    minutes - 30
  );
  if (candidate <= Date.now()) candidate += (weekday === null ? 1 : 7) * 86_400_000;
  return new Date(candidate).toISOString();
}

function isOngoingRow(row: DubScheduleDTO): boolean {
  const episode = row.episodeInfo || "";
  if (/coming soon|tba/i.test(episode)) return false;
  return /ep\s*\d+/i.test(episode) || Boolean(row.releaseAt);
}

/** Last resort when both live fetches fail: the synced schedule in the database. */
async function fromDatabase(): Promise<LiveDubSchedule | null> {
  try {
    const rows = await getDubSchedule({ limit: 200 });
    if (!rows.length) return null;

    const toAiring = (row: DubScheduleDTO): LiveDubAiring => ({
      id: `${isOngoingRow(row) ? "ongoing" : "upcoming"}-${slug(row.title)}-${slug(row.season || "s1")}`,
      title: row.title,
      posterUrl: row.posterUrl,
      season: row.season,
      episodeInfo: row.episodeInfo,
      languages: row.languages,
      dayLabel: row.dayLabel,
      timeLabel: row.timeLabel,
      dateLabel: null,
      releaseAt: nextIstRelease(row),
      sourceUrl: `${SOURCE_BASE}/?s=${encodeURIComponent(row.title)}`,
    });

    const ongoing = rows.filter(isOngoingRow).map(toAiring);
    const upcoming = rows.filter((row) => !isOngoingRow(row)).map(toAiring);
    if (!ongoing.length && !upcoming.length) return null;

    return {
      source: "Anime Dub Hindi",
      sourceUrl: SCHEDULE_URL,
      timezone: "Asia/Kolkata",
      fetchedAt: new Date().toISOString(),
      ongoing,
      upcoming,
    };
  } catch {
    return null;
  }
}

/**
 * Live HTML first, reader proxy second, synced database last. Never throws and
 * caches a good result for five minutes so the APK's 60-second refresh is cheap.
 */
export async function getLiveDubSchedule(): Promise<LiveDubSchedule | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const fresh = await fetchFreshSchedule();
  if (fresh) {
    cached = { at: Date.now(), data: fresh };
    return fresh;
  }

  const fallback = await fromDatabase();
  if (fallback) {
    cached = { at: Date.now(), data: fallback };
    return fallback;
  }
  return cached?.data || null;
}
