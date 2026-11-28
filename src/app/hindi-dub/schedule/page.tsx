import type { Metadata } from "next";
import Link from "next/link";
import { getDubLanguages, getDubSchedule, groupScheduleByDay, WEEKDAY_ORDER } from "@/lib/dub-import/queries";
import type { DubScheduleDTO } from "@/lib/dub-import/queries";
import { sortDubScheduleByNext } from "@/lib/dub-schedule-time";
import { DubLiveSchedulePanel } from "@/components/hindi-dub/DubLiveSchedulePanel";
import { DubCountdownChip, DubScheduleTickerProvider } from "@/components/hindi-dub/DubScheduleTicker";
import { DubScheduleHeroClock } from "@/components/hindi-dub/DubScheduleHeroClock";
import { FadeIn, StaggerGrid, StaggerItem } from "@/components/PageTransition";
import NativeBannerAd from "@/components/NativeBannerAd";

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";
const DAY_ACCENTS = [
  "var(--color-cyan)",
  "var(--color-violet)",
  "var(--color-magenta)",
  "var(--color-amber)",
];

export const metadata: Metadata = {
  title: "Hindi Dub Anime Schedule — This Week's Episode Airings (2026)",
  description:
    "Weekly Hindi, Tamil, Telugu and multi-audio anime dub schedule with IST air times, seasons and episode numbers. Check upcoming episodes and live countdowns.",
  keywords: [
    "hindi dub schedule", "hindi dub anime schedule", "anime airing schedule india",
    "hindi dub release date", "tamil dub schedule", "telugu dub schedule",
    "hindi anime this week", "dubbed anime schedule",
  ],
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
    title: "Hindi Dub Anime Schedule — This Week",
    description: "IST air times and countdowns for upcoming Hindi and regional anime dubs.",
    url: `${BASE_URL}/hindi-dub/schedule`,
    type: "website",
    siteName: "ZyniVerse",
  },
  alternates: { canonical: `${BASE_URL}/hindi-dub/schedule` },
  robots: { index: true, follow: true },
};

function buildHref(day?: string, language?: string) {
  const params = new URLSearchParams();
  if (day && day !== "All") params.set("day", day);
  if (language && language !== "All") params.set("language", language);
  const query = params.toString();
  return query ? `/hindi-dub/schedule?${query}` : "/hindi-dub/schedule";
}

function rowMeta(row: DubScheduleDTO) {
  return [row.season, row.episodeInfo].filter(Boolean).join(" · ") || "Details TBA";
}

function rowSlot(row: DubScheduleDTO) {
  return [row.dayLabel, row.timeLabel].filter(Boolean).join(" · ") || "Slot TBA";
}

function dayMark(day: string) {
  if (day === "Unscheduled") return "TBA";
  if (day === "Daily") return "DLY";
  return day.slice(0, 2).toUpperCase();
}

function accentForIndex(index: number) {
  return DAY_ACCENTS[index % DAY_ACCENTS.length];
}

export default async function HindiDubSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; language?: string }>;
}) {
  const params = await searchParams;
  const day = params.day ?? "All";
  const language = params.language ?? "All";

  const [allRows, languages] = await Promise.all([
    getDubSchedule({ limit: 400 }),
    getDubLanguages(),
  ]);

  const languageMatchedRows = allRows.filter(
    (row) => language === "All" || row.languages.includes(language)
  );
  const rows = languageMatchedRows.filter((row) => day === "All" || row.dayLabel === day);
  const grouped = groupScheduleByDay(rows);
  const upcomingRows = sortDubScheduleByNext(rows).slice(0, 6);

  const dayCounts = new Map<string, number>();
  for (const row of languageMatchedRows) {
    const key = row.dayLabel ?? "Unscheduled";
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }
  const visibleDays = [...WEEKDAY_ORDER, "Daily"].filter((item) => (dayCounts.get(item) ?? 0) > 0);

  const dayMatchedRows = allRows.filter((row) => day === "All" || row.dayLabel === day);
  const languageCounts = new Map<string, number>();
  for (const row of dayMatchedRows) {
    for (const item of row.languages) {
      languageCounts.set(item, (languageCounts.get(item) ?? 0) + 1);
    }
  }
  const visibleLanguages = languages.filter(
    (item) => (languageCounts.get(item.language) ?? 0) > 0 || language === item.language
  );

  const groups = [
    ...grouped.groups,
    ...(grouped.other.length ? [{ day: "Unscheduled", items: grouped.other }] : []),
  ];
  const dayGroupCount = grouped.groups.length + (grouped.other.length ? 1 : 0);
  const languageCount = new Set(rows.flatMap((row) => row.languages)).size;

  return (
    <DubScheduleTickerProvider>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <nav
          className="dub-crumbs mb-5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-mute)]"
          aria-label="Breadcrumb"
        >
          <Link href="/hindi-dub" className="hover:text-[var(--color-cyan)]">
            Hindi Dub
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-[var(--color-ink)]">Schedule</span>
        </nav>

        <FadeIn>
          <section
            className="dub-catalog-hero dub-schedule-hero relative overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 sm:p-9 lg:p-10"
            style={{ "--dub-accent": "var(--color-cyan)" } as React.CSSProperties}
          >
            <div className="dub-aurora pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-[var(--color-cyan)]/25 blur-3xl" />
            <div className="dub-aurora dub-aurora--slow pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[var(--color-violet)]/15 blur-3xl" />
            <div className="dub-grid pointer-events-none absolute inset-0 opacity-[0.1]" />
            <div className="dub-hero-scan pointer-events-none absolute inset-0" />

            <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center lg:gap-10">
              <div>
                <p className="dub-eyebrow">This week · IST</p>
                <h1 className="dub-section-title font-display mt-2 text-3xl font-black leading-tight tracking-tight text-[var(--color-ink)] sm:text-5xl">
                  Hindi dub airing schedule
                </h1>
                <p className="dub-lede mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)] sm:text-base">
                  Check upcoming Hindi and regional dubbed episodes by day or language. All times are in IST,
                  with live countdowns for titled airings. Times are indicative, so confirm before a release.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="dub-schedule-stat" data-tone="cyan">
                    <span className="dub-schedule-stat-dot" aria-hidden="true" />
                    <strong>{rows.length}</strong> airings
                  </span>
                  <span className="dub-schedule-stat" data-tone="violet">
                    <span className="dub-schedule-stat-dot" aria-hidden="true" />
                    <strong>{dayGroupCount}</strong> days
                  </span>
                  <span className="dub-schedule-stat" data-tone="magenta">
                    <span className="dub-schedule-stat-dot" aria-hidden="true" />
                    <strong>{languageCount}</strong> languages
                  </span>
                </div>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <Link href="/hindi-dub" className="dub-hero-chip">
                    Dub hub
                  </Link>
                  <Link href="/hindi-dub/series" className="dub-hero-chip">
                    Browse series
                  </Link>
                  <Link href="/hindi-dub/movies" className="dub-hero-chip">
                    Browse movies
                  </Link>
                  {upcomingRows.length > 0 && (
                    <Link href="#up-next" className="dub-hero-chip dub-hero-chip--live">
                      <span className="dub-live-dot" aria-hidden="true" />
                      See up next
                    </Link>
                  )}
                </div>
              </div>

              <div className="lg:justify-self-end">
                <DubScheduleHeroClock />
              </div>
            </div>
          </section>
        </FadeIn>

        <FadeIn delay={0.04} className="mt-6">
          <div
            className="dub-filter-board rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 sm:p-6"
            style={{ "--dub-accent": "var(--color-cyan)" } as React.CSSProperties}
          >
            <div className="dub-filter-row">
              <span className="dub-filter-label">Day</span>
              <div className="dub-filter-chips">
                <Link
                  href={buildHref(undefined, language)}
                  data-active={day === "All" ? "true" : undefined}
                  data-tone="cyan"
                  className="dub-filter-chip"
                >
                  All days
                  <span className="dub-filter-chip-count">{languageMatchedRows.length}</span>
                </Link>
                {visibleDays.map((item) => (
                  <Link
                    key={item}
                    href={buildHref(item, language)}
                    data-active={day === item ? "true" : undefined}
                    data-tone="cyan"
                    className="dub-filter-chip"
                  >
                    {item === "Daily" ? "Daily" : item.slice(0, 3)}
                    <span className="dub-filter-chip-count">{dayCounts.get(item) ?? 0}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="dub-filter-row mt-3">
              <span className="dub-filter-label">Language</span>
              <div className="dub-filter-chips">
                <Link
                  href={buildHref(day, undefined)}
                  data-active={language === "All" ? "true" : undefined}
                  data-tone="violet"
                  className="dub-filter-chip"
                >
                  All
                  <span className="dub-filter-chip-count">{dayMatchedRows.length}</span>
                </Link>
                {visibleLanguages.map((item) => (
                  <Link
                    key={item.slug}
                    href={buildHref(day, item.language)}
                    data-active={language === item.language ? "true" : undefined}
                    data-tone="violet"
                    className="dub-filter-chip"
                  >
                    {item.language}
                    <span className="dub-filter-chip-count">{languageCounts.get(item.language) ?? 0}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        {upcomingRows.length > 0 && (
          <div id="up-next">
            <FadeIn delay={0.08} className="mt-6">
              <DubLiveSchedulePanel
                rows={upcomingRows}
                limit={5}
                eyebrow="Live countdown · IST"
                title="Up next"
                showFullLink={false}
              />
            </FadeIn>
          </div>
        )}

        {rows.length === 0 ? (
          <FadeIn delay={0.1} className="mt-7">
            <div
              className="dub-schedule-empty rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-panel)] p-10 text-center"
              style={{ "--dub-accent": "var(--color-cyan)" } as React.CSSProperties}
            >
              <p className="font-display text-lg font-bold text-[var(--color-ink)]">
                No airings match these filters.
              </p>
              <p className="mt-1 text-sm text-[var(--color-mute)]">Try another day or language.</p>
              <Link href="/hindi-dub/schedule" className="dub-catalog-reset mt-4 inline-flex rounded-full px-4 py-2 text-xs font-bold">
                Clear filters
              </Link>
            </div>
          </FadeIn>
        ) : (
          <div className="mt-8 space-y-7">
            {groups.map((group, groupIndex) => (
              <FadeIn key={group.day} delay={0.04 * groupIndex}>
                <section
                  className="dub-schedule-group relative overflow-hidden rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7"
                  style={{ "--dub-accent": accentForIndex(groupIndex) } as React.CSSProperties}
                >
                  <div className="dub-schedule-group-glow pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full" />
                  <div className="dub-schedule-group-head relative">
                    <div className="flex items-center gap-3">
                      <span className="dub-schedule-day-mark" aria-hidden="true">
                        {dayMark(group.day)}
                      </span>
                      <div>
                        <p className="dub-eyebrow">Airing day</p>
                        <h2 className="dub-section-title font-display mt-1 text-xl font-black text-[var(--color-ink)] sm:text-2xl">
                          {group.day}
                        </h2>
                      </div>
                    </div>
                    <span className="dub-schedule-count">{group.items.length} airings</span>
                  </div>

                  <StaggerGrid className="dub-schedule-list relative mt-5 grid gap-3 lg:grid-cols-2">
                    {group.items.map((row) => (
                      <StaggerItem key={row.id}>
                        <Link
                          href={`/search?q=${encodeURIComponent(row.title)}`}
                          className="dub-schedule-row group flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-black/20 p-3 sm:gap-4 sm:p-3.5"
                          title={`Search ${row.title} on ZyniVerse`}
                        >
                          <span className="dub-schedule-poster relative h-24 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--color-line)] bg-black/50 sm:h-28 sm:w-20">
                            {row.posterUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.posterUrl}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-cover object-top"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] font-bold text-[var(--color-mute)]">
                                {dayMark(group.day)}
                              </span>
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="dub-schedule-title block line-clamp-2 text-sm font-bold leading-snug text-[var(--color-ink)] sm:text-[15px]">
                              {row.title}
                            </span>
                            <span className="mt-1 block truncate text-[11px] text-[var(--color-mute)]">
                              {rowMeta(row)}
                            </span>
                            <span className="mt-1.5 block truncate text-[10px] text-[var(--color-mute)]">
                              {rowSlot(row)}
                            </span>
                            <span className="mt-2 flex flex-wrap gap-1">
                              {row.languages.slice(0, 4).map((item) => (
                                <span key={item} className="dub-schedule-lang">
                                  {item}
                                </span>
                              ))}
                            </span>
                          </span>

                          <span className="dub-schedule-time shrink-0 text-right">
                            <span className="dub-schedule-time-value block text-sm font-bold sm:text-base">
                              {row.timeLabel ?? "TBA"}
                            </span>
                            <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--color-mute)]">
                              IST
                            </span>
                            <span className="mt-2 flex justify-end">
                              <DubCountdownChip slot={row} className="dub-mini-chip" />
                            </span>
                          </span>
                        </Link>
                      </StaggerItem>
                    ))}
                  </StaggerGrid>
                </section>
              </FadeIn>
            ))}
          </div>
        )}

        <NativeBannerAd className="my-8" />

        <FadeIn delay={0.12}>
          <p className="dub-schedule-note mt-6 text-[11px] leading-relaxed text-[var(--color-mute)]">
            Times are indicative and may change. ZyniVerse does not host or stream episodes.
          </p>
        </FadeIn>
      </main>
    </DubScheduleTickerProvider>
  );
}
