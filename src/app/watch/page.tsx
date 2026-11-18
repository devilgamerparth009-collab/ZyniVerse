import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import {
  AniListUnavailableError,
  bestTitle,
  getMediaBatch,
  type MediaBasic,
} from "@/lib/anilist";
import { WATCH_GUIDE_IDS } from "@/lib/data/watch-guide-ids";
import AnimeUnavailableCard from "@/components/AnimeUnavailableCard";
import { PageTransition } from "@/components/PageTransition";

export const revalidate = 86400;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";
const FEATURED_GUIDE_COUNT = 60;
const FEATURED_IDS = WATCH_GUIDE_IDS.slice(0, FEATURED_GUIDE_COUNT).map((entry) => entry.id);
const GUIDE_YEARS = new Map(WATCH_GUIDE_IDS.map((entry) => [entry.id, entry.year]));

export const metadata: Metadata = {
  title: "Where to Watch Anime — Watch Guides",
  description:
    "Browse popular anime watch guides with legal streaming and Hindi dub availability information for India.",
  openGraph: {
    title: "Where to Watch Anime",
    description: "Open an anime guide for streaming and dub availability details.",
    url: `${BASE_URL}/watch`,
    type: "website",
  },
  alternates: { canonical: `${BASE_URL}/watch` },
};

const getCachedWatchGuides = unstable_cache(
  async (ids: number[]): Promise<MediaBasic[]> => {
    const chunks: number[][] = [];
    for (let index = 0; index < ids.length; index += 50) {
      chunks.push(ids.slice(index, index + 50));
    }
    const batches = await Promise.all(chunks.map((chunk) => getMediaBatch(chunk)));
    return batches.flat();
  },
  ["watch-guide-index-v1"],
  { revalidate: 86400, tags: ["anilist-catalog"] },
);

export default async function WatchIndexPage() {
  let media: MediaBasic[];
  try {
    media = await getCachedWatchGuides(FEATURED_IDS);
  } catch (error) {
    if (error instanceof AniListUnavailableError) {
      return <AnimeUnavailableCard href="/watch" />;
    }
    throw error;
  }

  const rank = new Map(FEATURED_IDS.map((id, index) => [id, index]));
  const guides = media
    .filter((item) => rank.has(item.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <nav className="mb-6 text-xs text-[var(--color-mute)]">
          <Link href="/" className="hover:text-[var(--color-cyan)]">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--color-ink)]">Watch guides</span>
        </nav>

        <section className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6 sm:p-9">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-cyan)]">
            Watch guides
          </p>
          <h1 className="mt-2 font-display text-3xl font-black sm:text-5xl">
            Where to watch anime
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)]">
            Open a guide to see legal streaming options and dubbing details for that
            title. The index below highlights {FEATURED_GUIDE_COUNT} popular guides
            from the {WATCH_GUIDE_IDS.length}-title guide catalogue.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/watch-order"
              className="rounded-full bg-[var(--color-cyan)] px-4 py-2 text-xs font-bold text-black transition-opacity hover:opacity-80"
            >
              Watch orders
            </Link>
            <Link
              href="/search"
              className="rounded-full border border-[var(--color-line)] px-4 py-2 text-xs font-bold text-[var(--color-ink)] transition-colors hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]"
            >
              Find another anime
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-xl font-bold">Popular guides</h2>
            <span className="font-mono text-xs text-[var(--color-mute)]">
              {guides.length} guides shown
            </span>
          </div>

          {guides.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {guides.map((item) => {
                const title = bestTitle(item.title);
                const cover = item.coverImage?.large || item.coverImage?.extraLarge || item.coverImage?.medium;
                const year = GUIDE_YEARS.get(item.id);

                return (
                  <Link
                    key={item.id}
                    href={`/watch/${item.id}`}
                    className="group overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface1)] transition-colors hover:border-[var(--color-cyan)]"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden bg-[var(--color-panel)]">
                      {cover ? (
                        <Image
                          src={cover}
                          alt={title}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center font-display text-3xl font-bold text-[var(--color-mute)]">
                          {title.charAt(0)}
                        </span>
                      )}
                      <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[10px] text-[var(--color-cyan)]">
                        #{(rank.get(item.id) ?? 0) + 1}
                      </span>
                    </div>
                    <div className="p-3">
                      <h3 className="line-clamp-2 text-xs font-bold text-[var(--color-ink)] group-hover:text-[var(--color-cyan)]">
                        {title}
                      </h3>
                      <p className="mt-1 truncate font-mono text-[10px] text-[var(--color-mute)]">
                        {[year, item.format].filter(Boolean).join(" · ")}
                      </p>
                      {item.averageScore ? (
                        <p className="mt-1 font-mono text-[10px] text-[var(--color-mute)]">
                          ★ {(item.averageScore / 10).toFixed(1)}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface1)] p-8 text-center">
              <p className="text-sm text-[var(--color-mute)]">
                Watch guide titles are unavailable right now. Please try again shortly.
              </p>
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
