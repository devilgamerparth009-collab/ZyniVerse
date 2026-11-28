import type { Metadata } from "next";
import { getMangaTrending, bestTitle, type Media } from "@/lib/anilist";
import MangaBrowseClient from "./client";

// ISR: refresh the server-rendered first tab every 6 hours. An AniList
// hiccup degrades to an empty grid, which the client immediately refetches.
export const revalidate = 172800; // 12 hours (was 6 hours)

const SITE = "https://zyverse.in";

export const metadata: Metadata = {
  title: "Manga Tracker — Track Your Reading Progress Free",
  description:
    "Track your manga reading across 1000+ series. Never lose your place. Discover trending manga, manage your collection & get recommendations.",
  keywords: [
    "manga tracker",
    "manga reading list",
    "manga progress tracker",
    "read manga online",
    "manga recommendations",
    "manga list",
  ],
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
    title: "Manga Tracker — Track Your Reading Progress Free",
    description:
      "Track your manga reading across 1000+ series. Never lose your place.",
    url: `${SITE}/manga`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@GuptaParth2857",
    title: "Manga Tracker — Track Your Reading Progress Free",
    description:
      "Track your manga reading across 1000+ series. Never lose your place.",
  },
  alternates: { canonical: `${SITE}/manga` },
  robots: { index: true, follow: true },
};

export default async function MangaPage() {
  let trending: Media[] = [];
  try {
    trending = await getMangaTrending(24);
  } catch {
    trending = [];
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Trending Manga",
    numberOfItems: trending.length,
    itemListElement: trending.slice(0, 24).map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Book",
        name: bestTitle(m.title),
        url: `${SITE}/manga/${m.id}`,
        image:
          m.coverImage?.extraLarge || m.coverImage?.large || undefined,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <MangaBrowseClient initialManga={trending} />
      <section className="mtk-outro mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <div className="mtk-how rounded-3xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-6 sm:p-9">
          <div className="mtk-how-frame" aria-hidden />
          <div className="mtk-how-head">
            <div className="mtk-how-head-copy">
              <p className="mtk-how-kicker font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--color-cyan)]">
                <span className="mtk-how-kicker-dot" aria-hidden />
                Reader&apos;s guide
                <span className="mtk-how-kicker-line" aria-hidden />
              </p>
              <h2 className="mtk-how-title mt-3 font-display text-2xl font-bold text-white sm:text-3xl">
                How to use the <span className="mtk-how-title-accent">manga tracker</span>
              </h2>
              <p className="mtk-how-lead mt-4 text-sm leading-relaxed text-[var(--color-mute)]">
                Browse trending, popular, or top-rated manga, open a title for details, and track your reading progress in your list.
                ZyniVerse provides discovery and tracking tools; we do not host manga chapters.
              </p>
            </div>
            <div className="mtk-how-orbit" aria-hidden>
              <span className="mtk-how-orbit-ring" />
              <span className="mtk-how-orbit-ring mtk-how-orbit-ring-inner" />
              <span className="mtk-how-orbit-core">M</span>
              <span className="mtk-how-orbit-dot mtk-how-orbit-dot-a" />
              <span className="mtk-how-orbit-dot mtk-how-orbit-dot-b" />
            </div>
          </div>

          <div className="mtk-how-flow mt-9 grid gap-4 text-sm sm:grid-cols-3">
            <div className="mtk-how-item rounded-2xl border border-[var(--color-line)] bg-black/20 p-5">
              <span className="mtk-how-step" aria-hidden>01</span>
              <span className="mtk-how-icon" aria-hidden>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                  <path d="M19 16l0.8 2.2L22 19l-2.2 0.8L19 22l-0.8-2.2L16 19l2.2-0.8L19 16z" />
                </svg>
              </span>
              <p className="mtk-how-step-title mt-4 font-semibold text-white">Discover</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-mute)]">Find manga by trends, ratings, and search.</p>
              <span className="mtk-how-tick" aria-hidden />
            </div>
            <div className="mtk-how-item rounded-2xl border border-[var(--color-line)] bg-black/20 p-5">
              <span className="mtk-how-step" aria-hidden>02</span>
              <span className="mtk-how-icon" aria-hidden>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 5a2 2 0 012-2h13v18l-6-4-6 4V5z" />
                  <path d="M8 8h7M8 12h5" />
                </svg>
              </span>
              <p className="mtk-how-step-title mt-4 font-semibold text-white">Track</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-mute)]">Save progress, status, and chapters you have read.</p>
              <span className="mtk-how-tick" aria-hidden />
            </div>
            <div className="mtk-how-item rounded-2xl border border-[var(--color-line)] bg-black/20 p-5">
              <span className="mtk-how-step" aria-hidden>03</span>
              <span className="mtk-how-icon" aria-hidden>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <p className="mtk-how-step-title mt-4 font-semibold text-white">Verify sources</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-mute)]">Check official publishers/platforms for legal reading availability.</p>
            </div>
          </div>

          <div className="mtk-faq mt-8 text-sm text-[var(--color-mute)]">
            <div className="mtk-faq-aside">
              <p className="mtk-faq-eyebrow font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--mtk-cyan)]">FAQ / GOOD TO KNOW</p>
              <h3 className="mtk-faq-title mt-2 font-display text-lg font-bold text-white">Manga FAQ</h3>
              <p className="mtk-faq-aside-copy mt-2 text-xs leading-relaxed">Quick answers about reading and catalog data on ZyniVerse.</p>
              <span className="mtk-faq-aside-glyph" aria-hidden>?</span>
            </div>
            <div className="mtk-faq-list">
              <details className="mtk-faq-item" open>
                <summary>
                  <span className="mtk-faq-index" aria-hidden>01</span>
                  <span className="mtk-faq-q">Can I read manga on ZyniVerse?</span>
                  <span className="mtk-faq-toggle" aria-hidden>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </summary>
                <div className="mtk-faq-a-wrap">
                  <p className="mtk-faq-a">ZyniVerse does not host manga chapters. We help you discover titles, track progress, and find information.</p>
                </div>
              </details>
              <details className="mtk-faq-item" open>
                <summary>
                  <span className="mtk-faq-index" aria-hidden>02</span>
                  <span className="mtk-faq-q">Where does manga data come from?</span>
                  <span className="mtk-faq-toggle" aria-hidden>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </summary>
                <div className="mtk-faq-a-wrap">
                  <p className="mtk-faq-a">We use public metadata sources such as AniList and display it with our own tracking and discovery interface. The catalog refreshes automatically, so brand-new titles can take up to a day to appear.</p>
                </div>
              </details>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
