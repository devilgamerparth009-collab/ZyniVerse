import type { Metadata } from "next";
import Link from "next/link";
import { bestTitle, getAiringSchedule, type AiringScheduleEntry } from "@/lib/anilist";
import { DAY_MS, startOfWeekIST } from "@/lib/ist";
import ScheduleBoard from "./ScheduleBoard";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";
const SITE_NAME = "ZyniVerse";

export const metadata: Metadata = {
  title: "Anime Schedule in IST — Weekly Broadcast Board",
  description:
    "This week's anime broadcast schedule in IST: episode times, live ON AIR status and what's airing next — pulled live from AniList with no filler.",
  keywords: [
    "anime schedule", "anime airing schedule", "anime broadcast times ist", "this week anime schedule",
    "anime release time ist", "next episode time", "anime calendar ist", "anime airing today ist",
    "new anime episodes this week", "anime tv schedule india",
  ],
  alternates: { canonical: `${BASE_URL}/schedule` },
  robots: { index: true, follow: true },
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
    title: "Anime Schedule in IST — Weekly Broadcast Board",
    description: "This week's anime broadcast schedule in IST with live ON AIR status — pulled live from AniList.",
    url: `${BASE_URL}/schedule`,
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    site: "@GuptaParth2857",
    title: "Anime Schedule in IST — What's On This Week",
    description: "Episode times, live ON AIR status and what's airing next — in IST.",
  },
};

// ISR (5 min) instead of per-request rendering: the CDN edge serves a cached
// HTML snapshot in ~50-100ms with zero serverless cold start, and revalidates
// in the background. All time-sensitive parts — ON AIR rows, countdowns, IST
// week roll-over — are client-driven in the board, which re-anchors to the new
// week within 30s of a Sunday boundary, so a ≤5min-stale snapshot is invisible.
// `loading.tsx` streams the skeleton while the first render generates.
//
// Kept at 15 minutes on purpose: an earlier 7-day window meant a single AniList
// rate-limit response was baked into the page for a whole week. 15 min is still
// cheap (96 renders/day) and lets a recovered upstream heal the page quickly.
// 1 hour: balance schedule freshness with ISR/function pressure.
export const revalidate = 3600;

/** Schedule-specific structured data so the board can win rich results. */
function buildScheduleJsonLd(schedule: AiringScheduleEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "This week's anime airing schedule (IST)",
    url: `${BASE_URL}/schedule`,
    numberOfItems: schedule.length,
    itemListElement: schedule.slice(0, 50).map((item, i) => {
      const title = bestTitle(item.media.title);
      const mediaUrl = `${BASE_URL}/anime/${item.media.id}`;
      return {
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "TVEpisode",
          name: `${title} — Episode ${item.episode}`,
          episodeNumber: item.episode,
          datePublished: new Date(item.airingAt * 1000).toISOString(),
          url: mediaUrl,
          partOfSeries: { "@type": "TVSeries", name: title, url: mediaUrl },
        },
      };
    }),
  };
}

export default async function SchedulePage() {
  const weekStartMs = startOfWeekIST(0);
  const fromSec = Math.floor(weekStartMs / 1000);
  const toSec = Math.floor((weekStartMs + 7 * DAY_MS) / 1000);

  let schedule: AiringScheduleEntry[] = [];
  let error: string | null = null;
  try {
    schedule = await getAiringSchedule(fromSec, toSec);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load the schedule.";
  }

  // The initial week rides in the SSR payload, so the client draws the full
  // board on first paint without a round-trip (the board self-heals: it retries
  // once if `error` is set, and fetches neighbouring weeks on navigation).
  return (
    <>
      {schedule.length > 0 && (
        <script
          type="application/ld+json"
          // JSON-LD is data, not user HTML; stringify is safe here.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildScheduleJsonLd(schedule)) }}
        />
      )}
      <ScheduleBoard
        initialSchedule={schedule}
        initialWeekStartMs={weekStartMs}
        initialError={error}
      />
      <section className="sbd-help mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <div className="sbd-help-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
          <span className="sbd-help-glow" aria-hidden="true" />
          <span className="sbd-help-scan" aria-hidden="true" />

          <div className="sbd-help-head relative">
            <span className="sbd-help-badge" aria-hidden="true">
              <span className="sbd-help-badge-core">?</span>
            </span>
            <div>
              <p className="sbd-help-kicker">Quick guide</p>
              <h2 className="sbd-help-title font-display text-xl font-bold text-white sm:text-2xl">
                How to use the anime schedule
              </h2>
            </div>
          </div>

          <p className="sbd-help-lead relative mt-4 text-sm leading-relaxed text-[var(--color-mute)]">
            This schedule shows anime episode air times converted to IST. Use it to track what is airing today, what is coming next, and which episodes are already on air.
            Times come from public schedule metadata and can change if broadcasters or platforms update their release plans.
          </p>

          <div className="sbd-help-grid relative mt-6 grid gap-4 text-sm sm:grid-cols-3">
            <article className="sbd-help-card rounded-2xl border border-[var(--color-line)] p-4">
              <span className="sbd-help-icon sbd-help-icon-ist" aria-hidden="true">◷</span>
              <p className="sbd-help-card-title font-semibold text-white">IST times</p>
              <p className="sbd-help-card-text mt-1 text-xs text-[var(--color-mute)]">All times are shown in Indian Standard Time for easier tracking in India.</p>
            </article>
            <article className="sbd-help-card rounded-2xl border border-[var(--color-line)] p-4">
              <span className="sbd-help-icon sbd-help-icon-live" aria-hidden="true">⟳</span>
              <p className="sbd-help-card-title font-semibold text-white">Live updates</p>
              <p className="sbd-help-card-text mt-1 text-xs text-[var(--color-mute)]">The board refreshes regularly so new episodes and timing changes appear without manual reloads.</p>
            </article>
            <article className="sbd-help-card rounded-2xl border border-[var(--color-line)] p-4">
              <span className="sbd-help-icon sbd-help-icon-verify" aria-hidden="true">✓</span>
              <p className="sbd-help-card-title font-semibold text-white">Verify official release</p>
              <p className="sbd-help-card-text mt-1 text-xs text-[var(--color-mute)]">For streaming availability, always confirm on the official platform or broadcaster.</p>
            </article>
          </div>

          <div className="sbd-help-divider relative" aria-hidden="true" />

          <div className="sbd-help-faq relative">
            <div className="sbd-help-faq-head">
              <span className="sbd-help-faq-mark" aria-hidden="true" />
              <h3 className="font-semibold text-white">Schedule FAQ</h3>
            </div>
            <div className="sbd-help-faq-grid mt-4 grid gap-3 lg:grid-cols-2">
              <div className="sbd-help-qa">
                <span className="sbd-help-qnum" aria-hidden="true">01</span>
                <div>
                  <p className="sbd-help-qtext"><span className="text-white">Why did an episode time change?</span></p>
                  <p className="sbd-help-answer">Studios, platforms, or broadcasters can delay or reschedule releases. We update the board when source data changes.</p>
                </div>
              </div>
              <div className="sbd-help-qa">
                <span className="sbd-help-qnum" aria-hidden="true">02</span>
                <div>
                  <p className="sbd-help-qtext"><span className="text-white">Does this include Hindi dub schedules?</span></p>
                  <p className="sbd-help-answer">This page focuses on anime broadcast times. For Hindi/regional dub schedules, visit <Link href="/hindi-dub/schedule" className="sbd-help-link">Hindi Dub Schedule</Link>.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
