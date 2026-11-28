import type { Metadata } from "next";
import Link from "next/link";
import {
  getDubCatalog,
  getDubGenreStats,
  getDubLanguages,
  getDubSchedule,
  getDubStats,
  groupScheduleByDay,
} from "@/lib/dub-import/queries";
import { sortDubScheduleByNext } from "@/lib/dub-schedule-time";
import { DubLiveSchedulePanel } from "@/components/hindi-dub/DubLiveSchedulePanel";
import { DubCountdownChip, DubScheduleTickerProvider } from "@/components/hindi-dub/DubScheduleTicker";
import { FadeIn, StaggerGrid, StaggerItem } from "@/components/PageTransition";
import NativeBannerAd from "@/components/NativeBannerAd";
import IndianDubCatalogBrowser from "@/components/indian-dubs/IndianDubCatalogBrowser";
import LiveDubFeeds from "@/components/indian-dubs/LiveDubFeeds";
import { INDIAN_DUB_GUIDES } from "@/lib/indian-dub-guides";
import { DUB_PAGES } from "@/lib/dub-page-index";
import "./indian-dubs.css";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

// Catalogue and schedule rows come from the synced dub database. One hour keeps
// ISR churn low; the browser-side sections poll their own public APIs.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Indian Dubs — Hindi, Tamil & Telugu Anime Dub Tracker (2026)",
  description:
    "Browse Hindi, Tamil, Telugu and other Indian-language anime dubs with real airing times in IST, a live searchable catalogue, official-channel uploads and detailed guides.",
  keywords: [
    "hindi dubbed anime", "tamil dubbed anime", "telugu dubbed anime", "anime in hindi",
    "anime in tamil", "anime in telugu", "indian dubbed anime list", "dubbed anime schedule india",
    "hindi dub anime", "anime hindi me kaise dekhe", "hindi anime list", "indian anime dub guide",
  ],
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
    title: "Indian Dubs — Hindi, Tamil & Telugu Anime Dub Tracker",
    description: "Real IST airing times, a searchable dub catalogue and detailed Indian dub guides.",
    url: `${BASE_URL}/indian-dubs`,
    type: "website",
    siteName: "ZyniVerse",
  },
  twitter: {
    card: "summary_large_image",
    site: "@GuptaParth2857",
    title: "Indian Dubs — Hindi, Tamil & Telugu",
    description: "Real IST airing times, live catalogue and Indian dub guides.",
  },
  alternates: { canonical: `${BASE_URL}/indian-dubs` },
  robots: { index: true, follow: true },
};

function formatSyncTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function IndianDubsPage() {
  const [stats, languages, genres, catalog, schedule] = await Promise.all([
    getDubStats(),
    getDubLanguages(),
    getDubGenreStats(undefined, 21),
    getDubCatalog({ sort: "recent", limit: 12 }),
    getDubSchedule({ limit: 200 }),
  ]);

  const timedSchedule = sortDubScheduleByNext(schedule);
  const grouped = groupScheduleByDay(schedule);
  const languageChips = [...languages]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const genreChips = genres.slice(0, 12);
  const guides = INDIAN_DUB_GUIDES.slice(0, 6);
  const syncedAt = formatSyncTime(stats.updatedAt);

  const statCards = [
    { label: "Titles listed", value: stats.total.toLocaleString("en-IN"), accent: "var(--color-cyan)" },
    { label: "Airing entries", value: stats.scheduleCount.toLocaleString("en-IN"), accent: "var(--color-violet)" },
    { label: "Languages", value: String(stats.languages), accent: "var(--color-magenta)" },
    { label: "Detail pages", value: DUB_PAGES.length.toLocaleString("en-IN"), accent: "var(--color-amber)" },
  ];

  const quickLinks = [
    { href: "/hindi-dub/schedule", label: "Weekly schedule", hint: `${stats.scheduleCount} real airing entries`, accent: "var(--color-cyan)", step: "01" },
    { href: "/hindi-dub/series", label: "Anime series", hint: `${stats.series.toLocaleString("en-IN")} dubbed series`, accent: "var(--color-violet)", step: "02" },
    { href: "/hindi-dub/movies", label: "Dub movies", hint: `${stats.movies.toLocaleString("en-IN")} dubbed movies`, accent: "var(--color-magenta)", step: "03" },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Indian anime dub catalogue",
      description: "Hindi, Tamil, Telugu and other Indian-language anime dubs listed in the ZyniVerse dub catalogue.",
      numberOfItems: stats.total,
      itemListElement: catalog.items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${BASE_URL}/hindi-dub/series?q=${encodeURIComponent(item.title)}`,
        name: item.title,
      })),
    },
  ];

  return (
    <main className="idub-page mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="dub-crumbs mb-6 flex flex-wrap items-center gap-2 text-xs text-[var(--color-mute)]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[var(--color-cyan)]" prefetch={false}>Home</Link>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-[var(--color-ink)]">Indian Dubs</span>
      </nav>

      <FadeIn>
        <section
          className="idub-hero dub-hero relative overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 sm:p-10 lg:p-12"
          style={{ "--dub-accent": "var(--color-cyan)" } as React.CSSProperties}
        >
          <div className="idub-tricolor-beam pointer-events-none absolute inset-x-0 top-0 h-[3px]" />
          <div className="dub-aurora pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[var(--color-violet)]/25 blur-3xl" />
          <div className="dub-aurora dub-aurora--slow pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-[var(--color-magenta)]/20 blur-3xl" />
          <div className="dub-grid pointer-events-none absolute inset-0 opacity-[0.12]" />
          <div className="dub-hero-scan pointer-events-none absolute inset-0" />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="idub-wordmark">ZyniVerse · Indian Dubs</span>
              <span className="dub-sync-pill inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-black/25 px-3 py-1.5 text-[11px] text-[var(--color-mute)]">
                <span className="dub-live-dot" aria-hidden="true" />
                Live · IST
              </span>
            </div>

            <h1 className="dub-hero-title font-display mt-4 max-w-4xl text-4xl font-black leading-[1.05] tracking-tight text-[var(--color-ink)] sm:text-6xl lg:text-7xl">
              Hindi, Tamil &amp; Telugu dubs —{" "}
              <span className="dub-gradient-text">one real-time board.</span>
            </h1>
            <p className="dub-lede mt-5 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)] sm:text-base">
              Check real airing times in IST, search the full dubbed catalogue, watch fresh uploads from official
              channels and open detailed guides. Where a date is not announced, it stays unannounced here.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="#schedule"
                className="dub-cta dub-cta--primary group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-[var(--color-void)]"
              >
                See live schedule
                <span className="dub-cta-arrow transition-transform" aria-hidden="true">→</span>
              </Link>
              <Link
                href="#catalogue"
                className="dub-cta dub-cta--secondary group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-[var(--color-ink)]"
              >
                Browse catalogue
              </Link>
              <Link
                href="#guides"
                className="dub-cta dub-cta--secondary group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-[var(--color-ink)]"
              >
                Dub guides
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {languageChips.slice(0, 3).map((item) => (
                <Link
                  key={item.language}
                  href={`/hindi-dub/series?language=${encodeURIComponent(item.language)}`}
                  className="idub-lang-chip inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold"
                  prefetch={false}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                  {item.language} · {item.total.toLocaleString("en-IN")}
                </Link>
              ))}
            </div>

            <StaggerGrid className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {statCards.map((stat) => (
                <StaggerItem key={stat.label}>
                  <div
                    className="dub-stat-card relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-black/25 px-4 py-4 sm:px-5 sm:py-5"
                    style={{ "--dub-accent": stat.accent } as React.CSSProperties}
                  >
                    <span className="dub-stat-mark" aria-hidden="true" />
                    <p className="dub-stat-value font-display relative text-3xl font-black text-[var(--color-ink)] sm:text-4xl">
                      {stat.value}
                    </p>
                    <p className="relative mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-mute)]">
                      {stat.label}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGrid>

            {syncedAt && (
              <p className="dub-sync-pill mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-black/25 px-3 py-1.5 text-xs text-[var(--color-mute)]">
                <span className="dub-sync-dot" aria-hidden="true" />
                Catalogue synced {syncedAt} IST
              </p>
            )}
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
                prefetch={false}
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

      <div id="schedule" className="scroll-mt-24">
        <FadeIn delay={0.08} className="mt-6">
          <DubScheduleTickerProvider>
            <DubLiveSchedulePanel
              rows={timedSchedule}
              limit={6}
              eyebrow="Live schedule · IST"
              title="Next real airing"
            />
          </DubScheduleTickerProvider>
        </FadeIn>

        {grouped.groups.length > 0 && (
          <FadeIn delay={0.1} className="mt-6">
            <section
              className="dub-section rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7"
              style={{ "--dub-accent": "var(--color-violet)" } as React.CSSProperties}
            >
              <div className="dub-section-head">
                <div>
                  <p className="dub-eyebrow">Synced listing</p>
                  <h2 className="dub-section-title font-display text-2xl font-black text-[var(--color-ink)] sm:text-3xl">
                    Airings by day
                  </h2>
                </div>
                <Link href="/hindi-dub/schedule" className="dub-section-link text-xs font-semibold text-[var(--color-cyan)]" prefetch={false}>
                  Full schedule →
                </Link>
              </div>

              <StaggerGrid className="idub-week-grid mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {grouped.groups.slice(0, 8).map((group) => (
                  <StaggerItem key={group.day}>
                    <Link
                      href={`/hindi-dub/schedule?day=${encodeURIComponent(group.day)}`}
                      className="idub-week-col group block rounded-xl border border-[var(--color-line)] bg-black/20 p-4"
                      prefetch={false}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-[var(--color-ink)]">{group.day}</p>
                        <span className="idub-week-count font-mono text-xs text-[var(--color-violet)]">
                          {group.items.length}
                        </span>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {group.items.slice(0, 3).map((row) => (
                          <li key={row.id} className="min-w-0">
                            <p className="truncate text-xs font-semibold text-[var(--color-mute)] transition group-hover:text-[var(--color-ink)]">
                              {row.title}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[10px] text-[var(--color-amber)]">
                                {[row.dayLabel, row.timeLabel].filter(Boolean).join(" · ") || "Slot TBA"}
                              </span>
                              <DubCountdownChip slot={row} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerGrid>

              {grouped.other.length > 0 && (
                <p className="mt-4 text-xs leading-relaxed text-[var(--color-mute)]">
                  <span className="font-semibold text-[var(--color-ink)]">Announced later: </span>
                  {grouped.other.slice(0, 4).map((row, index) => (
                    <span key={row.id}>
                      {index > 0 && <span className="mx-1.5 text-white/25">·</span>}
                      <Link href={`/search?q=${encodeURIComponent(row.title)}`} className="hover:text-[var(--color-cyan)]" prefetch={false}>
                        {row.title}
                      </Link>
                    </span>
                  ))}
                  <span> — no fixed weekly slot listed yet.</span>
                </p>
              )}
            </section>
          </FadeIn>
        )}
      </div>

      <FadeIn delay={0.12} className="mt-6">
        <section
          className="dub-section rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7"
          style={{ "--dub-accent": "var(--color-magenta)" } as React.CSSProperties}
        >
          <div className="dub-section-head">
            <div>
              <p className="dub-eyebrow">Browse</p>
              <h2 className="dub-section-title font-display text-2xl font-black text-[var(--color-ink)] sm:text-3xl">
                Pick a language or genre
              </h2>
            </div>
            <Link href="/hindi-dub/series" className="dub-section-link text-xs font-semibold text-[var(--color-cyan)]" prefetch={false}>
              All titles →
            </Link>
          </div>

          <StaggerGrid className="dub-chip-cloud mt-5 flex flex-wrap gap-2.5">
            {languageChips.map((item) => (
              <StaggerItem key={`lang-${item.language}`}>
                <Link
                  href={`/hindi-dub/series?language=${encodeURIComponent(item.language)}`}
                  className="dub-chip group inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-black/20 py-2 pl-8 pr-4 text-sm font-medium text-[var(--color-ink)]"
                  prefetch={false}
                >
                  <span>{item.language}</span>
                  <span className="dub-chip-count">{item.total.toLocaleString("en-IN")}</span>
                  <span className="dub-chip-arrow" aria-hidden="true">→</span>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGrid>

          <StaggerGrid className="dub-chip-cloud mt-4 flex flex-wrap gap-2.5">
            {genreChips.map((item) => (
              <StaggerItem key={`genre-${item.slug}`}>
                <Link
                  href={`/hindi-dub/series?genre=${encodeURIComponent(item.genre)}`}
                  className="dub-chip group inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-black/20 py-2 pl-8 pr-4 text-sm font-medium text-[var(--color-ink)]"
                  prefetch={false}
                >
                  <span>{item.genre}</span>
                  <span className="dub-chip-count">{item.total.toLocaleString("en-IN")}</span>
                  <span className="dub-chip-arrow" aria-hidden="true">→</span>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </section>
      </FadeIn>

      <FadeIn delay={0.14} className="mt-10">
        <IndianDubCatalogBrowser
          initial={{
            items: catalog.items,
            total: catalog.total,
            page: catalog.page,
            totalPages: catalog.totalPages,
          }}
          languages={languages}
        />
      </FadeIn>

      <div className="mt-8">
        <NativeBannerAd />
      </div>

      <LiveDubFeeds />

      <FadeIn className="mt-14 grid gap-5 lg:grid-cols-2">
        <section
          id="guides"
          className="dub-guide relative scroll-mt-24 overflow-hidden rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7 lg:p-8"
          style={{ "--dub-accent": "var(--color-violet)" } as React.CSSProperties}
        >
          <div className="dub-guide-glow pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full" />
          <div className="relative">
            <p className="dub-eyebrow">Start here</p>
            <h2 className="dub-section-title font-display mt-1.5 text-2xl font-black text-[var(--color-ink)] sm:text-3xl">
              Popular dub guides
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)]">
              Short explainers on dubbing history, languages, platforms and where each series is listed.
            </p>

            <StaggerGrid className="mt-5 grid gap-3 sm:grid-cols-2">
              {guides.map((guide) => (
                <StaggerItem key={guide.slug}>
                  <Link
                    href={`/indian-dubs/${guide.slug}`}
                    className="idub-guide-card group flex h-full items-start gap-3 rounded-xl border border-[var(--color-line)] bg-black/20 p-4"
                    prefetch={false}
                  >
                    <span className="idub-guide-mark font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-black">
                      {guide.name.charAt(0)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-[var(--color-ink)] transition group-hover:text-[var(--color-cyan)]">
                        {guide.name}
                      </span>
                      <span className="mt-1 block text-[11px] font-semibold text-[var(--color-violet)]">
                        {guide.languages.slice(0, 3).join(" · ")}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-[11px] leading-relaxed text-[var(--color-mute)]">
                        {guide.tagline}
                      </span>
                    </span>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerGrid>

            <Link href="/dubbed" className="dub-section-link mt-5 inline-flex text-xs font-semibold text-[var(--color-cyan)]" prefetch={false}>
              Browse all dub pages →
            </Link>
          </div>
        </section>

        <section
          className="dub-faq relative overflow-hidden rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7 lg:p-8"
          style={{ "--dub-accent": "var(--color-cyan)" } as React.CSSProperties}
        >
          <div className="dub-faq-glow pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full" />
          <div className="relative">
            <p className="dub-eyebrow">Good to know</p>
            <h2 className="dub-section-title font-display mt-1.5 text-2xl font-black text-[var(--color-ink)] sm:text-3xl">
              Indian dub FAQ
            </h2>
            <div className="mt-5 space-y-3">
              {[
                {
                  q: "Does ZyniVerse stream dubbed episodes?",
                  a: "No. This page helps you find listings, airing times and guides. Episodes play on the platform that holds the rights.",
                },
                {
                  q: "Are the times really in IST?",
                  a: "Yes. Countdowns and airing rows use Indian Standard Time. Entries without an announced date show TBA instead of a guessed slot.",
                },
                {
                  q: "Why can availability differ by region?",
                  a: "Audio tracks and streaming rights change by platform and country. Check the official listing before you watch.",
                },
              ].map((item) => (
                <div key={item.q} className="dub-faq-item rounded-xl border border-[var(--color-line)] bg-black/20 p-4">
                  <h3 className="flex gap-2.5 text-sm font-semibold text-[var(--color-ink)]">
                    <span className="dub-faq-mark" aria-hidden="true">?</span>
                    <span>{item.q}</span>
                  </h3>
                  <p className="mt-2 pl-[26px] text-xs leading-relaxed text-[var(--color-mute)]">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeIn>

      <FadeIn className="mt-10">
        <section
          className="dub-coverage relative overflow-hidden rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7 lg:p-8"
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
                Counts below come from the synced dub catalogue and airing table, not a hand-written list.
              </p>
            </div>
            <span className="dub-coverage-pill inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-black/25 px-3 py-1.5 text-xs text-[var(--color-mute)]">
              <span className="dub-live-dot" aria-hidden="true" />
              Updated regularly
            </span>
          </div>
          <StaggerGrid className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Catalogues checked", value: stats.sources.length.toLocaleString("en-IN") },
              { label: "Titles listed", value: stats.total.toLocaleString("en-IN") },
              { label: "Airing entries", value: stats.scheduleCount.toLocaleString("en-IN") },
              { label: "Last synced", value: syncedAt ? syncedAt.split(",")[0] : "—" },
            ].map((item) => (
              <StaggerItem key={item.label}>
                <div className="dub-coverage-stat h-full rounded-xl border border-[var(--color-line)] bg-black/20 p-4">
                  <p className="dub-coverage-stat-value font-display text-xl font-black text-[var(--color-ink)] sm:text-2xl">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--color-mute)]">{item.label}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </section>
      </FadeIn>

      <div className="mt-12">
        <NativeBannerAd />
      </div>
    </main>
  );
}
