import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { AniListUnavailableError, getGenres } from "@/lib/anilist";
import AnimeUnavailableCard from "@/components/AnimeUnavailableCard";
import { PageTransition } from "@/components/PageTransition";

export const revalidate = 86400;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Browse Anime by Genre",
  description:
    "Browse the complete anime genre directory on ZyniVerse and open curated lists for action, romance, fantasy, horror and more.",
  openGraph: {
    title: "Browse Anime by Genre",
    description: "Open a genre to see popular anime and manga in that category.",
    url: `${BASE_URL}/genres`,
    type: "website",
  },
  alternates: { canonical: `${BASE_URL}/genres` },
};

const getCachedGenres = unstable_cache(
  async () => getGenres(),
  ["anilist-genres-v1"],
  { revalidate: 86400, tags: ["anilist-catalog"] },
);

export default async function GenresPage() {
  let genres: string[];
  try {
    genres = await getCachedGenres();
  } catch (error) {
    if (error instanceof AniListUnavailableError) {
      return <AnimeUnavailableCard href="/genres" />;
    }
    throw error;
  }

  const sortedGenres = Array.from(new Set(genres.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <nav className="mb-6 text-xs text-[var(--color-mute)]">
          <Link href="/" className="hover:text-[var(--color-cyan)]">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--color-ink)]">Genres</span>
        </nav>

        <section className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6 sm:p-9">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-cyan)]">
            Catalogue
          </p>
          <h1 className="mt-2 font-display text-3xl font-black sm:text-5xl">
            Browse by genre
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)]">
            Pick a genre to see popular anime and manga in that category. Lists are
            built from catalogue metadata, so every destination below opens a real
            genre page.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/top-anime"
              className="rounded-full bg-[var(--color-cyan)] px-4 py-2 text-xs font-bold text-black transition-opacity hover:opacity-80"
            >
              Top anime
            </Link>
            <Link
              href="/seasonal"
              className="rounded-full border border-[var(--color-line)] px-4 py-2 text-xs font-bold text-[var(--color-ink)] transition-colors hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]"
            >
              Seasonal picks
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-xl font-bold">All genres</h2>
            <span className="font-mono text-xs text-[var(--color-mute)]">
              {sortedGenres.length} categories
            </span>
          </div>

          {sortedGenres.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {sortedGenres.map((genre) => (
                <Link
                  key={genre}
                  href={`/genre/${encodeURIComponent(genre)}`}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface1)] px-4 py-4 transition-colors hover:border-[var(--color-cyan)]"
                >
                  <span className="text-sm font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-cyan)]">
                    {genre}
                  </span>
                  <span aria-hidden className="text-sm text-[var(--color-mute)]">
                    ↗
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface1)] p-8 text-center">
              <p className="text-sm text-[var(--color-mute)]">
                No genres are available right now. Try the catalogue again shortly.
              </p>
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
