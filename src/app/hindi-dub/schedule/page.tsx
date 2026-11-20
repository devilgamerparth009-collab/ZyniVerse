import type { Metadata } from "next";
import Link from "next/link";
import { getDubLanguages, getDubSchedule, groupScheduleByDay, WEEKDAY_ORDER } from "@/lib/dub-import/queries";
import NativeBannerAd from "@/components/NativeBannerAd";

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Hindi Dub Anime Schedule — This Week's Episode Airings (2026)",
  description:
    "Weekly Hindi, Tamil, Telugu and multi-audio anime dub schedule with IST air times, seasons and episode numbers. Auto-synced from Indian dub sources every day.",
  keywords: [
    "hindi dub schedule", "hindi dub anime schedule", "anime airing schedule india",
    "hindi dub release date", "tamil dub schedule", "telugu dub schedule",
    "hindi anime this week", "dubbed anime schedule",
  ],
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
    title: "Hindi Dub Anime Schedule — This Week",
    description: "IST air times for every tracked Hindi and regional anime dub.",
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

export default async function HindiDubSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; language?: string }>;
}) {
  const params = await searchParams;
  const day = params.day ?? "All";
  const language = params.language ?? "All";

  const [rows, languages] = await Promise.all([
    getDubSchedule({ day, language, limit: 400 }),
    getDubLanguages(),
  ]);
  const grouped = groupScheduleByDay(rows);

  const chipClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium transition ${
      active
        ? "border-[var(--color-cyan)]/60 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]"
        : "border-[var(--color-line)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
    }`;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <nav className="mb-4 flex items-center gap-2 text-xs text-[var(--color-mute)]">
        <Link href="/hindi-dub" className="hover:text-[var(--color-cyan)]">
          Hindi Dub
        </Link>
        <span>/</span>
        <span className="text-[var(--color-ink)]">Schedule</span>
      </nav>

      <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)] sm:text-4xl">
        Hindi dub airing schedule
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-mute)]">
        Weekly dub schedule with IST timings. Slots refresh automatically when a time changes.
        Times are indicative, so confirm before a release.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={buildHref(undefined, language)} className={chipClass(day === "All")}>
          All days
        </Link>
        {WEEKDAY_ORDER.map((weekday) => (
          <Link key={weekday} href={buildHref(weekday, language)} className={chipClass(day === weekday)}>
            {weekday.slice(0, 3)}
          </Link>
        ))}
        <Link href={buildHref("Daily", language)} className={chipClass(day === "Daily")}>
          Daily
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-[var(--color-mute)]">Language</span>
        <Link href={buildHref(day, undefined)} className={chipClass(language === "All")}>
          All
        </Link>
        {languages.map((item) => (
          <Link
            key={item.slug}
            href={buildHref(day, item.language)}
            className={chipClass(language === item.language)}
          >
            {item.language}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-mute)]">
          No airings match this filter. Try another day or language.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {[...grouped.groups, ...(grouped.other.length ? [{ day: "Unscheduled", items: grouped.other }] : [])].map(
            (group) => (
              <section key={group.day}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-sm font-black uppercase tracking-[0.15em] text-[var(--color-ink)]">
                    {group.day}
                  </h2>
                  <span className="h-px flex-1 bg-[var(--color-line)]" />
                  <span className="text-[11px] text-[var(--color-mute)]">{group.items.length} airings</span>
                </div>
                <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
                  {group.items.map((row) => (
                    <li key={row.id}>
                      <a
                        href={row.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 transition hover:bg-white/5"
                      >
                        <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--color-line)] bg-black/40">
                          {row.posterUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.posterUrl}
                              alt={row.title}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{row.title}</p>
                          <p className="mt-0.5 text-[11px] text-[var(--color-mute)]">
                            {[row.season, row.episodeInfo].filter(Boolean).join(" · ") || "Details TBA"}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {row.languages.slice(0, 5).map((item) => (
                              <span
                                key={item}
                                className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--color-mute)]"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-bold text-[var(--color-cyan)]">{row.timeLabel ?? "TBA"}</p>
                          <p className="text-[10px] uppercase tracking-wide text-[var(--color-mute)]">IST</p>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )
          )}
        </div>
      )}

      <div className="mt-8">
        <NativeBannerAd />
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-mute)]">
        Times are indicative and may change. ZyniVerse stores schedule details only and does not host episodes.
      </p>
    </main>
  );
}
