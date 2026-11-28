/**
 * Shared schedule-time helpers for the web hub and the APK mirror.
 *
 * A synced ongoing row can have an old `releaseAt` while its weekly IST slot
 * is still valid. Placeholder rows ("Coming Soon / Date Not Announced") only
 * carry weekday/time labels and must NOT get an invented countdown. Keeping
 * the distinction here means the website timer, the schedule page and the APK
 * live feed all agree on what "next" means, without shipping Prisma or any
 * server config to the browser.
 */

export interface DubScheduleSlot {
  releaseAt: string | null;
  dayLabel: string | null;
  timeLabel: string | null;
  episodeInfo?: string | null;
}

export interface DubDurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const WEEKDAYS: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/**
 * Resolve the next airing timestamp (epoch ms) for a schedule row.
 *
 * Prefers a genuinely future `releaseAt` (including dated "Coming Soon"
 * rows). The weekly IST fallback is only applied to numbered ongoing episodes;
 * undated placeholders get null so no timer is invented for them.
 */
export function nextDubScheduleAt(slot: DubScheduleSlot, now: number = Date.now()): number | null {
  const stored = slot.releaseAt ? new Date(slot.releaseAt).getTime() : NaN;
  if (Number.isFinite(stored) && stored > now) return stored;

  const episode = slot.episodeInfo?.trim() ?? "";
  const numberedEpisode = /\bep(?:isode)?\s*\d+/i.test(episode);
  const placeholder = /coming soon|tba|unscheduled|date not announced/i.test(episode);
  if (!numberedEpisode || placeholder) return null;

  const time = slot.timeLabel?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!time || !slot.dayLabel) return null;

  const dayText = slot.dayLabel.trim().toLowerCase();
  const weekday = dayText === "daily" ? null : WEEKDAYS[dayText.slice(0, 3)];
  if (dayText !== "daily" && weekday === undefined) return null;

  const minutes = Number(time[2]);
  if (!Number.isFinite(minutes) || minutes > 59) return null;

  const rawHour = Number(time[1]);
  const meridiem = (time[3] || "").toUpperCase();
  // Some source rows use 24-hour labels ("19:30"); others use 12-hour labels.
  const hours =
    !meridiem && rawHour > 12 ? rawHour : (rawHour % 12) + (meridiem === "PM" ? 12 : 0);

  // Shift "now" into IST and use UTC getters, so the maths is identical on the
  // server, in the browser and on a device set to any other timezone.
  const nowIst = new Date(now + IST_OFFSET_MS);
  const dayDelta = weekday === null ? 0 : (weekday - nowIst.getUTCDay() + 7) % 7;
  let candidate = Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate() + dayDelta,
    hours - 5,
    minutes - 30
  );
  if (candidate <= now) candidate += (weekday === null ? 1 : 7) * 86_400_000;
  return candidate;
}

/** Order rows by their next airing, dropping rows with no usable slot. */
export function sortDubScheduleByNext<T extends DubScheduleSlot>(
  rows: T[],
  now: number = Date.now()
): T[] {
  return rows
    .map((row) => ({ row, at: nextDubScheduleAt(row, now) }))
    .filter((entry): entry is { row: T; at: number } => entry.at !== null)
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.row);
}

export function splitDubDuration(target: number, now: number): DubDurationParts {
  const diff = target - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    done: false,
  };
}

export function formatDubCountdown(target: number, now: number): string {
  const { days, hours, minutes, seconds, done } = splitDubDuration(target, now);
  if (done) return "Airing now";
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
