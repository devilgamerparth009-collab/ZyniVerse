import type { Metadata } from "next";
import Link from "next/link";
import AgeGate from "@/components/AgeGate";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Mature & 18+ Anime Metadata — Adults Only",
  description:
    "An 18+ guide to mature anime and doujinshi metadata: content warnings, legal external sources and ZyniVerse's metadata-only policy. No explicit media is hosted.",
  alternates: { canonical: `${BASE_URL}/mature` },
  // Adult-adjacent landing page: keep it out of every index and image index.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

const SOURCES = [
  {
    name: "MangaDex",
    href: "https://mangadex.org/",
    note: "Community manga catalogue with per-title content ratings (safe, suggestive, erotica). ZyniVerse reads its public metadata API only.",
  },
  {
    name: "AniList",
    href: "https://anilist.co/search/anime?isAdult=true",
    note: "Anime and manga database with an explicit adult filter and community content tags.",
  },
  {
    name: "MyAnimeList",
    href: "https://myanimelist.net/anime/genre/12/Hentai",
    note: "Long-running database with genre and theme metadata, including mature categories.",
  },
];

const WARNINGS = [
  "Sexual content references and adult themes",
  "Graphic violence and gore in some titles",
  "Strong language",
  "Drug and alcohol references",
  "Mental-health and other sensitive subject matter",
];

export default function MatureHubPage() {
  return (
    <AgeGate storageKey="zyniverse:age-verified" subject="the 18+ metadata hub">
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <header className="mb-10">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--color-magenta)]">
            Adults only · 18+
          </p>
          <h1 className="font-display text-3xl font-bold text-[var(--color-ink)] sm:text-4xl">
            Mature &amp; 18+ metadata hub
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--color-mute)]">
            This page explains how ZyniVerse handles mature titles. We publish
            catalogue metadata — titles, tags, ratings and release information —
            and link to lawful external sources. We do not host, mirror or embed
            explicit images, video or downloads.
          </p>
        </header>

        <section className="mb-10 rounded-3xl border border-[var(--color-magenta)]/30 bg-[var(--color-panel)]/40 p-6">
          <h2 className="mb-3 font-display text-xl font-bold text-[var(--color-ink)]">
            Content warnings
          </h2>
          <ul className="grid gap-2 text-sm text-[var(--color-mute)] sm:grid-cols-2">
            {WARNINGS.map((warning) => (
              <li key={warning} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 text-[var(--color-magenta)]">
                  ▸
                </span>
                {warning}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 font-display text-xl font-bold text-[var(--color-ink)]">
            What is available on ZyniVerse
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/doujinshi"
              className="group rounded-2xl border border-white/10 bg-[var(--color-panel)]/40 p-5 transition-colors hover:border-[var(--color-magenta)]/40"
            >
              <h3 className="font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-magenta)]">
                Doujinshi catalogue
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-mute)]">
                Search, filter and track fan works using MangaDex metadata. Covers,
                where shown, are the source&apos;s standard catalogue thumbnails.
              </p>
            </Link>
            <div className="rounded-2xl border border-white/10 bg-[var(--color-panel)]/40 p-5">
              <h3 className="font-semibold text-[var(--color-ink)]">Mature anime tags</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-mute)]">
                Adult titles appear in search and seasonal listings with the same
                metadata fields as any other title, including genre and theme tags.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-1 font-display text-xl font-bold text-[var(--color-ink)]">
            Lawful external sources
          </h2>
          <p className="mb-4 text-sm text-[var(--color-mute)]">
            These sites set their own age gates and terms. ZyniVerse is not
            responsible for content hosted elsewhere.
          </p>
          <ul className="space-y-3">
            {SOURCES.map((source) => (
              <li
                key={source.name}
                className="rounded-2xl border border-white/10 bg-[var(--color-panel)]/30 p-4"
              >
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="font-semibold text-[var(--color-cyan)] underline decoration-dotted underline-offset-4 hover:text-[var(--color-ink)]"
                >
                  {source.name} ↗
                </a>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-mute)]">
                  {source.note}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[var(--color-panel)]/30 p-5 text-sm leading-relaxed text-[var(--color-mute)]">
          <h2 className="mb-2 font-display text-lg font-bold text-[var(--color-ink)]">
            Policy summary
          </h2>
          <p>
            No explicit imagery or video is stored, proxied or embedded by
            ZyniVerse. Adult surfaces are age-gated, excluded from the sitemap and
            marked <code className="rounded bg-black/40 px-1 py-0.5">noindex</code>{" "}
            so they are not served to search engines. Reports of illegal content
            can be sent through our{" "}
            <Link href="/contact" className="underline hover:text-[var(--color-cyan)]">
              contact page
            </Link>
            .
          </p>
        </section>
      </main>
    </AgeGate>
  );
}
