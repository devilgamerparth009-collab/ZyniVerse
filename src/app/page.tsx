import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  getHomepageData, getAiringSchedule,
} from "@/lib/anilist";
import { withHomepageFallback } from "@/lib/homepage-fallback";
import { logError } from "@/lib/logger";
import { getDubOverview } from "@/lib/dub-import/queries";

// ISR, not per-request rendering. This was `force-dynamic` because a build-time
// prerender can be rate-limited by AniList (~30 req/min per IP) and the
// empty-data guard below then failed the whole deploy. Two things changed:
// every other dynamic route now exports an empty `generateStaticParams`, so the
// build no longer fires hundreds of AniList requests from one IP, and the
// AniList calls fall back to the Prisma-backed cache when the live fetch fails.
// The guard below is non-fatal too, so a bad prerender can never break a
// deploy — ISR simply regenerates the page in the background.
//
// One hour, not 48: when the build is rate-limited the page is still served
// with the `homepage-fallback` snapshot, but a short window means ISR replaces
// it with live data on the next request instead of leaving stale rails up for
// two days (that is exactly how the empty hero shipped on 2026-11-05).
export const revalidate = 3600; // 1 hour

export const metadata: Metadata = {
  title: "ZyniVerse — Anime Watch Order, Filler Guides & Episode Schedule",
  description:
    "Anime watch orders, filler guides for 200+ series, episode schedules and episode-by-episode breakdowns — plus manga details, character pages and Hindi, Tamil & Telugu dub tracking. No signup needed.",
  keywords: [
    "anime",
    "filler guides",
    "watch order",
    "anime schedule",
    "indian dubs",
    "anime community",
    "anime website",
    "zyverse",
    "anime tracker",
  ],
  alternates: {
    canonical: process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in",
  },
  openGraph: {
    locale: "en_US",
    title: "ZyniVerse — Anime Watch Order, Filler Guides & Schedule",
    description:
      "Watch orders, filler guides, episode schedules, manga details and dub tracking — all in one place.",
    url: process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZyniVerse — Anime Watch Order, Filler Guides & Schedule",
    description:
      "Watch orders, filler guides, episode schedules, manga details and dub tracking — all in one place.",
  },
};

import { FadeIn, PageTransition } from "@/components/PageTransition";
import AuroraParticles from "@/components/AuroraParticles";
import ChristmasCountdown from "@/components/ChristmasCountdown";
import RevealTitle from "@/components/RevealTitle";
import {
  DynamicSection as Section,
  DynamicMediaCarousel as MediaCarousel,
  DynamicOnAirTicker as OnAirTicker,
  DynamicExpandingFlexCard as ExpandingFlexCard,
  DynamicContinueWatching as ContinueWatching,
  DynamicRecommendations as Recommendations,
  DynamicFriendActivityFeed as FriendActivityFeed,
  DynamicMonthlyCalendar as MonthlyCalendar,
  DynamicGamificationWidget as GamificationWidget,
  DynamicHero3D as Hero3D,
  DynamicHorizontalScroll as HorizontalScroll,
} from "@/components/lazy";
import PersonalizedHero from "@/components/PersonalizedHero";
import AdBanner from "@/components/AdBanner";
import NativeBannerAd from "@/components/NativeBannerAd";
import QuoteOfTheDay from "@/components/QuoteOfTheDay";
import AnimeOfTheDay from "@/components/AnimeOfTheDay";
import FeaturedFeedbackCarousel from "@/components/FeaturedFeedbackCarousel";
import IndiaHub from "@/components/IndiaHub";
import WhyZyniVerse from "@/components/WhyZyniVerse";
import NeonBanner from "@/components/NeonBanner";
import BrandPartners from "@/components/BrandPartners";
import CommunityHub from "@/components/CommunityHub";
import DiscoverMore from "@/components/DiscoverMore";
import PoweredBy from "@/components/PoweredBy";
import {
  getHomeUserCount,
  getHomeLatestPosters,
  getHomeFeaturedTournament,
} from "@/lib/home-stats";
import { posterCategoryOf } from "@/lib/post-types";
import { DUBBED_ANIME_STATIC } from "@/lib/data/dubbed-static";

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`mx-auto max-w-7xl px-4 py-12 sm:px-6 ${className}`}>
      {children}
    </section>
  );
}

type FeaturedTournament = {
  id: string;
  title: string;
  description: string | null;
  size: number;
  mode: string;
  status: string;
  currentRound: number;
  qualifyingEndsAt: Date | null;
  roundEndsAt: Date | null;
  creator: { username: string };
  _count: { participants: number };
} | null;

async function loadAiringSchedule(): Promise<Awaited<ReturnType<typeof getAiringSchedule>>> {
  const now = Math.floor(Date.now() / 1000);
  return getAiringSchedule(now - 3600 * 6, now + 3600 * 18);
}

function featuredEndsInOf(featuredTournament: FeaturedTournament): string | null {
  if (!featuredTournament) return null;
  const d =
    featuredTournament.mode === "qualifying" ? featuredTournament.qualifyingEndsAt : featuredTournament.roundEndsAt;
  if (!d) return null;
  const days = Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
  if (featuredTournament.mode === "qualifying") {
    return days === 0 ? "Voting closes today" : `Voting ends in ${days} day${days === 1 ? "" : "s"}`;
  }
  return days === 0
    ? "This round closes today"
    : `Round ${featuredTournament.currentRound} ends in ${days} day${days === 1 ? "" : "s"}`;
}

export default async function Home() {
  // Every homepage read is wrapped so one failing source cannot break the
  // prerender. Community reads are cached in-process (`home-stats.ts`).
  const [homepage, tickerRes, userCountRes, latestPostersRes, featuredTournamentRes, dubOverviewRes] = await Promise.allSettled([
    getHomepageData(),
    loadAiringSchedule(),
    getHomeUserCount(),
    getHomeLatestPosters(),
    getHomeFeaturedTournament(),
    getDubOverview(),
  ] as const);

  // The homepage is statically prerendered, so whatever AniList returns during
  // `next build` is what gets baked into the HTML and served from the CDN.
  // AniList rate-limits builds (30 req/min per IP), and when that happens all
  // four rails come back empty — previously shipping a blank hero to every
  // visitor with no error anywhere. Fill any empty rail from the committed
  // snapshot so the page never prerenders without content.
  const homepageData = withHomepageFallback(
    homepage.status === "fulfilled" ? homepage.value : null,
  );

  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  const homepageFetch = homepage.status === "fulfilled" ? homepage.value : null;
  const liveHasAnyAnime = Boolean(
    homepageFetch &&
      (homepageFetch.trending.length > 0 ||
        homepageFetch.popular.length > 0 ||
        homepageFetch.upcoming.length > 0 ||
        homepageFetch.topRated.length > 0),
  );

  if (isBuild && !liveHasAnyAnime) {
    // Non-fatal: the page still ships with the committed snapshot below and ISR
    // refreshes it from the live AniList API within an hour. Keep the log so a
    // rate-limited build is visible in the Vercel build output.
    logError(
      new Error(
        "Homepage prerender produced no live AniList data. AniList rate-limits at 30 req/min " +
          "per IP and a build prerenders hundreds of pages from one IP, so the live fetch " +
          "was most likely rate-limited and the shared Prisma cache had nothing to fall back on. " +
          "Serving the committed homepage-fallback snapshot.",
      ),
    );
  }

  const trendingData = homepageData.trending;
  const popularData = homepageData.popular;
  const upcomingData = homepageData.upcoming;
  const topRatedData = homepageData.topRated;

  const ticker: Awaited<ReturnType<typeof getAiringSchedule>> = tickerRes.status === "fulfilled" ? tickerRes.value : [];
  const userCount = userCountRes.status === "fulfilled" ? userCountRes.value : 0;
  const latestPosters: { id: string; title: string; image: string | null; type: string }[] = latestPostersRes.status === "fulfilled" ? latestPostersRes.value : [];
  const featuredTournament: {
    id: string;
    title: string;
    description: string | null;
    size: number;
    mode: string;
    status: string;
    currentRound: number;
    qualifyingEndsAt: Date | null;
    roundEndsAt: Date | null;
    creator: { username: string };
    _count: { participants: number };
  } | null = featuredTournamentRes.status === "fulfilled" ? featuredTournamentRes.value : null;

  const featuredEndsIn = featuredEndsInOf(featuredTournament);

  const featuredHref = featuredTournament
    ? `/character-tournaments/${featuredTournament.id}`
    : "/character-tournaments";
  const featuredChip = featuredTournament
    ? featuredTournament.mode === "qualifying"
      ? "⚡ Qualifying — Vote Now"
      : "🔥 Live Bracket"
    : "🚀 Starting Soon";

  // Real, data-backed counts — the hero row previously advertised "1000+ dubs"
  // while the tracker only carried ~70 titles, which reads as inflated.
  const indianDubCount = DUBBED_ANIME_STATIC.filter(
    (d) => d.hasHindi || d.hasTamil || d.hasTelugu,
  ).length;

  const heroStats = {
    users: userCount,
    fillerGuides: 200,
    watchOrders: 40,
    indianDubs: indianDubCount,
  };

  // Same overview helper the APK uses. Failure is non-fatal: IndiaHub falls
  // back to the committed static catalogue snapshot instead of showing zeros.
  const dubOverview = dubOverviewRes.status === "fulfilled" ? dubOverviewRes.value : null;
  const dubHasData = Boolean(
    dubOverview &&
      (dubOverview.total > 0 ||
        dubOverview.languages.length > 0 ||
        dubOverview.genres.length > 0),
  );
  const dubHub = dubOverview && dubHasData
    ? {
        stats: {
          total: dubOverview.total,
          languages: dubOverview.languageCount,
          genres: dubOverview.genres.length,
          scheduleCount: dubOverview.scheduleCount,
          updatedAt: dubOverview.updatedAt,
        },
        languages: dubOverview.languages,
        genres: dubOverview.genres,
      }
    : undefined;

  return (
    <PageTransition>
      <div className="animate-page-in zy-home">
      <ChristmasCountdown />
      <FadeIn>
            <div className="lb-wrap mx-auto max-w-7xl px-4 pt-5 sm:px-6">
              <Link href={featuredHref} className="lb-card">
                <span className="lb-aura lb-aura--left" aria-hidden="true" />
                <span className="lb-aura lb-aura--right" aria-hidden="true" />
                <span className="lb-grid" aria-hidden="true" />
                <span className="lb-bracket" aria-hidden="true" />

                <div className="lb-body">
                  <div className="lb-main">
                    <div className="lb-kicker">
                      <span className="lb-chip lb-chip--live">{featuredChip}</span>
                      {featuredTournament && (
                        <>
                          <span className="lb-chip lb-chip--stat">
                            {featuredTournament.size} candidates
                          </span>
                          <span className="lb-byline">
                            by @{featuredTournament.creator.username}
                          </span>
                        </>
                      )}
                    </div>

                    <h2 className="lb-title">
                      {featuredTournament
                        ? featuredTournament.title
                        : "The Dream 16 — Biggest Anime Character Tournament"}
                    </h2>
                    <p className="lb-desc">
                      {featuredTournament
                        ? featuredTournament.description ||
                          "Anime characters going head-to-head — your vote decides."
                        : "64 anime characters, one favorite vote each. The Dream 16 advance to a 1v1 bracket — your vote picks the legends."}
                    </p>

                    <div className="lb-meta">
                      {featuredTournament ? (
                        <>
                          {featuredEndsIn && (
                            <span className="lb-meta-item lb-meta-item--time">
                              {featuredEndsIn}
                            </span>
                          )}
                          <span className="lb-meta-item">
                            {featuredTournament._count.participants} fighters
                          </span>
                        </>
                      ) : (
                        <span className="lb-meta-item">Voting opens soon</span>
                      )}
                      <span className="lb-cta">
                        {featuredTournament ? "Vote your fav →" : "Be first in line →"}
                      </span>
                    </div>
                  </div>

                  <div className="lb-poster">
                    <span className="lb-seed" aria-hidden="true">16</span>
                    <div className="lb-poster-frame">
                      <Image
                        src="/dream16.jpg"
                        alt="Dream 16 poster"
                        width={320}
                        height={384}
                        className="lb-poster-img"
                      />
                    </div>
                    <span className="lb-poster-tag">Dream 16</span>
                  </div>
                </div>
              </Link>
            </div>
          </FadeIn>
          <div className="relative overflow-hidden">
            <AuroraParticles className="z-0" />
            <div className="relative z-10">
              <Hero3D items={trendingData} stats={heroStats} />
              <PersonalizedHero className="absolute inset-0 z-20" fallbackItems={[]} />
            </div>
          </div>
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <AnimeOfTheDay companions={trendingData.slice(0, 6)} />
      </div>
      {/* India moat leads high on the page — it's the one thing no competitor has. */}
      <FadeIn delay={0.015}>
        <IndiaHub dub={dubHub} />
      </FadeIn>
      {latestPosters.length > 0 && (
        <FadeIn delay={0.01}>
          <AnimatedSection className="!py-10">
            <div className="mb-5 flex items-end justify-between">
              <div className="rounded-xl px-4 py-2">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-magenta)]">Main Attraction</p>
                <RevealTitle
                  as="h2"
                  text="Latest Posters"
                  className="font-display text-3xl font-bold sm:text-4xl"
                />
              </div>
              <Link href="/posts" className="shrink-0 text-sm text-[var(--color-mute)] hover:text-[var(--color-cyan)]">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {latestPosters.map((p) => {
                const cat = posterCategoryOf(p.type);
                return (
                  <Link
                    key={p.id}
                    href={`/posts/${p.id}`}
                    className="group relative block aspect-[4/5] overflow-hidden rounded-xl neon-rgb-border bg-[var(--color-panel)]"
                  >
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={p.title}
                        fill
                        sizes="(max-width: 640px) 50vw, 20vw"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-[var(--color-violet)]/70 to-[var(--color-magenta)]/70" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
                    <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                      {cat.emoji} {cat.label}
                    </span>
                    <p className="absolute inset-x-2.5 bottom-2 line-clamp-2 text-sm font-bold text-white drop-shadow">
                      {p.title}
                    </p>
                  </Link>
                );
              })}
            </div>
          </AnimatedSection>
        </FadeIn>
      )}
      <FadeIn delay={0.02}>
        <NeonBanner />
      </FadeIn>
      <FadeIn delay={0.03}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <GamificationWidget />
        </div>
      </FadeIn>
      <HorizontalScroll items={trendingData.slice(0, 20)} />
      <FadeIn delay={0.05}>
        <WhyZyniVerse />
      </FadeIn>
      <FadeIn delay={0.06}>
        <BrandPartners />
      </FadeIn>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
        <AdBanner placement="homepage" type="banner" />
      </div>
      <OnAirTicker items={ticker.slice(0, 20)} />

      <QuoteOfTheDay />

      <ContinueWatching />
      <Recommendations type="personalized" title="Handpicked for You" />

      {/* Friend Activity Feed */}
      <FadeIn delay={0.05}>
        <AnimatedSection className="!py-6">
          <FriendActivityFeed />
        </AnimatedSection>
      </FadeIn>

      <FadeIn>
        <AnimatedSection>
          <section className="trd-section">
            <span className="trd-halo" aria-hidden="true" />
            <span className="trd-beam" aria-hidden="true" />

            <div className="trd-shell">
              <div className="trd-head">
                <div>
                  <p className="trd-eyebrow">
                    <span className="trd-eyebrow-dot" aria-hidden="true" />
                    Right now
                  </p>
                  <h2 className="trd-title">Trending Anime</h2>
                  <span className="trd-title-line" aria-hidden="true" />
                </div>
                <div className="trd-head-side">
                  <span className="trd-count">
                    <strong>{String(Math.min(trendingData.length, 8)).padStart(2, "0")}</strong>
                    <span>{Math.min(trendingData.length, 8) === 1 ? "title" : "titles"}</span>
                  </span>
                  <Link href="/search?sort=TRENDING_DESC" className="trd-viewall">
                    View all →
                  </Link>
                </div>
              </div>

              <ExpandingFlexCard items={trendingData} />
            </div>
          </section>
        </AnimatedSection>
      </FadeIn>

      <FadeIn delay={0.1}>
        <AnimatedSection>
          <MediaCarousel eyebrow="All-time" title="Most Popular" viewAllTo="/search?sort=POPULARITY_DESC" items={popularData} rows={3} />
        </AnimatedSection>
      </FadeIn>

      {/* Native banner between Popular and Upcoming sections */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <NativeBannerAd />
      </div>

      <FadeIn delay={0.2}>
        <AnimatedSection>
          <Section framed eyebrow="Coming soon" title="Upcoming Releases" viewAllTo="/search?status=NOT_YET_RELEASED" items={upcomingData} />
        </AnimatedSection>
      </FadeIn>

      <FadeIn delay={0.3}>
        <AnimatedSection>
          <Section framed frameTone="critics" eyebrow="Critics' pick" title="Top Rated" viewAllTo="/top-anime" items={topRatedData} />
        </AnimatedSection>
      </FadeIn>

      {/* Community Engagement */}
      <FadeIn delay={0.4}>
        <AnimatedSection className="!py-8">
          <CommunityHub />
        </AnimatedSection>
      </FadeIn>

      {/* Featured Feedback */}
      <FadeIn delay={0.42}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <FeaturedFeedbackCarousel />
        </div>
      </FadeIn>

      {/* Monthly Calendar */}
      <FadeIn delay={0.45}>
        <AnimatedSection className="!py-6">
          <MonthlyCalendar />
        </AnimatedSection>
      </FadeIn>

      {/* Powered By */}
      <FadeIn delay={0.46}>
        <AnimatedSection className="!py-6">
          <PoweredBy />
        </AnimatedSection>
      </FadeIn>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-16">
        <FadeIn>
          <DiscoverMore />
        </FadeIn>
      </div>
      </div>
    </PageTransition>
  );
}


