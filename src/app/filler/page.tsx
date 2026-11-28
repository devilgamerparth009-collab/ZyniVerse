import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import AffiliateLink from "@/components/AffiliateLink";
import PlayAsiaPill from "@/components/PlayAsiaPill";
import FillerSearch from "@/components/FillerSearch";
import AdBanner from "@/components/AdBanner";
import NativeBannerAd from "@/components/NativeBannerAd";
import { getPopularFillerAnime, getFillerData } from "@/lib/filler";

export const metadata: Metadata = {
  title: "Anime Filler List — Skip Filler in Naruto, One Piece, Bleach (2026 Updated)",
  description:
    "Stop wasting time on filler. Every episode of 200+ anime marked as canon, filler, or mixed. Naruto (40% filler), One Piece, Bleach, Boruto & more — updated weekly.",
  keywords: [
    "anime filler list", "naruto filler list", "one piece filler list",
    "bleach filler list", "boruto filler list", "dragon ball filler list",
    "skip filler episodes", "anime canon episodes", "filler guide 2026",
    "which episodes to skip anime", "naruto shippuden filler list",
  ],
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
    title: "Anime Filler List — Skip Filler in 200+ Anime (2026)",
    description: "Stop wasting time on filler. Every episode marked as canon, filler, or mixed. Free tool.",
    url: "https://zyverse.in/filler",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@GuptaParth2857",
    title: "Anime Filler List — Skip Filler in 200+ Anime",
    description: "Every episode marked as canon, filler, or mixed. Naruto, One Piece, Bleach & more.",
  },
  alternates: {
    canonical: "https://zyverse.in/filler",
  },
  robots: { index: true, follow: true },
};

export const revalidate = 259200; // 24 hours - reduced ISR writes

export default async function FillerListingPage() {
  const [popular, all] = await Promise.allSettled([
    getPopularFillerAnime(20),
    getFillerData(),
  ]);
  const popularAnime = popular.status === "fulfilled" ? popular.value : [];
  const allShows = all.status === "fulfilled" ? all.value : [];
  const allShowsSorted = [...allShows].sort((a, b) => a.title.localeCompare(b.title));
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 animate-page-in">
      {/* Breadcrumbs */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--color-mute)]">
        <Link href="/" className="hover:text-[var(--color-cyan)] transition-colors">Home</Link>
        <span>/</span>
        <span className="text-[var(--color-ink)]">Filler Guides</span>
      </nav>

      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-magenta)]">Filler Guides</p>
        <div className="neon-rgb-border rounded-xl px-4 py-2 inline-block">
          <h1 className="font-display text-3xl font-bold sm:text-4xl mt-1">Anime Filler List</h1>
        </div>
        <p className="mt-2 text-[var(--color-mute)] max-w-2xl">
          Complete filler guides for popular anime. Search any anime below or browse the list to see exactly which episodes are canon and which are filler.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-8 max-w-xl">
        <FillerSearch />
      </div>

      {/* Affiliate CTA */}
      <div className="mb-8 flex flex-wrap gap-3">
        <AffiliateLink partner="crunchyroll" path="https://www.crunchyroll.com"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#F47521] to-[#f59e0b] px-5 py-2.5 text-sm font-bold text-black hover:opacity-90 transition-opacity"
        >▶ Watch on Crunchyroll</AffiliateLink>
        <AffiliateLink partner="amazon" path="https://www.amazon.in/s?k=anime+blu+ray"
          className="inline-flex items-center gap-2 rounded-full neon-rgb-border px-5 py-2.5 text-sm font-semibold text-[var(--color-mute)] hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)] transition-all"
        >📦 Buy Anime on Amazon</AffiliateLink>
        <PlayAsiaPill query="anime blu ray" label="Play-Asia Blu-rays" />
      </div>

      <div className="mb-6 max-w-[728px] mx-auto">
        <AdBanner placement="filler" type="banner" />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-[var(--color-magenta)]" />
        <h2 className="font-display text-lg font-bold">Popular Filler Guides</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {popularAnime.map((anime) => (
          <Link
            key={anime.id}
            href={`/anime/${anime.id}/filler`}
            className="neon-premium rounded-xl no-underline group"
          >
            <div className="neon-premium-track rounded-xl" />
            <div className="neon-premium-overlay rounded-[10.5px]" />
            <div className="neon-premium-content p-3">
              <div className="flex items-center gap-3">
                {anime.coverImage ? (
                  <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--color-line)]">
                    <Image
                      src={anime.coverImage}
                      alt={anime.title}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-cyan)]/10 to-[var(--color-magenta)]/10 border border-[var(--color-line)]">
                    <span className="text-[8px] text-[var(--color-mute)]">N/A</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-magenta)]/10 text-xs font-bold font-mono text-[var(--color-magenta)] group-hover:bg-[var(--color-magenta)]/20 transition-colors">
                      {anime.fillerPct}%
                    </div>
                    <p className="font-semibold text-sm truncate group-hover:text-[var(--color-cyan)] transition-colors">{anime.title}</p>
                  </div>
                  <p className="text-[10px] text-[var(--color-mute)] mt-0.5">{anime.episodes} episodes · {anime.fillerPct}% filler</p>
                </div>
              </div>
              <div className="mt-3 flex h-1.5 rounded-full overflow-hidden bg-[var(--color-line)]">
                <div className="h-full rounded-full bg-green-500" style={{ width: `${anime.canonPct}%` }} title={`${anime.canonPct}% canon`} />
                {anime.mixedPct > 0 && <div className="h-full rounded-full bg-amber-500" style={{ width: `${anime.mixedPct}%` }} />}
                <div className="h-full rounded-full bg-red-500" style={{ width: `${anime.fillerPct}%` }} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {allShowsSorted.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-[var(--color-cyan)]" />
            <h2 className="font-display text-lg font-bold">Browse All Filler Guides</h2>
            <span className="rounded-full bg-[var(--color-cyan)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--color-cyan)]">
              {allShowsSorted.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allShowsSorted.map((s) => (
              <Link
                key={s.slug}
                href={`/filler/${s.slug}`}
                className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel)]/60 px-3 py-1.5 text-xs font-semibold text-[var(--color-mute)] hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)] hover:bg-[var(--color-cyan)]/5 transition-all"
              >
                {s.title} Filler List
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-white">How to use this filler guide</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-mute)]">
          Pick an anime, open its guide, and check each episode label before you watch. Use canon episodes to follow the main story,
          mixed episodes when you want extra context, and filler episodes when you want optional side stories or want to save time.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <p className="text-sm font-semibold text-green-400">Canon</p>
            <p className="mt-1 text-xs text-[var(--color-mute)]">Follows the original story. Usually safe to watch if you want the main plot.</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-sm font-semibold text-amber-400">Mixed</p>
            <p className="mt-1 text-xs text-[var(--color-mute)]">Contains both canon and filler material. Watch if you want full context.</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm font-semibold text-red-400">Filler</p>
            <p className="mt-1 text-xs text-[var(--color-mute)]">Not part of the main source story. Optional for most viewers.</p>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/40 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-white">Filler guide FAQ</h2>
        <div className="mt-4 space-y-4 text-sm text-[var(--color-mute)]">
          <div>
            <h3 className="font-semibold text-white">Are filler episodes always bad?</h3>
            <p className="mt-1">No. Some filler episodes are fun character stories. They are usually optional for the main plot, but you can still watch them if you enjoy the series.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white">Where does ZyniVerse get filler data?</h3>
            <p className="mt-1">We combine community-reviewed filler lists, episode metadata, and manual checks for popular titles. Episode classifications can change when better source information becomes available.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white">Should I skip mixed episodes?</h3>
            <p className="mt-1">If you only want main-story canon, you can skip many mixed episodes, but check the note first. Some mixed episodes include important scenes.</p>
          </div>
        </div>
      </section>

      {/* Native banner after filler list */}
      <NativeBannerAd className="mt-8" />
    </div>
  );
}
