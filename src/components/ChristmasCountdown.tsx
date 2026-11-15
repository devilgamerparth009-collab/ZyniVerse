"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const CHRISTMAS_DAY = 25;

function nextChristmas(now: Date): Date {
  const year = now.getMonth() === 11 && now.getDate() > CHRISTMAS_DAY ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(year, 11, CHRISTMAS_DAY, 0, 0, 0, 0);
}

function isChristmasWindow(date: Date): boolean {
  return date.getMonth() === 11 && date.getDate() >= 1 && date.getDate() <= CHRISTMAS_DAY;
}

function breakdown(target: Date, now: Date) {
  const diff = Math.max(0, target.getTime() - now.getTime());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
  };
}

/**
 * Seasonal countdown card for the Christmas window (1–25 December).
 * Renders nothing for the other eleven months, so the normal homepage hero is
 * completely untouched.
 */
export default function ChristmasCountdown() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const active = isChristmasWindow(now);
  const left = useMemo(() => breakdown(nextChristmas(now), now), [now]);

  if (!mounted || !active) return null;

  const isToday = now.getMonth() === 11 && now.getDate() === CHRISTMAS_DAY;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
      <Link
        href="/schedule"
        className="group flex flex-col gap-3 overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-r from-sky-500/10 via-[var(--color-panel)] to-fuchsia-500/10 p-4 transition-colors hover:border-sky-300/60 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            {isToday ? "🎁" : "🎄"}
          </span>
          <div>
            <p className="font-display text-sm font-bold text-sky-100">
              {isToday ? "Merry Christmas, ZyniVerse!" : "ZyniVerse Christmas"}
            </p>
            <p className="text-xs text-sky-200/70">
              {isToday
                ? "Snowfall, icy accents and this week's winter specials."
                : `Snowfall, icy accents & specials · ${left.days}d ${left.hours}h ${left.minutes}m left`}
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-sky-300/60 px-3 py-1 text-[11px] font-bold text-sky-200 transition-colors group-hover:bg-sky-300/10">
          {isToday ? "Open specials" : "See what's airing"}
        </span>
      </Link>
    </div>
  );
}
