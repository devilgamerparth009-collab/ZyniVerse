"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Loader from "@/components/Loader";
import CalendarSyncButtons from "@/components/CalendarSyncButtons";
import { fetchJson } from "@/lib/safe-json";
import type { AiringScheduleEntry } from "@/lib/anilist";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarItem {
  mediaId?: number;
  title?: string;
  episode?: number;
}

type ScheduleEntry = AiringScheduleEntry & { mediaId?: number };

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let i = 1; i <= last.getDate(); i++) days.push(i);
  return days;
}

export default function FullCalendar() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [schedule, setSchedule] = useState<Record<string, CalendarItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    const startSec = Math.floor(new Date(year, month, 1).getTime() / 1000);
    const endSec = Math.floor(new Date(year, month + 1, 0, 23, 59, 59).getTime() / 1000);

    fetchJson<AiringScheduleEntry[]>(`/api/anilist/airing-schedule?from=${startSec}&to=${endSec}`)
      .then((items) => {
        if (cancelled) return;
        const grouped: Record<string, CalendarItem[]> = {};
        (items || []).forEach((item) => {
          const entry = item as ScheduleEntry;
          const d = entry.airingAt ? new Date(entry.airingAt * 1000).toISOString().slice(0, 10) : "";
          if (!d) return;
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push({
            mediaId: entry.media?.id || entry.mediaId,
            title: entry.media?.title?.romaji || entry.media?.title?.english || `Anime #${entry.media?.id}`,
            episode: entry.episode,
          });
        });
        setSchedule(grouped);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the calendar.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [year, month, retryKey]);

  const days = useMemo(() => getMonthDays(year, month), [year, month]);

  function prev() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function next() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }
  function retry() { setRetryKey((k) => k + 1); }

  return (
    <PageTransition>
      <ErrorBoundary label="Calendar">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-cyan)]">Calendar</p>
              <div className="inline-block rounded-xl neon-rgb-border px-4 py-2">
                <h1 className="font-display mt-1 text-3xl font-bold">Anime Release Calendar</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CalendarSyncButtons />
              <button onClick={prev} className="rounded-lg px-5 py-2.5 text-xs transition-colors hover:border-[var(--color-cyan)]" aria-label="Previous month">←</button>
              <span className="font-display min-w-[140px] text-center text-sm font-bold">{MONTHS[month]} {year}</span>
              <button onClick={next} className="rounded-lg px-5 py-2.5 text-xs transition-colors hover:border-[var(--color-cyan)]" aria-label="Next month">→</button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-sm text-red-400">Couldn&apos;t load the calendar: {error}</p>
              <p className="mt-1 text-xs text-[var(--color-mute)]">This is a loading problem, not an empty month.</p>
              <button
                onClick={retry}
                className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20"
              >
                Try again
              </button>
            </div>
          )}

          {loading ? <Loader /> : !error && (
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-[var(--color-line)]">
              {DAYS.map((d) => (
                <div key={d} className="bg-[var(--color-panel)] px-2 py-2 text-center text-[10px] font-mono font-bold uppercase text-[var(--color-mute)]">{d}</div>
              ))}
              {days.map((d, i) => {
                const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d || 0).padStart(2, "0")}`;
                const items = d ? (schedule[key] || []) : [];
                const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
                return (
                  <div key={i} className={`min-h-[100px] bg-[var(--color-void)] p-1.5 ${isToday ? "ring-1 ring-inset ring-[var(--color-cyan)]" : ""}`}>
                    {d && (
                      <>
                        <span className={`text-[10px] font-mono font-bold ${isToday ? "text-[var(--color-cyan)]" : "text-[var(--color-mute)]"}`}>{d}</span>
                        <div className="mt-1 space-y-0.5">
                          {items.slice(0, 3).map((item, idx: number) => (
                            <Link
                              key={idx}
                              href={`/anime/${item.mediaId}`}
                              className="block truncate rounded bg-[var(--color-magenta)]/10 px-1 py-0.5 text-[8px] leading-tight text-[var(--color-magenta)] transition-colors hover:bg-[var(--color-magenta)]/20"
                            >
                              {item.title || `Anime #${item.mediaId}`}
                            </Link>
                          ))}
                          {items.length > 3 && (
                            <span className="block px-1 text-[8px] text-[var(--color-mute)]">+{items.length - 3} more</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ErrorBoundary>
    </PageTransition>
  );
}
