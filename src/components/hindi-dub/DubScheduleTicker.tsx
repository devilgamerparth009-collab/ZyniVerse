"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  formatDubCountdown,
  nextDubScheduleAt,
  splitDubDuration,
  type DubScheduleSlot,
} from "@/lib/dub-schedule-time";

/**
 * One external clock for the whole page. Rows subscribe with
 * `useSyncExternalStore` instead of creating their own interval, and the
 * server snapshot is always null — so the first paint is identical on the
 * server and during hydration, then the shared tick starts immediately.
 */
const listeners = new Set<() => void>();
let snapshot: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

function startClock() {
  snapshot = Date.now();
  intervalId = setInterval(() => {
    snapshot = Date.now();
    for (const listener of listeners) listener();
  }, 1000);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (intervalId === null) startClock();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return null;
}

/** Kept as a thin wrapper so every dub schedule surface can opt in explicitly. */
export function DubScheduleTickerProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useDubScheduleNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useDubScheduleTarget(slot: DubScheduleSlot) {
  const now = useDubScheduleNow();
  const target = useMemo(
    () => (now === null ? null : nextDubScheduleAt(slot, now)),
    [now, slot]
  );
  return { now, target };
}

export function DubCountdownChip({
  slot,
  className = "",
}: {
  slot: DubScheduleSlot;
  className?: string;
}) {
  const { now, target } = useDubScheduleTarget(slot);
  const label = now === null ? "--" : target === null ? "TBA" : formatDubCountdown(target, now);
  const urgent = target !== null && now !== null && target - now < 10 * 60 * 1000;
  const tone = target === null
    ? "border-[var(--color-line)] bg-white/5 text-[var(--color-mute)]"
    : urgent
      ? "border-[var(--color-amber)]/40 bg-[var(--color-amber)]/10 text-[var(--color-amber)]"
      : "border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums transition-colors ${tone} ${className}`}
    >
      {target !== null && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            urgent ? "animate-pulse bg-[var(--color-amber)]" : "bg-[var(--color-cyan)]"
          }`}
        />
      )}
      {label}
    </span>
  );
}

export function DubCountdownCells({ slot }: { slot: DubScheduleSlot }) {
  const { now, target } = useDubScheduleTarget(slot);
  const parts = now !== null && target !== null ? splitDubDuration(target, now) : null;
  const cells = [
    { label: "Days", value: parts?.days },
    { label: "Hours", value: parts?.hours },
    { label: "Mins", value: parts?.minutes },
    { label: "Secs", value: parts?.seconds },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="dub-timer-cell relative overflow-hidden rounded-xl border border-[var(--color-line)] bg-black/35 px-1 py-2.5 text-center sm:py-3"
        >
          <p className="font-mono text-xl font-bold tabular-nums text-[var(--color-ink)] sm:text-3xl">
            {cell.value === undefined ? "--" : String(cell.value).padStart(2, "0")}
          </p>
          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-mute)] sm:text-[10px]">
            {cell.label}
          </p>
        </div>
      ))}
    </div>
  );
}
