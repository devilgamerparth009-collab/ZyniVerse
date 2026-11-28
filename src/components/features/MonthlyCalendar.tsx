"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { bestTitle, type AiringScheduleEntry } from "@/lib/anilist";
import { fetchJson } from "@/lib/safe-json";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STACK_SIZE = 3;
const SPOTLIGHT_SIZE = 12;

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

function formatTime(airingAt: number) {
  return timeFormatter.format(new Date(airingAt * 1000));
}

function coverOf(entry: AiringScheduleEntry) {
  return entry.media.coverImage?.large ?? "";
}

function accentOf(entry: AiringScheduleEntry) {
  return entry.media.coverImage?.color ?? "#29f2e0";
}

function vars(values: Record<string, string | number>) {
  return values as CSSProperties;
}

function buildDayMap(
  schedule: AiringScheduleEntry[],
  year: number,
  month: number,
  daysInMonth: number,
) {
  const map = new Map<number, AiringScheduleEntry[]>();
  for (let day = 1; day <= daysInMonth; day += 1) map.set(day, []);

  const seen = new Set<string>();
  for (const entry of schedule) {
    const airDate = new Date(entry.airingAt * 1000);
    if (airDate.getFullYear() !== year || airDate.getMonth() !== month) continue;
    const key = `${airDate.getDate()}-${entry.media.id}-${entry.episode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    map.get(airDate.getDate())?.push(entry);
  }
  for (const list of map.values()) list.sort((a, b) => a.airingAt - b.airingAt);
  return map;
}

export default function MonthlyCalendar() {
  const [date, setDate] = useState(new Date());
  const [schedule, setSchedule] = useState<AiringScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());

  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();
  const activeDay = selectedDay >= 1 && selectedDay <= daysInMonth ? selectedDay : 1;

  useEffect(() => {
    let cancelled = false;
    const from = Math.floor(new Date(year, month, 1).getTime() / 1000);
    const to = Math.floor(new Date(year, month + 1, 0, 23, 59, 59).getTime() / 1000);

    fetchJson<AiringScheduleEntry[]>(`/api/anilist/airing-schedule?from=${from}&to=${to}`)
      .then((rows) => {
        if (cancelled) return;
        setSchedule(Array.isArray(rows) ? rows : []);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load the airing schedule.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [year, month, reloadKey]);

  const byDay = buildDayMap(schedule, year, month, daysInMonth);
  let totalAirings = 0;
  let maxCount = 1;
  for (const list of byDay.values()) {
    totalAirings += list.length;
    if (list.length > maxCount) maxCount = list.length;
  }
  const activeEntries = byDay.get(activeDay) ?? [];

  const goToMonth = (delta: number) => {
    const target = new Date(year, month + delta, 1);
    setLoading(true);
    setDate(target);
    setSelectedDay(
      target.getFullYear() === today.getFullYear() && target.getMonth() === today.getMonth()
        ? today.getDate()
        : 1,
    );
  };

  const jumpToToday = () => {
    const now = new Date();
    setLoading(true);
    setDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now.getDate());
  };

  const retry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  };

  if (loading) {
    return (
      <div className="mcal-shell" aria-busy="true">
        <header className="mcal-head">
          <div className="mcal-head-copy">
            <p className="mcal-eyebrow"><span className="mcal-signal" /> Airing calendar · AniList</p>
            <div className="mcal-skeleton-title" />
            <div className="mcal-skeleton-sub" />
          </div>
        </header>
        <div className="mcal-weekdays" aria-hidden="true">
          {DAYS.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="mcal-grid">
          {Array.from({ length: 35 }).map((_, index) => (
            <div key={index} className="mcal-day mcal-day--skeleton" style={vars({ "--mcal-i": index })}>
              <span className="mcal-skeleton-num" />
              <span className="mcal-stack">
                <span className="mcal-poster mcal-skeleton-poster" />
                <span className="mcal-poster mcal-skeleton-poster" />
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mcal-shell mcal-shell--error">
        <div className="mcal-error-card">
          <span className="mcal-error-mark" aria-hidden="true">!</span>
          <div className="mcal-error-copy">
            <h3>{MONTHS[month]} {year}</h3>
            <p>{error}</p>
            <span>This is a loading problem, not an empty month.</span>
          </div>
          <button type="button" onClick={retry} className="mcal-retry">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mcal-shell">
      <span className="mcal-aurora" aria-hidden="true" />

      <header className="mcal-head">
        <div className="mcal-head-copy">
          <p className="mcal-eyebrow"><span className="mcal-signal" /> Airing calendar · AniList</p>
          <h3 className="mcal-title">{MONTHS[month]} <span>{year}</span></h3>
          <p className="mcal-sub">
            <strong>{totalAirings}</strong> episodes this month
            <span className="mcal-sep" aria-hidden="true" />
            Tap a date to preview its posters
          </p>
        </div>

        <div className="mcal-actions">
          <Link href="/schedule" className="mcal-full">
            Full Calendar <span aria-hidden="true">→</span>
          </Link>
          <div className="mcal-nav" role="group" aria-label="Month navigation">
            <button type="button" className="mcal-nav-btn" onClick={() => goToMonth(-1)} aria-label="Previous month">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              className={`mcal-today${isCurrentMonth ? " is-current" : ""}`}
              onClick={jumpToToday}
            >
              Today
            </button>
            <button type="button" className="mcal-nav-btn" onClick={() => goToMonth(1)} aria-label="Next month">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="mcal-weekdays" aria-hidden="true">
        {DAYS.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="mcal-grid" role="group" aria-label={`${MONTHS[month]} ${year} airing schedule`}>
        {Array.from({ length: firstDay }).map((_, index) => (
          <span key={`blank-${index}`} className="mcal-blank" aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day, index) => {
          const entries = byDay.get(day) ?? [];
          const stack = entries.slice(0, STACK_SIZE);
          const dayIsToday =
            day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const isPast =
            new Date(year, month, day) <
            new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const isSelected = day === activeDay;
          const fill = Math.round((entries.length / maxCount) * 100);
          const accent = stack[0] ? accentOf(stack[0]) : "#29f2e0";

          return (
            <button
              key={day}
              type="button"
              className={[
                "mcal-day",
                entries.length ? "has-airings" : "",
                dayIsToday ? "is-today" : "",
                isPast ? "is-past" : "",
                isSelected ? "is-selected" : "",
              ].filter(Boolean).join(" ")}
              style={vars({
                "--mcal-i": index,
                "--mcal-accent": accent,
                "--mcal-fill": `${fill}%`,
              })}
              onClick={() => setSelectedDay(day)}
              aria-pressed={isSelected}
              aria-label={`${MONTHS[month]} ${day}, ${year}: ${entries.length} ${entries.length === 1 ? "episode" : "episodes"}`}
            >
              <span className="mcal-day-top">
                <span className="mcal-day-num">{day}</span>
                {entries.length > 0 && <span className="mcal-count">{entries.length}</span>}
              </span>

              {dayIsToday && <span className="mcal-today-flag">TODAY</span>}

              <span className="mcal-stack" aria-hidden="true">
                {stack.length > 0 ? (
                  stack.map((entry, posterIndex) => {
                    const cover = coverOf(entry);
                    return (
                      <span
                        key={entry.id}
                        className="mcal-poster"
                        style={vars({
                          "--mcal-i": posterIndex,
                          "--mcal-accent": accentOf(entry),
                        })}
                      >
                        {cover ? (
                          <Image
                            src={cover}
                            alt=""
                            fill
                            sizes="(max-width: 520px) 22px, 34px"
                            className="mcal-poster-img"
                          />
                        ) : (
                          <span className="mcal-poster-fallback">E{entry.episode}</span>
                        )}
                        {posterIndex === 0 && <span className="mcal-ep">E{entry.episode}</span>}
                      </span>
                    );
                  })
                ) : (
                  <span className="mcal-quiet" aria-hidden="true" />
                )}
              </span>

              <span className="mcal-meter" aria-hidden="true"><span /></span>
            </button>
          );
        })}
      </div>

      <section className="mcal-spotlight" aria-live="polite">
        <div className="mcal-spotlight-head">
          <div>
            <p className="mcal-spotlight-kicker">Selected day</p>
            <h4>{MONTHS[month]} {activeDay}, {year}</h4>
            <p className="mcal-spotlight-meta">
              {activeEntries.length} {activeEntries.length === 1 ? "episode" : "episodes"}
              <span className="mcal-sep" aria-hidden="true" />
              local time
            </p>
          </div>
          <span className="mcal-spotlight-badge">{activeEntries.length}</span>
        </div>

        {activeEntries.length > 0 ? (
          <>
            <div className="mcal-rail">
              {activeEntries.slice(0, SPOTLIGHT_SIZE).map((entry, index) => {
                const cover = coverOf(entry);
                return (
                  <Link
                    key={entry.id}
                    href={`/anime/${entry.media.id}`}
                    className="mcal-card"
                    style={vars({
                      "--mcal-i": index,
                      "--mcal-accent": accentOf(entry),
                    })}
                  >
                    <span className="mcal-card-poster">
                      {cover ? (
                        <Image
                          src={cover}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 72px, 92px"
                          className="mcal-card-img"
                        />
                      ) : (
                        <span className="mcal-card-fallback">
                          {bestTitle(entry.media.title).slice(0, 1)}
                        </span>
                      )}
                      <span className="mcal-card-ep">E{entry.episode}</span>
                    </span>
                    <span className="mcal-card-copy">
                      <span className="mcal-card-time">{formatTime(entry.airingAt)}</span>
                      <span className="mcal-card-title">{bestTitle(entry.media.title)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
            {activeEntries.length > SPOTLIGHT_SIZE && (
              <p className="mcal-more">
                +{activeEntries.length - SPOTLIGHT_SIZE} more airings this day
              </p>
            )}
          </>
        ) : (
          <div className="mcal-empty">
            <span className="mcal-empty-orbit" aria-hidden="true" />
            <p>No episodes scheduled for this day.</p>
          </div>
        )}

        <Link href="/schedule" className="mcal-rail-link">
          Open full schedule <span aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  );
}
