import type { Metadata } from "next";
import Link from "next/link";
import DiceClient from "./DiceClient";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Anime Dice Roller — Pick a Random Anime to Watch",
  description:
    "Can't decide what to watch? Roll the anime dice. Pick from a custom list or your own ZyniVerse watchlist, choose 1–6 winners and get a fair, instant pick.",
  keywords: [
    "anime dice",
    "random anime picker",
    "what anime should i watch",
    "anime roulette",
    "random anime generator",
    "pick an anime for me",
    "watchlist randomizer",
  ],
  alternates: { canonical: `${BASE_URL}/tools/anime-dice` },
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime tools and trackers" }],
    title: "Anime Dice Roller — Pick a Random Anime to Watch",
    description: "Roll a fair dice over a custom list or your watchlist. Pick 1–6 anime in one tap.",
    url: `${BASE_URL}/tools/anime-dice`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@GuptaParth2857",
    title: "Anime Dice Roller — Pick a Random Anime",
    description: "Can't decide? Roll the dice over a custom list or your ZyniVerse watchlist.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "ZyniVerse Anime Dice Roller",
  url: `${BASE_URL}/tools/anime-dice`,
  applicationCategory: "EntertainmentApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript",
  description:
    "A free random anime picker. Roll one or more titles from a custom list or a ZyniVerse watchlist.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  isPartOf: { "@type": "WebSite", name: "ZyniVerse", url: BASE_URL },
};

export default function AnimeDicePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-[var(--color-mute)]">
          <Link href="/tools" className="hover:text-[var(--color-cyan)]">
            Tools
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--color-ink)]">Anime Dice</span>
        </nav>

        <header className="mb-8">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--color-cyan)]">
            Decision helper
          </p>
          <h1 className="font-display text-3xl font-bold text-[var(--color-ink)] sm:text-4xl">
            Anime dice roller
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)]">
            Paste your backlog, roll over your watchlist, or start with the sample
            list. Pick up to six winners in one roll — each title is removed from
            the pool so nothing repeats.
          </p>
        </header>

        <DiceClient />

        <section className="mt-10 rounded-2xl border border-white/10 bg-[var(--color-panel)]/30 p-5 text-sm leading-relaxed text-[var(--color-mute)]">
          <h2 className="mb-2 font-display text-lg font-bold text-[var(--color-ink)]">
            More ways to choose
          </h2>
          <p>
            Prefer a full-screen shuffle with trailers and autoplay? Use{" "}
            <Link href="/random" className="text-[var(--color-cyan)] underline decoration-dotted">
              Random Anime
            </Link>
            . Want the community&apos;s highest-rated picks instead? Browse{" "}
            <Link href="/top-anime" className="text-[var(--color-cyan)] underline decoration-dotted">
              Top Anime
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}
