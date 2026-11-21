export interface TvChannel {
  id: string;
  name: string;
  shortName: string;
  color: string;
  region: string;
  website: string;
  dthNumbers?: string;
  type: "tv" | "youtube";
  subscriberCount?: string;
  logoUrl?: string;
  /**
   * Same-origin, CDN-cached copy of `logoUrl`.
   *
   * Wikimedia's `upload.wikimedia.org` rate-limits bursts of image requests
   * with HTTP 429 (very common from mobile carriers), which is why channel
   * logos used to render as blank squares inside the app. Routing the image
   * through our own API means the phone talks to zyverse.in only, and the
   * origin server fetches the file once and caches it for a week.
   */
  logoProxyUrl?: string;
  /**
   * Which plate the logo sits on. Logos are drawn for one background: a black
   * wordmark disappears on a dark plate, a white one disappears on a light
   * plate. Measured per file (mean luminance of the opaque pixels) so every
   * channel stays legible. Defaults to "light".
   */
  logoPlate?: "light" | "dark";
  logoInvert?: boolean;
}

export interface TimeSlot {
  show: string;
  start: string;
  end: string;
  duration: number;
  description?: string;
}

export interface DaySchedule {
  day: string;
  slots: TimeSlot[];
}

export interface ChannelSchedule {
  channelId: string;
  schedules: DaySchedule[];
}

export interface TvAnimeEntry {
  id: string;
  title: string;
  englishTitle?: string;
  malId?: number;
  episodes?: number;
  status?: string;
  genres?: string[];
  channel?: string;
  airTime?: string;
  image?: string;
}

const RAW_TV_CHANNELS: Record<string, TvChannel> = {
  cn: {
    id: "cn",
    name: "Cartoon Network",
    shortName: "CN",
    color: "#4CAF50",
    region: "India",
    website: "https://www.cartoonnetwork.in",
    dthNumbers: "Tata Play 667, Airtel 666",
    type: "tv",
    logoInvert: true,
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cartoon_Network_2010_logo.svg/250px-Cartoon_Network_2010_logo.svg.png",
  },
  sony_yay: {
    id: "sony_yay",
    name: "SONY YAY!",
    shortName: "YAY",
    color: "#FF4081",
    region: "India",
    website: "https://www.sonyyay.com",
    dthNumbers: "Tata Play 663, Airtel 665",
    type: "tv",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/SONY_YAY_2022_Logo.png/250px-SONY_YAY_2022_Logo.png",
  },
  hungama: {
    id: "hungama",
    name: "Hungama",
    shortName: "HG",
    color: "#FF6F00",
    region: "India",
    website: "https://www.hungama.com",
    dthNumbers: "Tata Play 655, Airtel 453",
    type: "tv",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Hungama_TV.svg/250px-Hungama_TV.svg.png",
  },
  super_hungama: {
    id: "super_hungama",
    name: "Super Hungama",
    shortName: "SH",
    color: "#FF9800",
    region: "India",
    website: "https://www.hungama.com",
    dthNumbers: "Tata Play 656",
    type: "tv",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Hungama_TV.svg/250px-Hungama_TV.svg.png",
  },
  pogo: {
    id: "pogo",
    name: "Pogo",
    shortName: "PO",
    color: "#2196F3",
    region: "India",
    website: "https://www.pogotv.in",
    dthNumbers: "Tata Play 660, Airtel 664",
    type: "tv",
    logoPlate: "dark",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/POGO-logo.svg/250px-POGO-logo.svg.png",
  },
  nick: {
    id: "nick",
    name: "Nickelodeon",
    shortName: "NK",
    color: "#FF5722",
    region: "India",
    website: "https://www.nickindia.com",
    dthNumbers: "Tata Play 662, Airtel 661",
    type: "tv",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Nickelodeon_2023_logo_%28outline%29.svg/250px-Nickelodeon_2023_logo_%28outline%29.svg.png",
  },
  nick_jr: {
    id: "nick_jr",
    name: "Nick Jr.",
    shortName: "NJ",
    color: "#FF9800",
    region: "India",
    website: "https://www.nickindia.com",
    dthNumbers: "Tata Play 661, Airtel 662",
    type: "tv",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Nick_Jr._logo_2023_%28horizontal%29.svg/250px-Nick_Jr._logo_2023_%28horizontal%29.svg.png",
  },
  sonic: {
    id: "sonic",
    name: "Nickelodeon Sonic",
    shortName: "SN",
    color: "#E91E63",
    region: "India",
    website: "https://www.nickindia.com",
    dthNumbers: "Tata Play 663, Airtel 663",
    type: "tv",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Sonic-india-channel.png/250px-Sonic-india-channel.png",
  },
  disney_channel: {
    id: "disney_channel",
    name: "Disney Channel",
    shortName: "DC",
    color: "#1A73E8",
    region: "India",
    website: "https://www.hotstar.com",
    dthNumbers: "Tata Play 650, Airtel 650",
    type: "tv",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/2019_Disney_Channel_logo.svg/250px-2019_Disney_Channel_logo.svg.png",
  },
  disney_junior: {
    id: "disney_junior",
    name: "Disney Junior",
    shortName: "DJ",
    color: "#4CAF50",
    region: "India",
    website: "https://www.hotstar.com",
    dthNumbers: "Tata Play 651, Airtel 651",
    type: "tv",
    logoPlate: "dark",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/2019_Disney_Junior_logo.svg/250px-2019_Disney_Junior_logo.svg.png",
  },
  epic_kids: {
    id: "epic_kids",
    name: "EPIC Kids",
    shortName: "EPK",
    color: "#9C27B0",
    region: "India",
    website: "https://www.epicon.in",
    dthNumbers: "Tata Play 652",
    type: "tv",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Epic_TV_channel.jpg/250px-Epic_TV_channel.jpg",
  },
  animax: {
    id: "animax",
    name: "Animax",
    shortName: "AMX",
    color: "#F44336",
    region: "India",
    website: "https://www.sonyliv.com",
    dthNumbers: "Tata Play 665, Airtel 660",
    type: "tv",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Animax_Logo.svg/250px-Animax_Logo.svg.png",
  },
  discovery_kids: {
    id: "discovery_kids",
    name: "Discovery Kids",
    shortName: "DK",
    color: "#00BCD4",
    region: "India",
    website: "https://www.discoverykids.in",
    dthNumbers: "Tata Play 664",
    type: "tv",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Discovery_Kids_2021_2D_sin_wordmark.svg/250px-Discovery_Kids_2021_2D_sin_wordmark.svg.png",
  },
  sony_liv: {
    id: "sony_liv",
    name: "Sony LIV",
    shortName: "SLV",
    color: "#6C28D2",
    region: "India",
    website: "https://www.sonyliv.com",
    type: "youtube",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f7/SonyLIV_2020.png",
  },
  jio_hotstar: {
    id: "jio_hotstar",
    name: "JioHotstar",
    shortName: "JHS",
    color: "#005FA8",
    region: "India",
    website: "https://www.hotstar.com",
    type: "youtube",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Disney%2B_Hotstar_2024.svg/250px-Disney%2B_Hotstar_2024.svg.png",
  },
  muse_asia: {
    id: "muse_asia",
    name: "Muse Asia",
    shortName: "MA",
    color: "#FF0000",
    region: "Asia",
    website: "https://www.youtube.com/@MuseAsia",
    type: "youtube",
    subscriberCount: "8.67M",
    logoPlate: "dark",
    logoUrl: "https://yt3.googleusercontent.com/g0wRRtSUd80WQcCUib0DWVK8CgUcjn_djL9Pg1sC875q9Hjf4CqTK3dvaLW3GBaAPtAXIUa6=s900-c-k-c0x00ffffff-no-rj",
  },
  muse_india: {
    id: "muse_india",
    name: "Muse India",
    shortName: "MI",
    color: "#E91E63",
    region: "India",
    website: "https://www.youtube.com/@MuseIndia",
    type: "youtube",
    subscriberCount: "1.2M",
    logoPlate: "dark",
    logoUrl: "https://yt3.googleusercontent.com/EhiAEsA972_jooWrHY8oLLDS1C9L84-YVNyKclXsNSKB2tYnUqqqi_O10JkcPd64EnaburVG=s900-c-k-c0x00ffffff-no-rj",
  },
  crunchyroll: {
    id: "crunchyroll",
    name: "Crunchyroll",
    shortName: "CR",
    color: "#F47521",
    region: "India",
    website: "https://www.crunchyroll.com",
    type: "youtube",
    subscriberCount: "15M+",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Crunchyroll_logo_2024.png/250px-Crunchyroll_logo_2024.png",
  },
  netflix_anime: {
    id: "netflix_anime",
    name: "Netflix Anime",
    shortName: "NX",
    color: "#E50914",
    region: "India",
    website: "https://www.netflix.com",
    type: "youtube",
    subscriberCount: "280M+ subs",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/250px-Netflix_2015_logo.svg.png",
  },
  prime_video: {
    id: "prime_video",
    name: "Prime Video Anime",
    shortName: "PV",
    color: "#00A8E1",
    region: "India",
    website: "https://www.primevideo.com",
    type: "youtube",
    subscriberCount: "200M+ subs",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Amazon_Prime_Video_example_screenshot.png/250px-Amazon_Prime_Video_example_screenshot.png",
  },
};

/**
 * Local, pre-trimmed copies of every channel logo live in
 * `public/channel-logos/<id>.png`. They are generated once from the upstream
 * files and committed, so the phone never has to reach Wikimedia (which answers
 * app traffic with 429 and used to leave 16 of 20 tiles blank).
 *
 * `logoPlate` is measured from the opaque pixels of the processed file:
 * a dark wordmark needs a light plate and vice versa.
 */
const LOGO_PLATES: Record<string, "light" | "dark"> = {
  animax: "light",
  cn: "dark",
  crunchyroll: "light",
  discovery_kids: "light",
  disney_channel: "light",
  disney_junior: "light",
  epic_kids: "dark",
  hungama: "light",
  jio_hotstar: "light",
  muse_asia: "light",
  muse_india: "light",
  netflix_anime: "light",
  nick: "light",
  nick_jr: "light",
  pogo: "light",
  prime_video: "dark",
  sonic: "light",
  sony_liv: "dark",
  sony_yay: "dark",
  super_hungama: "light",
};

export const TV_CHANNELS: Record<string, TvChannel> = Object.fromEntries(
  Object.entries(RAW_TV_CHANNELS).map(([id, channel]) => [
    id,
    {
      ...channel,
      logoProxyUrl: `/channel-logos/${id}.png`,
      logoPlate: LOGO_PLATES[id] ?? channel.logoPlate ?? "light",
    },
  ]),
);

/**
 * Upstream logo files, keyed by channel id. Only the logo proxy route reads
 * this; every UI should use `logoProxyUrl` instead so the phone never talks to
 * the rate-limited origin directly.
 */
export const TV_CHANNEL_LOGO_SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(RAW_TV_CHANNELS)
    .filter(([, channel]) => !!channel.logoUrl)
    .map(([id, channel]) => [id, channel.logoUrl as string]),
);

// ────────────────────────────────────────────────────────────────────────
// No hardcoded lineups are kept here.
//
// • Streaming platforms (Muse Asia/India, Crunchyroll, Netflix, Prime Video,
//   JioHotstar, SonyLIV) are populated live from AniList airing data merged at
//   request time — see src/lib/streaming-live.ts and
//   src/app/api/tv-schedule/live/route.ts. The empty entries below only exist
//   so the live merge has a target channel.
// • Linear-TV channels (Cartoon Network, Pogo, Nickelodeon, Animax, …) are
//   populated live from epg.pw — see src/lib/epg-scraper.ts.
//
// Removed: previously hardcoded/guessed weekly grids for Animax, Muse Asia,
// Muse India, Crunchyroll, Netflix, Prime Video and Sonic.
// ────────────────────────────────────────────────────────────────────────

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const CHANNEL_SCHEDULES: ChannelSchedule[] = [
  {
    channelId: "muse_asia",
    schedules: ALL_DAYS.map((d) => ({ day: d, slots: [] as TimeSlot[] })),
  },
  {
    channelId: "muse_india",
    schedules: ALL_DAYS.map((d) => ({ day: d, slots: [] as TimeSlot[] })),
  },
  {
    channelId: "crunchyroll",
    schedules: ALL_DAYS.map((d) => ({ day: d, slots: [] as TimeSlot[] })),
  },
  {
    channelId: "netflix_anime",
    schedules: ALL_DAYS.map((d) => ({ day: d, slots: [] as TimeSlot[] })),
  },
  {
    channelId: "prime_video",
    schedules: ALL_DAYS.map((d) => ({ day: d, slots: [] as TimeSlot[] })),
  },
  {
    channelId: "jio_hotstar",
    schedules: ALL_DAYS.map((d) => ({ day: d, slots: [] as TimeSlot[] })),
  },
  {
    channelId: "sony_liv",
    schedules: ALL_DAYS.map((d) => ({ day: d, slots: [] as TimeSlot[] })),
  },
];


export function getScheduleForChannel(channelId: string, day?: string): DaySchedule | undefined {
  const channelSchedule = CHANNEL_SCHEDULES.find((cs) => cs.channelId === channelId);
  if (!channelSchedule) return undefined;
  const dayName = day || getDayName();
  return channelSchedule.schedules.find((s) => s.day === dayName);
}

export function getTodaySchedule(): { channel: TvChannel; slots: TimeSlot[] }[] {
  const today = getDayName();
  return CHANNEL_SCHEDULES.map((cs) => {
    const channel = TV_CHANNELS[cs.channelId];
    const schedule = cs.schedules.find((s) => s.day === today);
    return { channel, slots: schedule?.slots || [] };
  }).filter((item) => item.slots.length > 0);
}

export function getNowPlaying(): { channel: TvChannel; slot: TimeSlot }[] {
  const ist = istDate();
  const currentMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const today = getDayName();

  return CHANNEL_SCHEDULES.map((cs) => {
    const channel = TV_CHANNELS[cs.channelId];
    if (!channel) return null;

    const isStreaming = channel.type === "youtube";
    if (isStreaming) return null;

    const schedule = cs.schedules.find((s) => s.day === today);
    if (!schedule) return null;

    const currentSlot = schedule.slots.find((slot) => {
      const [startH, startM] = slot.start.split(":").map(Number);
      const [endH, endM] = slot.end.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    });

    if (!currentSlot) return null;
    return { channel, slot: currentSlot };
  }).filter((item): item is { channel: TvChannel; slot: TimeSlot } => item !== null);
}

/** Every published slot in this app is IST, so "today" must be IST too. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function istDate(date?: Date): Date {
  return new Date((date || new Date()).getTime() + IST_OFFSET_MS);
}

export function getDayName(date?: Date): string {
  return DAY_NAMES[istDate(date).getUTCDay()];
}

export function getNext7Days(): string[] {
  const today = istDate().getUTCDay();
  // Today + the next six days. This used to walk backwards, so the schedule
  // page opened on a week that was already over.
  return Array.from({ length: 7 }, (_, i) => DAY_NAMES[(today + i) % 7]);
}

export function findAnimeSchedule(title: string): { channelId: string; slots: TimeSlot[] }[] {
  if (!title) return [];
  const normalized = title.toLowerCase().trim();
  const results: { channelId: string; slots: TimeSlot[] }[] = [];

  for (const cs of CHANNEL_SCHEDULES) {
    const channel = TV_CHANNELS[cs.channelId];
    if (channel?.type === "youtube") continue;
    const todaySchedule = cs.schedules.find((s) => s.day === getDayName());
    if (!todaySchedule) continue;

    const matchingSlots = todaySchedule.slots.filter((slot) => {
      const slotLower = slot.show.toLowerCase();
      return slotLower.includes(normalized) || normalized.includes(slotLower);
    });

    if (matchingSlots.length > 0) {
      results.push({ channelId: cs.channelId, slots: matchingSlots });
    }
  }

  return results;
}
