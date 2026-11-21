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
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-white">How to use the manga tracker</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-mute)]">
            Browse trending, popular, or top-rated manga, open a title for details, and track your reading progress in your list.
            ZyniVerse provides discovery and tracking tools; we do not host manga chapters.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3 text-sm">
            <div className="rounded-xl border border-[var(--color-line)] bg-black/20 p-4">
              <p className="font-semibold text-white">Discover</p>
              <p className="mt-1 text-xs text-[var(--color-mute)]">Find manga by trends, ratings, and search.</p>
            </div>
            <div className="rounded-xl border border-[var(--color-line)] bg-black/20 p-4">
              <p className="font-semibold text-white">Track</p>
              <p className="mt-1 text-xs text-[var(--color-mute)]">Save progress, status, and chapters you have read.</p>
            </div>
            <div className="rounded-xl border border-[var(--color-line)] bg-black/20 p-4">
              <p className="font-semibold text-white">Verify sources</p>
              <p className="mt-1 text-xs text-[var(--color-mute)]">Check official publishers/platforms for legal reading availability.</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-[var(--color-mute)]">
            <h3 className="font-semibold text-white">Manga FAQ</h3>
            <p><span className="text-white">Can I read manga on ZyniVerse?</span> ZyniVerse does not host manga chapters. We help you discover titles, track progress, and find information.</p>
            <p><span className="text-white">Where does manga data come from?</span> We use public metadata sources such as AniList and display it with our own tracking and discovery interface.</p>
          </div>
        </div>
      </section>
    </>
  );
}
