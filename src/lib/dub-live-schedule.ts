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
const CACHE_TTL_MS = 5 * 60 * 1000;

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

/** Returns fresh data at most once every five minutes. Never throws. */
export async function getLiveDubSchedule(): Promise<LiveDubSchedule | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  try {
    const res = await fetch(SCHEDULE_URL, {
      headers: HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return cached?.data || null;
    const parsed = parseSchedule(await res.text());
    if (!parsed) return cached?.data || null;
    cached = { at: Date.now(), data: parsed };
    return parsed;
  } catch {
    return cached?.data || null;
  }
}
