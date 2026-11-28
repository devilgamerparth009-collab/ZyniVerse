import type { Metadata } from "next";
import Link from "next/link";
import {
  getDubCatalog,
  getDubGenreStats,
  getDubLanguages,
  getDubSchedule,
  getDubStats,
  type DubTitleDTO,
} from "@/lib/dub-import/queries";
import { DubTitleCard } from "@/components/hindi-dub/DubTitleCard";
import { DubLiveSchedulePanel } from "@/components/hindi-dub/DubLiveSchedulePanel";
import { DubScheduleTickerProvider } from "@/components/hindi-dub/DubScheduleTicker";
import { sortDubScheduleByNext } from "@/lib/dub-schedule-time";
import { FadeIn, StaggerGrid, StaggerItem } from "@/components/PageTransition";
import NativeBannerAd from "@/components/NativeBannerAd";

// 1 hour: catalogue changes are not minute-to-minute; lowers ISR churn.
export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Hindi Dub Anime Library — Series, Movies & Weekly Schedule (2026)",
  description:
    "Browse Hindi, Tamil, Telugu, Bengali, Malayalam and Kannada dubbed anime — series, movies, languages and the weekly airing schedule.",
  keywords: [
    "hindi dub anime", "hindi dubbed anime list", "anime in hindi", "hindi dub schedule",
    "tamil dub anime", "telugu dub anime", "regional dub anime india", "hindi dub movies",
    "dubbed anime india", "hindi dub catalogue",
  ],
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
    title: "Hindi Dub Anime Library — Series, Movies & Schedule",
    description: "Every Hindi and regional dub in one place: series, movies, languages and the weekly airing schedule.",
    url: `${BASE_URL}/hindi-dub`,
    type: "website",
    siteName: "ZyniVerse",
  },
  alternates: { canonical: `${BASE_URL}/hindi-dub` },
  robots: { index: true, follow: true },
};

type DubChip = { slug: string; label: string; total: number };

/** Shared shell for the language/genre chip boards. */
function DubChipSection({
  id,
  eyebrow,
  title,
  allHref,
  allLabel = "View all →",
  queryParam,
  items,
  accent,
  delay,
}: {
  id: string;
  eyebrow: string;
  title: string;
  allHref: string;
  allLabel?: string;
  queryParam?: string;
  items: DubChip[];
  accent: string;
  delay: number;
}) {
  if (!items.length) return null;
  const max = Math.max(1, ...items.map((item) => item.total));

  return (
    <FadeIn delay={delay} className="mt-6">
      <section id={id} className="dub-section scroll-mt-24 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7">
        <div className="dub-section-head">
          <div>
            <p className="dub-eyebrow" style={{ "--dub-accent": accent } as React.CSSProperties}>
              {eyebrow}
            </p>
            <h2 className="dub-section-title font-display text-2xl font-black text-[var(--color-ink)] sm:text-3xl">
              {title}
            </h2>
          </div>
          <Link href={allHref} className="dub-section-link text-xs font-semibold text-[var(--color-cyan)]">
            {allLabel}
          </Link>
        </div>

        <StaggerGrid className="dub-chip-cloud mt-5 flex flex-wrap gap-2.5">
          {items.map((item) => (
            <StaggerItem key={`${id}-${item.slug}`}>
              <Link
                href={queryParam
                  ? `${allHref}?${queryParam}=${encodeURIComponent(item.label)}`
                  : `${allHref}/${item.slug}`}
                className="dub-chip group inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-black/20 py-2 pl-8 pr-4 text-sm font-medium text-[var(--color-ink)]"
                style={{
                  "--dub-accent": accent,
                  "--dub-bar": `${Math.max(6, Math.round((item.total / max) * 100))}%`,
                } as React.CSSProperties}
              >
                <span>{item.label}</span>
                <span className="dub-chip-count">{item.total.toLocaleString("en-IN")}</span>
                <span className="dub-chip-arrow" aria-hidden="true">→</span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>
    </FadeIn>
  );
}

/** Large poster shelf used for the series and movie rows. */
function DubShelfSection({
  eyebrow,
  title,
  subtitle,
  href,
  allLabel,
  accent,
  items,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  href: string;
  allLabel: string;
  accent: string;
  items: DubTitleDTO[];
}) {
  if (!items.length) return null;

  return (
    <FadeIn className="mt-10">
      <section
        className="dub-shelf relative overflow-hidden rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7 lg:p-8"
        style={{ "--dub-accent": accent } as React.CSSProperties}
      >
        <div className="dub-shelf-glow pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="dub-shelf-eyebrow text-[10px] font-bold uppercase tracking-[0.22em]">{eyebrow}</p>
            <h2 className="dub-section-title font-display mt-1.5 text-2xl font-black text-[var(--color-ink)] sm:text-3xl lg:text-4xl">
              {title}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-[var(--color-mute)]">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="dub-shelf-count hidden rounded-full border border-[var(--color-line)] bg-black/25 px-3 py-1.5 font-mono text-[11px] text-[var(--color-mute)] sm:inline-flex">
              {items.length} titles
            </span>
            <Link
              href={href}
              className="dub-shelf-link inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] px-4 py-2 text-xs font-bold text-[var(--color-cyan)]"
            >
              {allLabel}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <StaggerGrid className="dub-shelf-grid relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 sm:gap-5">
          {items.map((item) => (
            <StaggerItem key={item.id}>
              <DubTitleCard item={item} size="lg" />
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>
    </FadeIn>
  );
}

export default async function HindiDubHubPage() {
  const [stats, languages, genres, recentSeries, recentMovies, schedule] = await Promise.all([
    getDubStats(),
    getDubLanguages(),
    getDubGenreStats(undefined, 21),
    getDubCatalog({ kind: "series", sort: "recent", limit: 12 }),
    getDubCatalog({ kind: "movie", sort: "recent", limit: 12 }),
    getDubSchedule({ limit: 200 }),
  ]);

  // Order the very first paint by the next real IST slot, not by a possibly
  // stale stored timestamp. The client panel re-sorts again once its clock runs.
  const timedSchedule = sortDubScheduleByNext(schedule);

  const updatedLabel = stats.updatedAt
    ? new Date(stats.updatedAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  // Poster art for the hero snapshot comes from the rows already fetched for
  // the shelves below — no extra query, no extra API call, no client refresh.
  const heroPosters = [
    recentSeries.items[0],
    recentMovies.items[0],
    recentSeries.items[1],
  ].filter((item): item is DubTitleDTO => Boolean(item));

  const nextAiring = timedSchedule[0];
  const nextAiringSlot = nextAiring
    ? [nextAiring.dayLabel, nextAiring.timeLabel].filter(Boolean).join(" · ") || "Slot TBA"
    : null;

  const statCards = [
    { label: "Titles", value: stats.total.toLocaleString("en-IN"), tag: "ALL", accent: "var(--color-cyan)" },
    { label: "Series", value: stats.series.toLocaleString("en-IN"), tag: "SER", accent: "var(--color-violet)" },
    { label: "Movies", value: stats.movies.toLocaleString("en-IN"), tag: "MOV", accent: "var(--color-magenta)" },
    { label: "Languages", value: String(stats.languages), tag: "LAN", accent: "var(--color-amber)" },
  ];

  const quickLinks = [
    { href: "/hindi-dub/schedule", label: "Weekly schedule", hint: `${stats.scheduleCount} airings this week`, accent: "var(--color-cyan)", step: "01" },
    { href: "/hindi-dub/series", label: "Anime series", hint: `${stats.series.toLocaleString("en-IN")} titles`, accent: "var(--color-violet)", step: "02" },
    { href: "/hindi-dub/movies", label: "Dub movies", hint: `${stats.movies.toLocaleString("en-IN")} titles`, accent: "var(--color-magenta)", step: "03" },
  ];

  const languageChips: DubChip[] = languages.map((language) => ({
    slug: language.slug,
    label: language.language,
    total: language.total,
  }));
  const genreChips: DubChip[] = genres.map((genre) => ({
    slug: genre.slug,
    label: genre.genre,
    total: genre.total,
  }));

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <FadeIn>
        <section className="dub-hero dub-hero--library relative overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 sm:p-10 lg:p-12">
          <div className="dub-aurora pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[var(--color-violet)]/30 blur-3xl" />
          <div className="dub-aurora dub-aurora--slow pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-[var(--color-magenta)]/20 blur-3xl" />
          <div className="dub-grid pointer-events-none absolute inset-0 opacity-[0.12]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-cyan)]/70 to-transparent" />

          <div className="relative grid gap-9 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:items-center lg:gap-12">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="dub-hero-kicker inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-cyan)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)] shadow-[0_0_12px_var(--color-cyan)]" />
                  Hindi &amp; regional dub library
                </p>
                {updatedLabel && (
                  <div
                    className="dub-sync-pill inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-black/25 px-3 py-1.5 text-[11px] text-[var(--color-mute)]"
                    title={`Catalogue synced ${updatedLabel} IST`}
                  >
                    <span className="dub-sync-dot" aria-hidden="true" />
                    Synced {updatedLabel} IST
                  </div>
                )}
              </div>

              <h1 className="dub-hero-title font-display animate-hero-text mt-4 max-w-2xl text-4xl font-black leading-[1.08] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-[3.55rem]">
                Hindi &amp; regional dubs,{" "}
                <span className="dub-gradient-text">all in one place.</span>
              </h1>
              <p className="dub-lede mt-5 max-w-xl text-base leading-relaxed text-[var(--color-mute)] sm:text-lg">
                Explore series and movies, filter by language or genre, and check the weekly airing schedule. Open
                any title to see where it is listed.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/hindi-dub/series"
                  className="dub-cta dub-cta--primary group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-[var(--color-void)]"
                >
                  Explore series
                  <span className="dub-cta-arrow transition-transform" aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/hindi-dub/schedule"
                  className="dub-cta dub-cta--secondary group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-[var(--color-ink)]"
                >
                  <span className="dub-live-dot" aria-hidden="true" />
                  Live schedule
                </Link>
              </div>

              <StaggerGrid className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                {statCards.map((stat) => (
                  <StaggerItem key={stat.label}>
                    <div
                      className="dub-stat-card hdub-stat-card relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-black/25 px-4 py-4 sm:px-5 sm:py-5"
                      style={{ "--dub-accent": stat.accent } as React.CSSProperties}
                    >
                      <span className="hdub-stat-glyph" aria-hidden="true">{stat.tag}</span>
                      <span className="dub-stat-mark" aria-hidden="true" />
                      <p className="dub-stat-value font-display relative mt-3 text-3xl font-black text-[var(--color-ink)] sm:text-4xl">
                        {stat.value}
                      </p>
                      <p className="relative mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-mute)]">
                        {stat.label}
                      </p>
                      <span className="hdub-stat-rail" aria-hidden="true" />
                    </div>
                  </StaggerItem>
                ))}
              </StaggerGrid>
            </div>

            <div className="dub-hero-showcase relative min-w-0">
              <article className="dub-hero-showcase-card relative overflow-hidden rounded-[1.6rem] border border-[var(--color-line)] bg-black/25 p-4 sm:p-5">
                <span className="scanline-sweep" aria-hidden="true" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="dub-eyebrow"
                      style={{ "--dub-accent": "var(--color-cyan)" } as React.CSSProperties}
                    >
                      Library snapshot
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-mute)] sm:text-sm">
                      {stats.languages} languages · {stats.scheduleCount} airings this week
                    </p>
                  </div>
                  <span className="dub-hero-live-chip inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-cyan)]/40 bg-[var(--color-cyan)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-cyan)]">
                    <span className="dub-live-dot" aria-hidden="true" />
                    Dub hub
                  </span>
                </div>

                <div className="dub-hero-poster-stack relative mt-5 h-56 sm:h-64">
                  {heroPosters.length ? (
                    heroPosters.map((item, index) => {
                      const position = index === 0 ? "main" : index === 1 ? "left" : "right";
                      return (
                        <Link
                          key={item.id}
                          href={`/search?q=${encodeURIComponent(item.title)}`}
                          aria-label={`Search ${item.title} on ZyniVerse`}
                          className={`dub-hero-poster dub-hero-poster--${position}`}
                        >
                          {item.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.posterUrl} alt="" loading={index === 0 ? "eager" : "lazy"} />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center p-3 text-center text-xs font-semibold text-[var(--color-mute)]">
                              {item.title}
                            </span>
                          )}
                          {index === 0 && (
                            <span className="dub-hero-poster-caption">
                              <span className="block truncate text-sm font-bold text-white">{item.title}</span>
                              <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                                {item.languages[0] ?? "Dubbed"} dub
                              </span>
                            </span>
                          )}
                        </Link>
                      );
                    })
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--color-line)] text-sm text-[var(--color-mute)]">
                      Dub catalogue
                    </div>
                  )}
                </div>

                {nextAiring && nextAiringSlot && (
                  <div className="dub-hero-next relative mt-4 flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-black/30 p-3">
                    <div className="dub-hero-next-thumb relative h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black/50">
                      {nextAiring.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={nextAiring.posterUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[var(--color-mute)]">
                          EP
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-cyan)]">
                        Next on air · IST
                      </p>
                      <p className="mt-0.5 truncate text-sm font-bold text-[var(--color-ink)]" title={nextAiring.title}>
                        {nextAiring.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--color-mute)]">
                        {nextAiringSlot} · {nextAiring.episodeInfo || "Episode details TBA"}
                      </p>
                    </div>
                    <Link
                      href="/hindi-dub/schedule"
                      className="dub-hero-next-link grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--color-line)] text-sm font-bold text-[var(--color-cyan)]"
                      aria-label="Open live schedule"
                    >
                      →
                    </Link>
                  </div>
                )}
              </article>
            </div>
          </div>
        </section>
      </FadeIn>

      <FadeIn delay={0.05} className="mt-6">
        <StaggerGrid className="grid gap-4 sm:grid-cols-3">
          {quickLinks.map((link) => (
            <StaggerItem key={link.href}>
              <Link
                href={link.href}
                className="dub-quick-card group relative block overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 transition hover:-translate-y-1 sm:p-6"
                style={{ "--dub-accent": link.accent } as React.CSSProperties}
              >
                <span className="dub-step pointer-events-none absolute -right-1 -top-3 font-display text-6xl font-black opacity-[0.07]">
                  {link.step}
                </span>
                <span className="dub-quick-rule inline-block h-1.5 w-12 rounded-full" />
                <p className="font-display relative mt-4 text-xl font-black text-[var(--color-ink)] transition group-hover:text-[var(--color-cyan)] sm:text-2xl">
                  {link.label}
                </p>
                <p className="relative mt-1 text-sm text-[var(--color-mute)]">{link.hint}</p>
                <span className="relative mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--color-cyan)]">
                  Open <span className="dub-quick-arrow inline-block" aria-hidden="true">→</span>
                </span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-6">
        <DubScheduleTickerProvider>
          <DubLiveSchedulePanel rows={timedSchedule} limit={6} />
        </DubScheduleTickerProvider>
      </FadeIn>

      <DubChipSection
        id="languages"
        eyebrow="Browse"
        title="By language"
        allHref="/hindi-dub/series"
        items={languageChips}
        accent="var(--color-violet)"
        delay={0.12}
      />

      <DubChipSection
        id="genres"
        eyebrow="Discover"
        title="By genre"
        allHref="/hindi-dub/series"
        allLabel="All genres →"
        queryParam="genre"
        items={genreChips}
        accent="var(--color-magenta)"
        delay={0.14}
      />

      <DubShelfSection
        eyebrow="Fresh catalogue"
        title="Recently updated series"
        subtitle="New and recently added Hindi and regional dubbed series to explore."
        href="/hindi-dub/series"
        allLabel="All series"
        accent="var(--color-cyan)"
        items={recentSeries.items}
      />

      <div className="mt-10">
        <NativeBannerAd />
      </div>

      <DubShelfSection
        eyebrow="Big screen"
        title="Dubbed movies"
        subtitle="Hindi and regional dubbed films, ready to browse by language."
        href="/hindi-dub/movies"
        allLabel="All movies"
        accent="var(--color-magenta)"
        items={recentMovies.items}
      />

      <FadeIn className="mt-10 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <section
          className="dub-guide dub-guide--hub relative overflow-hidden rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7 lg:p-8"
          style={{ "--dub-accent": "var(--color-cyan)" } as React.CSSProperties}
        >
          <div className="dub-guide-glow pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="dub-eyebrow">Quick guide</p>
                <h2 className="dub-section-title font-display mt-1.5 text-2xl font-black text-[var(--color-ink)] sm:text-3xl">
                  How to use this Hindi dub library
                </h2>
              </div>
              <span className="hdub-guide-count">3 steps</span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)] sm:text-base">
              Find Hindi and regional dubbed anime by language, genre, series, movie or weekly schedule. Open a title
              to see its listing, then confirm the audio language and availability on the official platform.
            </p>
            <StaggerGrid className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { title: "Find by format", body: "Browse series, movies or the weekly schedule to see what is available now." },
                { title: "Check language", body: "Filter by Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali and other available dubs." },
                { title: "Verify before watching", body: "Availability and audio tracks can differ by region and platform. Check the official listing before you watch." },
              ].map((item, index) => (
                <StaggerItem key={item.title}>
                  <div className="hdub-guide-step relative overflow-hidden rounded-xl border border-[var(--color-line)] bg-black/20 p-4 sm:p-5">
                    <span className="hdub-guide-step-rule" aria-hidden="true" />
                    <span className="hdub-guide-step-badge" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="relative pr-10 font-semibold text-[var(--color-ink)]">{item.title}</p>
                    <p className="relative mt-1.5 text-xs leading-relaxed text-[var(--color-mute)]">{item.body}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGrid>
          </div>
        </section>

        <section
          className="dub-faq dub-faq--hub relative overflow-hidden rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7 lg:p-8"
          style={{ "--dub-accent": "var(--color-violet)" } as React.CSSProperties}
        >
          <div className="dub-faq-glow pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="dub-eyebrow">Good to know</p>
                <h2 className="dub-section-title font-display mt-1.5 text-2xl font-black text-[var(--color-ink)] sm:text-3xl">
                  Hindi dub FAQ
                </h2>
              </div>
              <span className="hdub-faq-count">3 answers</span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                {
                  q: "Does ZyniVerse host dubbed episodes?",
                  a: "No. ZyniVerse is an information and discovery platform. We do not host or stream episodes.",
                },
                {
                  q: "How often is the catalogue updated?",
                  a: "Listings and air times are refreshed regularly. For the latest availability, check the official platform.",
                },
                {
                  q: "Why can a dub be missing or different on a platform?",
                  a: "Streaming rights, regional availability and audio tracks change over time. Always check the official platform listing.",
                },
              ].map((item, index) => (
                <div
                  key={item.q}
                  className="hdub-faq-item dub-faq-item relative overflow-hidden rounded-xl border border-[var(--color-line)] bg-black/20 p-4"
                  style={
                    {
                      "--dub-accent": ["var(--color-cyan)", "var(--color-violet)", "var(--color-amber)"][index % 3],
                    } as React.CSSProperties
                  }
                >
                  <div className="flex gap-3">
                    <span className="hdub-faq-mark" aria-hidden="true">?</span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold leading-snug text-[var(--color-ink)]">{item.q}</h3>
                      <p className="hdub-faq-answer mt-2 text-xs leading-relaxed text-[var(--color-mute)]">{item.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeIn>

      <FadeIn className="mt-10">
        <section
          className="dub-coverage dub-coverage--hub relative overflow-hidden rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7 lg:p-8"
          style={{ "--dub-accent": "var(--color-amber)" } as React.CSSProperties}
        >
          <div className="dub-coverage-glow pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="dub-eyebrow">At a glance</p>
              <h2 className="dub-section-title font-display mt-1.5 text-2xl font-black text-[var(--color-ink)] sm:text-3xl">
                Catalogue coverage
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-[var(--color-mute)]">
                Listings and air times from public sources, with links to the original listing for the latest details.
              </p>
            </div>
            <span className="dub-coverage-pill hdub-coverage-pill inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-black/25 px-3 py-1.5 text-xs text-[var(--color-mute)]">
              <span className="dub-live-dot" aria-hidden="true" />
              Updated regularly
            </span>
          </div>
          <StaggerGrid className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Catalogues checked", value: stats.sources.length.toLocaleString("en-IN"), tag: "SRC", accent: "var(--color-cyan)", date: false },
              { label: "Titles listed", value: stats.total.toLocaleString("en-IN"), tag: "ALL", accent: "var(--color-violet)", date: false },
              { label: "Schedule entries", value: stats.scheduleCount.toLocaleString("en-IN"), tag: "AIR", accent: "var(--color-magenta)", date: false },
              {
                label: "Last updated",
                value: stats.updatedAt
                  ? new Date(stats.updatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })
                  : "—",
                tag: "IST",
                accent: "var(--color-amber)",
                date: true,
              },
            ].map((item) => (
              <StaggerItem key={item.label}>
                <div
                  className={`hdub-coverage-stat dub-coverage-stat relative h-full overflow-hidden rounded-xl border border-[var(--color-line)] bg-black/20 p-4 ${
                    item.date ? "hdub-coverage-stat--date" : ""
                  }`}
                  style={{ "--dub-accent": item.accent } as React.CSSProperties}
                >
                  <span className="hdub-coverage-icon" aria-hidden="true">{item.tag}</span>
                  <p className="dub-coverage-stat-value font-display relative mt-3 text-xl font-black text-[var(--color-ink)] sm:text-2xl">
                    {item.value}
                  </p>
                  <p className="relative mt-1 text-[10px] uppercase tracking-wide text-[var(--color-mute)]">
                    {item.label}
                  </p>
                  <span className="hdub-coverage-rail" aria-hidden="true" />
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </section>
      </FadeIn>
    </main>
  );
}
