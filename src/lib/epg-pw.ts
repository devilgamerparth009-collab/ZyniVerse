import { type TimeSlot } from "./tv-channels";

const EPG_PW_BASE = "https://epg.pw/api/epg.json";

/**
 * epg.pw sits behind a CDN that is quick to throttle bursts, and Vercel's egress
 * IPs are shared by a lot of traffic. Sending browser-ish headers plus keeping
 * the fan-out small (see `mapWithConcurrency`) is what stops every channel from
 * silently coming back empty in production.
 */
const EPG_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://epg.pw/areas/in.html",
  Origin: "https://epg.pw",
};

const EPG_ATTEMPT_TIMEOUT_MS = 8000;
const EPG_MAX_ATTEMPTS = 2;
/** Parallel requests to epg.pw. Above this the CDN starts returning empty bodies. */
const EPG_CONCURRENCY = 4;

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

  for (let attempt = 1; attempt <= EPG_MAX_ATTEMPTS; attempt++) {
    try {
      // `no-store` is deliberate. The old `next: { revalidate: 86400 }` meant a
      // single throttled response (epg.pw answers HTTP 200 with an empty
      // `epg_list`) was cached by Next for 24h, so one bad minute blanked the
      // whole linear grid for a day. Our own 6h Postgres cache is the real
      // cache; failures must never be memoised.
      const res = await fetch(url, {
        cache: "no-store",
        headers: EPG_HEADERS,
        signal: AbortSignal.timeout(EPG_ATTEMPT_TIMEOUT_MS),
      });
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          await sleep(400 * attempt);
          continue;
        }
        return [];
      }
      const data: EpgPwResponse = await res.json();
      if (data.error_message || !data.epg_list?.length) {
        // Empty body is usually a soft throttle, so retry once before giving up.
        if (attempt < EPG_MAX_ATTEMPTS) {
          await sleep(400 * attempt);
          continue;
        }
        return [];
      }
      return data.epg_list;
    } catch {
      if (attempt < EPG_MAX_ATTEMPTS) {
        await sleep(400 * attempt);
        continue;
      }
      return [];
    }
  }
  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs `worker` over `items` with a fixed maximum number in flight. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
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

  // epg.pw answers the "tomorrow" request with the same list as "today" for
  // channels whose feed only carries the current day, so the merged array can
  // contain every programme twice. De-duplicating before computing end times is
  // important: a duplicate at the same timestamp would otherwise make a show
  // end at the exact minute it starts.
  const seenProgramme = new Set<string>();
  const unique = parsed.filter((p) => {
    const key = `${p.raw}|${p.entry.title}`;
    if (seenProgramme.has(key)) return false;
    seenProgramme.add(key);
    return true;
  });

  for (let i = 0; i < unique.length; i++) {
    const current = unique[i];
    const next = unique[i + 1];

    let end: string;
    if (next && next.dayName === current.dayName && next.start !== current.start) {
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

  // Flatten to channel×day jobs so one slow channel cannot stall the rest, and
  // so the request fan-out stays under epg.pw's burst limit.
  const jobs = entries.flatMap(([channelId, epgPwId]) =>
    dates.map((date) => ({ channelId, epgPwId, date }))
  );

  const settled = await mapWithConcurrency(jobs, EPG_CONCURRENCY, (job) =>
    fetchEpgPwDay(job.epgPwId, job.date)
  );

  const byChannel = new Map<string, EpgPwEntry[]>();
  settled.forEach((result, index) => {
    if (result.status !== "fulfilled" || result.value.length === 0) return;
    const channelId = jobs[index].channelId;
    const list = byChannel.get(channelId) ?? [];
    list.push(...result.value);
    byChannel.set(channelId, list);
  });

  const out: { channelId: string; days: Record<string, TimeSlot[]> }[] = [];
  for (const [channelId, allEntries] of byChannel) {
    out.push({ channelId, days: bucketEntries(allEntries) });
  }
  return out;
}

export function getEpgPwChannelIds(): string[] {
  return Object.keys(EPG_PW_MAP);
}
