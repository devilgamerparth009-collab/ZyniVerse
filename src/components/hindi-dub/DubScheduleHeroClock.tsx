"use client";

import { useDubScheduleNow } from "./DubScheduleTicker";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Decorative-but-useful IST clock for the schedule hero. It reuses the shared
 * page ticker, so the whole page still runs on a single interval.
 */
export function DubScheduleHeroClock() {
  const now = useDubScheduleNow();
  const ist = now === null ? null : new Date(now + IST_OFFSET_MS);
  const time = ist
    ? `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`
    : "--:--";
  const dateLabel = ist
    ? `${String(ist.getUTCDate()).padStart(2, "0")} ${MONTHS[ist.getUTCMonth()]}`
    : "-- ---";
  const activeDay = ist ? (ist.getUTCDay() + 6) % 7 : -1;

  return (
    <div className="dub-hero-clock relative overflow-hidden rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <div className="dub-hero-clock-glow pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="dub-eyebrow">Live · India</p>
          <p className="mt-1 text-xs text-[var(--color-mute)]">All slots shown in IST</p>
        </div>
        <span className="dub-hero-clock-pulse" aria-hidden="true">
          <span className="dub-live-dot" />
        </span>
      </div>

      <div className="relative mt-4 flex justify-center">
        <div className="dub-hero-clock-dial" aria-hidden="true">
          <span className="dub-hero-clock-ring dub-hero-clock-ring--outer" />
          <span className="dub-hero-clock-ring dub-hero-clock-ring--inner" />
          <span className="dub-hero-clock-core">
            <span className="dub-hero-clock-time">{time}</span>
            <span className="dub-hero-clock-zone">IST</span>
          </span>
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-mute)]">
        <span>{dateLabel}</span>
        <span>India</span>
      </div>

      <div className="dub-hero-clock-days relative mt-3 grid grid-cols-7 gap-1" aria-hidden="true">
        {DAYS.map((label, index) => (
          <span key={label} data-active={index === activeDay ? "true" : undefined}>
            {label.slice(0, 1)}
          </span>
        ))}
      </div>
    </div>
  );
}
