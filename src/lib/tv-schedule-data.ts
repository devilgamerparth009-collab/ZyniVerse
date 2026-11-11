import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { fetchAllEpgFromPw } from "./epg-pw";
import { fetchLiveStreamingSchedules, type PlatformSchedule } from "./streaming-live";
import { TV_CHANNELS, getDayName, type TvChannel } from "./tv-channels";

export interface ScheduleSlot {
  show: string;
  start: string;
  end: string;
  duration: number;
  description?: string;
  episode?: number;
  coverImage?: string;
  isLive?: boolean;
}

export interface ChannelSchedulePayload {
  channelId: string;
  channelName: string;
  channelColor: string;
  channelLogo?: string;
  channelType: "tv" | "youtube";
  days: Record<string, ScheduleSlot[]>;
}

export interface TvGrid {
  day: string;
  today: string;
  updatedAt: string;
  channels: ChannelSchedulePayload[];
  liveAiringTotal: number;
}

export const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** The linear channels whose grid comes from epg.pw. */
export const EPG_CHANNEL_IDS = [
  "cn",
  "sony_yay",
  "hungama",
  "super_hungama",
  "pogo",
  "nick",
  "nick_jr",
  "sonic",
  "discovery_kids",
  "disney_channel",
  "disney_junior",
  "animax",
];

/** Streaming platforms filled from AniList's live airing schedule. */
export const STREAMING_CHANNEL_IDS = [
  "crunchyroll",
  "netflix_anime",
  "prime_video",
  "muse_asia",
  "muse_india",
  "jio_hotstar",
  "sony_liv",
];

const EPG_TTL_MS = 6 * 60 * 60 * 1000;
/** AniList's week schedule barely changes; 30 min of DB cache is plenty. */
const STREAMING_TTL_MS = 30 * 60 * 1000;
/** Special `epgCache.channelId` row that holds the streaming platforms. */
const STREAMING_CACHE_ID = "__streaming__";
/** Per-instance memo so a warm lambda answers without touching the DB. */
const GRID_MEMO_MS = 60 * 1000;

let streamingMemo: { at: number; platforms: PlatformSchedule[] } | null = null;
const gridMemo = new Map<string, { at: number; grid: TvGrid }>();

function emptyDays(): Record<string, ScheduleSlot[]> {
  const days: Record<string, ScheduleSlot[]> = {};
  for (const d of ALL_DAYS) days[d] = [];
  return days;
}

function hasTodayData(days: Record<string, ScheduleSlot[]> | undefined, today: string): boolean {
  return !!days && Array.isArray(days[today]) && days[today].length > 0;
}

async function readEpgCache(): Promise<{
  map: Map<string, Record<string, ScheduleSlot[]>>;
  newest: Map<string, number>;
}> {
  const map = new Map<string, Record<string, ScheduleSlot[]>>();
  const newest = new Map<string, number>();
  try {
    const rows = await prisma.epgCache.findMany();
    for (const row of rows) {
      map.set(row.channelId, row.data as unknown as Record<string, ScheduleSlot[]>);
      newest.set(row.channelId, row.updatedAt.getTime());
    }
  } catch {
    // DB unavailable — caller will scrape live.
  }
  return { map, newest };
}

async function scrapeAndStore(): Promise<Map<string, Record<string, ScheduleSlot[]>>> {
  const map = new Map<string, Record<string, ScheduleSlot[]>>();
  const scraped = await fetchAllEpgFromPw();
  for (const entry of scraped) {
    map.set(entry.channelId, entry.days as Record<string, ScheduleSlot[]>);
  }
  // Write the whole batch in parallel; sequential upserts were adding seconds
  // to every cold refresh.
  await Promise.allSettled(
    scraped.map((entry) =>
      prisma.epgCache.upsert({
        where: { channelId: entry.channelId },
        update: { data: entry.days as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
        create: { channelId: entry.channelId, data: entry.days as unknown as Prisma.InputJsonValue },
      })
    )
  );
  return map;
}

async function getEpgMap(today: string): Promise<Map<string, Record<string, ScheduleSlot[]>>> {
  const { map, newest } = await readEpgCache();
  const now = Date.now();

  const freshEnough =
    EPG_CHANNEL_IDS.every((id) => hasTodayData(map.get(id), today)) &&
    EPG_CHANNEL_IDS.every((id) => {
      const ts = newest.get(id) ?? 0;
      return now - ts < EPG_TTL_MS;
    });

  if (freshEnough) return map;

  // Stale-while-revalidate. A cached grid is always better than a 20s wait, so
  // ANY usable cached day is served immediately while a refresh runs in the
  // background. This is what keeps the first visitor after the cache expires
  // (or after midnight, when yesterday's row no longer has "today") from
  // staring at a spinner.
  const hasAnything = EPG_CHANNEL_IDS.some((id) => {
    const days = map.get(id);
    return !!days && Object.values(days).some((d) => Array.isArray(d) && d.length > 0);
  });

  if (hasAnything) {
    void scrapeAndStore().catch(() => {});
    return map;
  }

  // Truly cold: scrape, but never let epg.pw hold the request hostage.
  const scraped = await withTimeout(
    scrapeAndStore(),
    9000,
    new Map<string, Record<string, ScheduleSlot[]>>()
  );
  // Merge so a partial scrape keeps the good cached channels around.
  for (const id of EPG_CHANNEL_IDS) {
    const next = scraped.get(id);
    if (next && Object.values(next).some((d) => d.length > 0)) map.set(id, next);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Streaming platforms (AniList)                                       */
/* ------------------------------------------------------------------ */

/**
 * AniList's week schedule is the slowest part of the TV grid: a cold fetch is
 * up to six paginated GraphQL calls and it rate-limits hard. Persisting the
 * result in the existing `epgCache` table (under a reserved channel id) means a
 * cold lambda only does one small DB read, and the grid stays fast all day.
 */
async function readStreamingCache(): Promise<{ platforms: PlatformSchedule[]; at: number } | null> {
  try {
    const row = await prisma.epgCache.findUnique({ where: { channelId: STREAMING_CACHE_ID } });
    if (!row) return null;
    const data = row.data as unknown as { platforms?: PlatformSchedule[] };
    if (!Array.isArray(data?.platforms)) return null;
    return { platforms: data.platforms, at: row.updatedAt.getTime() };
  } catch {
    return null;
  }
}

async function getStreamingSchedules(): Promise<PlatformSchedule[]> {
  const now = Date.now();
  if (streamingMemo && now - streamingMemo.at < STREAMING_TTL_MS) {
    return streamingMemo.platforms;
  }

  const cached = await readStreamingCache();
  if (cached && now - cached.at < STREAMING_TTL_MS) {
    streamingMemo = { at: cached.at, platforms: cached.platforms };
    return cached.platforms;
  }

  const fresh = await withTimeout(fetchLiveStreamingSchedules(), 6000, []);

  if (fresh.length === 0) {
    // AniList down or rate-limited: keep the previous week on screen rather
    // than blanking every streaming channel.
    if (cached) {
      streamingMemo = { at: cached.at, platforms: cached.platforms };
      return cached.platforms;
    }
    return [];
  }

  streamingMemo = { at: now, platforms: fresh };
  void prisma.epgCache
    .upsert({
      where: { channelId: STREAMING_CACHE_ID },
      update: { data: { platforms: fresh } as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
      create: { channelId: STREAMING_CACHE_ID, data: { platforms: fresh } as unknown as Prisma.InputJsonValue },
    })
    .catch(() => {});
  return fresh;
}

function calculateEndTime(start: string, durationMin: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = (h * 60 + m + durationMin) % (24 * 60);
  const endH = Math.floor(total / 60).toString().padStart(2, "0");
  const endM = (total % 60).toString().padStart(2, "0");
  return `${endH}:${endM}`;
}

/** Never let a slow third-party API hold the whole grid hostage. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function channelPayload(channel: TvChannel, days: Record<string, ScheduleSlot[]>): ChannelSchedulePayload {
  return {
    channelId: channel.id,
    channelName: channel.name,
    channelColor: channel.color,
    channelLogo: channel.logoUrl,
    channelType: channel.type,
    days,
  };
}

/**
 * Builds the complete TV + streaming grid for a given weekday.
 *
 * Linear channels come from the epg.pw cache (refreshed at most every 6h) and
 * streaming platforms come from AniList's real airing schedule. Both sources
 * are merged here so `/api/tv-schedule` and `/api/tv-schedule/live` always
 * agree and never return an empty grid while data exists.
 *
 * Results are memoised per weekday for a minute: a warm lambda then answers in
 * milliseconds instead of re-reading every (large) EPG row on each request.
 */
export async function buildTvSchedule(day?: string): Promise<TvGrid> {
  const today = getDayName();
  const selectedDay = day && ALL_DAYS.includes(day) ? day : today;

  const memoKey = `${today}|${selectedDay}`;
  const memo = gridMemo.get(memoKey);
  if (memo && Date.now() - memo.at < GRID_MEMO_MS) return memo.grid;

  const grid = await buildGrid(selectedDay, today);
  gridMemo.set(memoKey, { at: Date.now(), grid });
  return grid;
}

async function buildGrid(selectedDay: string, today: string): Promise<TvGrid> {
  const [epgMap, liveStreaming] = await Promise.all([
    getEpgMap(today),
    getStreamingSchedules(),
  ]);

  const channels: ChannelSchedulePayload[] = [];

  for (const id of EPG_CHANNEL_IDS) {
    const channel = TV_CHANNELS[id];
    if (!channel) continue;
    const cached = epgMap.get(id);
    const days = emptyDays();
    if (cached) {
      for (const d of ALL_DAYS) {
        if (Array.isArray(cached[d])) days[d] = cached[d];
      }
    }
    channels.push(channelPayload(channel, days));
  }

  for (const id of STREAMING_CHANNEL_IDS) {
    const channel = TV_CHANNELS[id];
    if (!channel) continue;
    channels.push(channelPayload(channel, emptyDays()));
  }

  // Any extra channel in the catalogue (e.g. YouTube channels) still shows up.
  for (const channel of Object.values(TV_CHANNELS)) {
    if (channels.some((c) => c.channelId === channel.id)) continue;
    channels.push(channelPayload(channel, emptyDays()));
  }

  let liveAiringTotal = 0;
  for (const platform of liveStreaming) {
    const target = channels.find((c) => c.channelId === platform.platformId);
    if (!target) continue;
    for (const [dayName, shows] of Object.entries(platform.shows)) {
      if (!target.days[dayName]) target.days[dayName] = [];
      for (const show of shows) {
        const already = target.days[dayName].some(
          (s) => s.show.toLowerCase() === show.title.toLowerCase()
        );
        if (already) continue;
        target.days[dayName].push({
          show: show.title,
          start: show.airTime,
          end: calculateEndTime(show.airTime, 24),
          duration: 24,
          description: `Episode ${show.episode} · simulcast on AniList`,
          episode: show.episode,
          coverImage: show.coverImage,
          isLive: true,
        });
        liveAiringTotal++;
      }
      target.days[dayName].sort((a, b) => a.start.localeCompare(b.start));
    }
  }

  // Keep the requested day first in the payload but sort channels by whether
  // they actually have something airing that day — the useful ones on top.
  channels.sort((a, b) => {
    const aHas = (a.days[selectedDay]?.length ?? 0) > 0 ? 0 : 1;
    const bHas = (b.days[selectedDay]?.length ?? 0) > 0 ? 0 : 1;
    if (aHas !== bHas) return aHas - bHas;
    return a.channelName.localeCompare(b.channelName);
  });

  return {
    day: selectedDay,
    today,
    updatedAt: new Date().toISOString(),
    channels,
    liveAiringTotal,
  };
}

/** Today + the next six days, in display order. */
export function getScheduleDays(): string[] {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const today = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => names[(today + i) % 7]);
}
