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
  /**
   * Where the listings came from:
   *  - `epg`      real epg.pw scrape
   *  - `fallback` curated offline guide (epg.pw unreachable)
   *  - `live`     AniList simulcast data
   *  - `empty`    nothing available
   */
  source?: "epg" | "fallback" | "live" | "empty";
}

export interface TvGrid {
  day: string;
  today: string;
  updatedAt: string;
  channels: ChannelSchedulePayload[];
  liveAiringTotal: number;
  /** True when at least one linear channel is showing the offline guide. */
  offlineLinear?: boolean;
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
/** Stops a failing epg.pw from being hammered on every request. */
let lastScrapeAt = 0;
const SCRAPE_COOLDOWN_MS = 2 * 60 * 1000;

function emptyDays(): Record<string, ScheduleSlot[]> {
  const days: Record<string, ScheduleSlot[]> = {};
  for (const d of ALL_DAYS) days[d] = [];
  return days;
}

function hasTodayData(days: Record<string, ScheduleSlot[]> | undefined, today: string): boolean {
  return !!days && Array.isArray(days[today]) && days[today].length > 0;
}

/* ------------------------------------------------------------------ */
/* Offline linear guide                                                */
/* ------------------------------------------------------------------ */

/**
 * Curated per-channel lineups used only when epg.pw cannot be reached from the
 * server. They are clearly labelled as an offline guide in the UI — the point is
 * that a viewer always sees *something* useful for a channel instead of an
 * empty timeline, and the real scrape replaces them as soon as it succeeds.
 */
const LINEAR_FALLBACK_LINEUPS: Record<string, string[]> = {
  cn: [
    "Looney Tunes Cartoons",
    "The Tom and Jerry Show",
    "The Powerpuff Girls",
    "Ben 10",
    "The Amazing World of Gumball",
    "We Bare Bears",
    "Teen Titans Go!",
    "Craig of the Creek",
    "Regular Show",
    "Adventure Time",
    "Dexter's Laboratory",
    "Scooby-Doo! Mystery Incorporated",
  ],
  sony_yay: [
    "Taarak Mehta Kka Chhota Chashmah",
    "Honey Bunny Ka Jholmaal",
    "Pakdam Pakdai",
    "Kicko & Super Speedo",
    "Inspector Fabre",
    "Gattu Battu",
    "Bhaalu Gaadi",
    "Chimpoo Simpoo",
    "Krishna Balram",
    "Oscar's Oasis",
  ],
  hungama: [
    "Shin-chan",
    "Doraemon",
    "Ninja Hattori",
    "Perman",
    "Kiteretsu",
    "Chhota Bheem",
    "Keymon Ache",
    "Suneel in the World",
    "Beyblade Burst",
    "Pokémon",
  ],
  super_hungama: [
    "Chhota Bheem",
    "Mighty Raju",
    "Little Singham",
    "Shiva",
    "Arjun: Prince of Bali",
    "Pakdam Pakdai",
    "Bali",
    "Gattu Battu",
    "Krishna Balram",
    "Vir: The Robot Boy",
  ],
  pogo: [
    "Chhota Bheem",
    "Little Singham",
    "Mighty Raju",
    "Shaktimaan",
    "Bandbudh Aur Budbak",
    "Tik Tak Tail",
    "Gattu Battu",
    "Krishna Balram",
    "Pakdam Pakdai",
    "Bali",
  ],
  nick: [
    "SpongeBob SquarePants",
    "The Loud House",
    "The Casagrandes",
    "Ninja Hattori",
    "Motu Patlu",
    "Pakdam Pakdai",
    "Kung Fu Panda: Legends of Awesomeness",
    "Avatar: The Last Airbender",
    "Teenage Mutant Ninja Turtles",
    "The Fairly OddParents",
  ],
  nick_jr: [
    "Peppa Pig",
    "PAW Patrol",
    "Dora the Explorer",
    "Blue's Clues & You!",
    "Blaze and the Monster Machines",
    "Bubble Guppies",
    "Shimmer and Shine",
    "Rusty Rivets",
    "Thomas & Friends",
    "Max & Ruby",
  ],
  sonic: [
    "Sonic Boom",
    "Motu Patlu",
    "Ninja Hattori",
    "Pakdam Pakdai",
    "Oggy and the Cockroaches",
    "Keymon Ache",
    "Rise of the Teenage Mutant Ninja Turtles",
    "Power Rangers",
    "Gattu Battu",
    "Bali",
  ],
  discovery_kids: [
    "How It's Made",
    "Wild Kratts",
    "Dino Dan",
    "MythBusters",
    "Man vs. Wild",
    "Science Max",
    "Animal Planet Kids",
    "Into the Wild",
  ],
  disney_channel: [
    "DuckTales",
    "Mickey Mouse Clubhouse",
    "Phineas and Ferb",
    "Gravity Falls",
    "Miraculous: Tales of Ladybug & Cat Noir",
    "Big Hero 6: The Series",
    "Kim Possible",
    "Amphibia",
    "The Owl House",
    "Fish Hooks",
  ],
  disney_junior: [
    "Mickey Mouse Clubhouse",
    "Sofia the First",
    "Doc McStuffins",
    "Jake and the Never Land Pirates",
    "PJ Masks",
    "Bluey",
    "Puppy Dog Pals",
    "Vampirina",
    "Fancy Nancy",
    "Muppet Babies",
  ],
  animax: [
    "Naruto",
    "Bleach",
    "One Piece",
    "Jujutsu Kaisen",
    "Demon Slayer",
    "My Hero Academia",
    "Black Clover",
    "Hunter x Hunter",
    "Fairy Tail",
    "Sword Art Online",
  ],
  epic_kids: [
    "Chhota Bheem",
    "Little Singham",
    "Mighty Raju",
    "Shiva",
    "Vir: The Robot Boy",
    "Gattu Battu",
    "Krishna Balram",
    "Bali",
    "Pakdam Pakdai",
    "Arjun: Prince of Bali",
  ],
};

const DEFAULT_LINEUP = [
  "Anime Marathon",
  "Cartoon Classics",
  "Family Movie",
  "Kids Block",
  "Adventure Time",
  "Comedy Hour",
];

const FALLBACK_START_MIN = 6 * 60;
const FALLBACK_END_MIN = 23 * 60 + 30;
const FALLBACK_SLOT_MIN = 30;

function minutesToHhmm(total: number): string {
  const clamped = Math.min(total, 24 * 60 - 1);
  const h = Math.floor(clamped / 60).toString().padStart(2, "0");
  const m = (clamped % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** A full week of half-hour slots built from the channel's curated lineup. */
function fallbackDaysFor(channelId: string): Record<string, ScheduleSlot[]> {
  const lineup = LINEAR_FALLBACK_LINEUPS[channelId] ?? DEFAULT_LINEUP;
  const days = emptyDays();
  let cursor = 0;

  for (const day of ALL_DAYS) {
    const slots: ScheduleSlot[] = [];
    for (let minute = FALLBACK_START_MIN; minute < FALLBACK_END_MIN; minute += FALLBACK_SLOT_MIN) {
      const show = lineup[cursor++ % lineup.length];
      slots.push({
        show,
        start: minutesToHhmm(minute),
        end: minutesToHhmm(minute + FALLBACK_SLOT_MIN),
        duration: FALLBACK_SLOT_MIN,
        description: "Offline guide · live EPG unavailable",
      });
    }
    days[day] = slots;
  }

  return days;
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

/**
 * Resolves the epg.pw cache into a per-channel day map.
 *
 * The important subtlety: a cached row can hold data for *other* days but none
 * for today (the common case right after midnight, or when the previous scrape
 * only reached a subset of channels). Serving that map as-is made every linear
 * channel report `source=epg` with zero slots for the selected day. So we only
 * short-circuit when a meaningful share of channels actually has today's data,
 * and otherwise wait for a bounded fresh scrape.
 */
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

  const channelsWithToday = EPG_CHANNEL_IDS.filter((id) => hasTodayData(map.get(id), today)).length;
  const enoughToday = channelsWithToday >= Math.ceil(EPG_CHANNEL_IDS.length / 2);

  // Stale-while-revalidate, but only when the cache genuinely covers today.
  // A grid with half the channels on today's listings is still better than a
  // 9s spinner, and the background scrape fills the rest in.
  if (enoughToday) {
    if (now - lastScrapeAt > SCRAPE_COOLDOWN_MS) {
      lastScrapeAt = now;
      void scrapeAndStore().catch(() => {});
    }
    return map;
  }

  // No usable data for today: block on a bounded scrape. The cooldown prevents
  // a burst of requests from each launching their own scrape.
  if (now - lastScrapeAt <= SCRAPE_COOLDOWN_MS) return map;

  lastScrapeAt = now;
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
  let offlineLinear = false;

  for (const id of EPG_CHANNEL_IDS) {
    const channel = TV_CHANNELS[id];
    if (!channel) continue;
    const cached = epgMap.get(id);
    const days = emptyDays();
    let hasRealData = false;
    if (cached) {
      for (const d of ALL_DAYS) {
        if (Array.isArray(cached[d]) && cached[d].length > 0) {
          days[d] = cached[d];
          hasRealData = true;
        }
      }
    }

    if (!hasRealData) {
      // epg.pw unreachable from this server: keep the channel useful with the
      // curated offline guide instead of an empty timeline.
      Object.assign(days, fallbackDaysFor(id));
      offlineLinear = true;
      channels.push({ ...channelPayload(channel, days), source: "fallback" });
      continue;
    }

    // The cache may cover other days but not the one being viewed (this is
    // exactly what made every linear channel render an empty timeline while
    // still claiming `source=epg`). Fill just that day from the offline guide.
    if ((days[selectedDay]?.length ?? 0) === 0) {
      days[selectedDay] = fallbackDaysFor(id)[selectedDay];
      offlineLinear = true;
      channels.push({ ...channelPayload(channel, days), source: "fallback" });
      continue;
    }

    channels.push({ ...channelPayload(channel, days), source: "epg" });
  }

  for (const id of STREAMING_CHANNEL_IDS) {
    const channel = TV_CHANNELS[id];
    if (!channel) continue;
    channels.push({ ...channelPayload(channel, emptyDays()), source: "empty" });
  }

  // Any extra channel in the catalogue (e.g. YouTube channels) still shows up.
  // A TV channel with no epg.pw mapping gets the offline guide instead of a
  // permanently blank timeline — but it does not trigger the global offline
  // banner, because that channel never had live data to lose.
  for (const channel of Object.values(TV_CHANNELS)) {
    if (channels.some((c) => c.channelId === channel.id)) continue;
    if (channel.type === "tv") {
      channels.push({ ...channelPayload(channel, fallbackDaysFor(channel.id)), source: "fallback" });
      continue;
    }
    channels.push({ ...channelPayload(channel, emptyDays()), source: "empty" });
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
    if (Object.values(target.days).some((slots) => slots.length > 0)) {
      target.source = "live";
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
    offlineLinear,
  };
}

/** Today + the next six days, in display order. */
export function getScheduleDays(): string[] {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const today = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => names[(today + i) % 7]);
}
