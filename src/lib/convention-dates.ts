// Convention dates are stored as date-only values. Parsing "YYYY-MM-DD" with
// `new Date(value)` treats it as UTC midnight, which shifts the calendar day
// in negative offsets (and moves the end of an event earlier in every
// timezone). These helpers keep the event's published calendar day intact.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/** Read the published calendar date without applying a timezone offset. */
export function getDateParts(value: string | Date): DateParts {
  if (value instanceof Date) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  const match = DATE_ONLY.exec(value);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { year: 1970, month: 1, day: 1 };
  }
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

export function toDateKey(value: string | Date): string {
  const { year, month, day } = getDateParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Create a local-midnight Date so toLocaleDateString shows the right day. */
export function parseDateOnly(value: string | Date): Date {
  const { year, month, day } = getDateParts(value);
  return new Date(year, month - 1, day);
}

export function getMonthKey(value: string | Date): string {
  const { year, month } = getDateParts(value);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** UTC-based day arithmetic; safe across daylight-saving changes. */
export function addDaysToDateOnly(value: string | Date, days: number): string {
  const { year, month, day } = getDateParts(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Today's date as organiser timezone (India), not the visitor's timezone. */
export function getIndiaDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** Whole calendar days from today (India) to the event start date. */
export function daysUntilDate(value: string | Date, now: Date = new Date()): number {
  const target = getDateParts(value);
  const [year, month, day] = getIndiaDateKey(now).split("-").map(Number);
  const todayUTC = Date.UTC(year, month - 1, day);
  const targetUTC = Date.UTC(target.year, target.month - 1, target.day);
  return Math.round((targetUTC - todayUTC) / 86_400_000);
}

export function formatShortDateRange(start: string | Date, end: string | Date): string {
  const s = getDateParts(start);
  const e = getDateParts(end);
  const startLabel = `${s.day} ${SHORT_MONTHS[s.month - 1]}`;
  const endLabel = `${e.day} ${SHORT_MONTHS[e.month - 1]}, ${e.year}`;

  if (toDateKey(start) === toDateKey(end)) {
    return `${startLabel}, ${s.year}`;
  }
  return `${startLabel} — ${endLabel}`;
}

export function formatDetailDateRange(start: string | Date, end: string | Date): string {
  const s = parseDateOnly(start);
  const e = parseDateOnly(end);
  const startLabel = s.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const endLabel = e.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (toDateKey(start) === toDateKey(end)) {
    return endLabel;
  }
  return `${startLabel} — ${endLabel}`;
}

export function formatLongMonth(month: number): string {
  return LONG_MONTHS[month - 1] ?? "";
}
