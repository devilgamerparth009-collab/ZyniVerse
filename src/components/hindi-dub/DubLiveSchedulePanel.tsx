"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { DubScheduleDTO } from "@/lib/dub-import/queries";
import { nextDubScheduleAt } from "@/lib/dub-schedule-time";
import {
  DubCountdownCells,
  DubCountdownChip,
  useDubScheduleNow,
} from "./DubScheduleTicker";

function metaText(row: DubScheduleDTO) {
  return [row.season, row.episodeInfo].filter(Boolean).join(" · ") || "Episode details TBA";
}

function slotText(row: DubScheduleDTO) {
  return [row.dayLabel, row.timeLabel].filter(Boolean).join(" · ") || "Slot TBA";
}

interface DubLiveSchedulePanelProps {
  rows: DubScheduleDTO[];
  limit?: number;
  title?: string;
  eyebrow?: string;
  showFullLink?: boolean;
}

/**
 * Live, self-sorting schedule preview. Server render keeps the synced order;
 * once the shared clock starts, rows are re-ordered by their *next* IST slot so
 * a stale cached timestamp can never push an old episode to the top.
 */
export function DubLiveSchedulePanel({
  rows,
  limit = 6,
  title = "Next on air",
  eyebrow = "Dub hub live",
  showFullLink = true,
}: DubLiveSchedulePanelProps) {
  const now = useDubScheduleNow();

  const ordered = useMemo(() => {
    if (now === null) return rows.slice(0, limit);
    return rows
      .map((row) => ({ row, at: nextDubScheduleAt(row, now) }))
      .filter((entry): entry is { row: DubScheduleDTO; at: number } => entry.at !== null)
      .sort((a, b) => a.at - b.at)
      .slice(0, limit)
      .map((entry) => entry.row);
  }, [rows, now, limit]);

  if (!ordered.length) {
    return (
      <section className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-mute)]">
        No timed airings are available yet. Check back soon for new listings.
      </section>
    );
  }

  const featured = ordered[0];
  const rest = ordered.slice(1);

  return (
    <section className="dub-live-panel relative overflow-hidden rounded-3xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7">
      <div className="dub-aurora pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-[var(--color-violet)]/25 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-cyan)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-cyan)] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-cyan)]" />
            </span>
            {eyebrow}
          </p>
          <h2 className="font-display mt-1.5 text-2xl font-black tracking-tight text-[var(--color-ink)] sm:text-3xl">
            {title}
          </h2>
        </div>
        {showFullLink && (
          <Link
            href="/hindi-dub/schedule"
            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-xs font-semibold text-[var(--color-cyan)] transition hover:border-[var(--color-cyan)]/60 hover:bg-[var(--color-cyan)]/10"
          >
            Full schedule →
          </Link>
        )}
      </div>

      <div className="relative mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="dub-live-feature relative overflow-hidden rounded-2xl border border-[var(--color-violet)]/35 bg-black/25 p-4 sm:p-5">
          <div className="flex gap-4">
            <div className="dub-poster-frame relative h-32 w-24 shrink-0 overflow-hidden rounded-xl border border-[var(--color-line)] bg-black/50 sm:h-40 sm:w-28">
              {featured.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featured.posterUrl}
                  alt={featured.title}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2 text-center text-[11px] text-[var(--color-mute)]">
                  {featured.title}
                </div>
              )}
              <span className="dub-live-badge absolute left-1.5 top-1.5 rounded-full bg-black/75 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-amber)] backdrop-blur">
                Next up
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="dub-live-title font-display line-clamp-2 text-xl font-black leading-tight text-[var(--color-ink)] sm:text-2xl">
                {featured.title}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-xs text-[var(--color-mute)] sm:text-sm">
                {metaText(featured)}
              </p>
              <p className="mt-2 text-xs font-semibold text-[var(--color-amber)]">
                {slotText(featured)} · IST
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {featured.languages.slice(0, 4).map((language) => (
                  <span
                    key={language}
                    className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--color-mute)]"
                  >
                    {language}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <DubCountdownCells slot={featured} />
          </div>

          <Link
            href={`/search?q=${encodeURIComponent(featured.title)}`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-cyan)] transition hover:gap-2"
          >
            View title <span aria-hidden="true">→</span>
          </Link>
        </article>

        {rest.length > 0 && (
          <div className="dub-mini-grid grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {rest.map((row, index) => (
              <Link
                key={row.id}
                href={`/search?q=${encodeURIComponent(row.title)}`}
                className="dub-mini-card group relative flex min-h-[112px] min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-[var(--color-line)] bg-black/25 p-3 sm:min-h-[120px] sm:p-3.5"
              >
                <span className="dub-mini-thumb relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black/50 shadow-lg sm:h-20 sm:w-14">
                  {row.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.posterUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--color-mute)]">
                      {String(index + 2).padStart(2, "0")}
                    </span>
                  )}
                  {row.posterUrl && (
                    <span className="dub-mini-rank absolute left-0 top-0 rounded-br-md bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--color-amber)] backdrop-blur">
                      {String(index + 2).padStart(2, "0")}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className="dub-mini-title block line-clamp-2 text-sm font-bold leading-snug text-[var(--color-ink)] sm:text-[15px]"
                    title={row.title}
                  >
                    {row.title}
                  </span>
                  <span className="dub-mini-meta mt-1 block truncate text-[11px] text-[var(--color-mute)]">
                    {metaText(row)}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="dub-mini-slot text-[11px] font-semibold text-[var(--color-amber)]">
                      {slotText(row)} · IST
                    </span>
                    <DubCountdownChip slot={row} className="dub-mini-chip" />
                  </span>
                </span>

                <span
                  className="dub-mini-arrow absolute right-2 top-2 text-xs text-[var(--color-cyan)] opacity-0"
                  aria-hidden="true"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
