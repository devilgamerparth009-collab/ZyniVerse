import { type TimeSlot } from "./tv-channels";

const EPG_PW_BASE = "https://epg.pw/api/epg.json";

// Our channel IDs -> epg.pw channel IDs.
//
// These were verified against https://epg.pw/areas/in.html on 2026-11-11.
// The previous IDs were off by a wide margin (e.g. `cn` pointed at CNN), so
// every Indian channel came back with an empty `epg_list` while Animax looked
// fine. That single mismatch is what made the TV grid look "wrong/empty".
export const EPG_PW_MAP: Record<string, number> = {
  cn: 577378, // CARTOON NETWORK
  sony_yay: 577245, // Sony yay
  hungama: 577107, // HUNGAMA
  super_hungama: 577130, // SUPER HUNGAMA
  pogo: 577330, // POGO
  nick: 577018, // NICK
  nick_jr: 577431, // NICK JR
  sonic: 577321, // SONIC NICKELODEON
  discovery_kids: 577413, // DISCOVERY KIDS
  disney_channel: 577362, // DISNEY CHANNEL
  disney_junior: 577377, // DISNEY JUNIOR
  animax: 524073, // Animax Asia (English)
};

interface EpgPwEntry {
  title: string;
  desc?: string;
  start_date: string;
}

interface EpgPwResponse {
  epg_list: EpgPwEntry[];
  name?: string;
  country?: string;
  error_message?: string;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function istParts(isoString: string): { hhmm: string; dayName: string } {
  const d = new Date(isoString);
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const hh = ist.getUTCHours().toString().padStart(2, "0");
  const mm = ist.getUTCMinutes().toString().padStart(2, "0");
  return { hhmm: `${hh}:${mm}`, dayName: DAY_NAMES[ist.getUTCDay()] };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}${m}${day}`;
}

async function fetchEpgPwDay(channelId: number, date: Date): Promise<EpgPwEntry[]> {
  const dateStr = formatDate(date);
  const url = `${EPG_PW_BASE}?channel_id=${channelId}&lang=en&date=${dateStr}&timezone=Asia%2FKolkata`;

  try {
    // 24h cache: a daily channel listing only changes once a day. Keeping this
    // high also stops the route from hammering epg.pw on every render.
    const res = await fetch(url, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const data: EpgPwResponse = await res.json();
    if (data.error_message || !data.epg_list) return [];
    return data.epg_list;
  } catch {
    return [];
  }
}

function cleanTitle(title: string): string {
  return title
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function addMinutes(hhmm: string, mins: number): string {
  const total = (minutesOf(hhmm) + mins) % (24 * 60);
  const h = Math.floor(total / 60).toString().padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Turns one channel's raw entries into `DaySchedule` buckets.
 *
 * epg.pw returns entries with a UTC timestamp even when a timezone is passed,
 * so we convert to IST ourselves and bucket by the *IST* weekday. The end time
 * is the next programme's start (and 30 min for the last slot of the day).
 */
function bucketEntries(entries: EpgPwEntry[]): Record<string, TimeSlot[]> {
  const groups: Record<string, TimeSlot[]> = {};
  for (const d of DAY_NAMES) groups[d] = [];

  const parsed = entries
    .map((e) => {
      const { hhmm, dayName } = istParts(e.start_date);
      return { entry: e, start: hhmm, dayName, raw: new Date(e.start_date).getTime() };
    })
    .filter((p) => !Number.isNaN(p.raw))
    .sort((a, b) => a.raw - b.raw);

  for (let i = 0; i < parsed.length; i++) {
    const current = parsed[i];
    const next = parsed[i + 1];

    let end: string;
    if (next && next.dayName === current.dayName) {
      end = next.start;
    } else {
      end = addMinutes(current.start, 30);
    }

    const startMin = minutesOf(current.start);
    const endMin = minutesOf(end);
    const duration = endMin >= startMin ? endMin - startMin : 24 * 60 - startMin + endMin;

    const slot: TimeSlot = {
      show: cleanTitle(current.entry.title),
      start: current.start,
      end,
      duration: duration || 30,
      description: current.entry.desc?.trim() || undefined,
    };

    if (!groups[current.dayName]) groups[current.dayName] = [];
    groups[current.dayName].push(slot);
  }

  // De-duplicate overlapping/identical rows epg.pw sometimes repeats.
  for (const day of Object.keys(groups)) {
    const seen = new Set<string>();
    groups[day] = groups[day].filter((s) => {
      const key = `${s.start}|${s.show}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return groups;
}

/**
 * Fetches the live grid for a slice of channels.
 *
 * `from`/`to` let the cron route cache a few channels per invocation. Each
 * channel fetches today + tomorrow *in parallel*, and all channels run in
 * parallel too, so a full refresh takes ~2-4s instead of the 30-60s the old
 * sequential-batch version needed (which is why the route kept timing out).
 */
export async function fetchAllEpgFromPw(options: { from?: number; to?: number } = {}): Promise<
  { channelId: string; days: Record<string, TimeSlot[]> }[]
> {
  const entries = Object.entries(EPG_PW_MAP).slice(options.from ?? 0, options.to);

  const now = new Date();
  const dates: Date[] = [now, new Date(now.getTime() + 24 * 60 * 60 * 1000)];

  const results = await Promise.allSettled(
    entries.map(async ([channelId, epgPwId]) => {
      const dayResponses = await Promise.allSettled(
        dates.map((date) => fetchEpgPwDay(epgPwId, date))
      );

      const allEntries: EpgPwEntry[] = [];
      for (const r of dayResponses) {
        if (r.status === "fulfilled") allEntries.push(...r.value);
      }

      return { channelId, days: bucketEntries(allEntries) };
    })
  );

  const out: { channelId: string; days: Record<string, TimeSlot[]> }[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") out.push(r.value);
  }
  return out;
}

export function getEpgPwChannelIds(): string[] {
  return Object.keys(EPG_PW_MAP);
}
