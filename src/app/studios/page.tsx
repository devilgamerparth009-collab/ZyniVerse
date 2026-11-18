import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import {
  AniListUnavailableError,
  bestTitle,
  getPopular,
  type Media,
} from "@/lib/anilist";
import AnimeUnavailableCard from "@/components/AnimeUnavailableCard";
import { PageTransition } from "@/components/PageTransition";

export const revalidate = 86400;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Anime Studios Directory",
  description:
    "Explore the animation studios behind popular anime. Open a studio to see its titles and production credits.",
  openGraph: {
    title: "Anime Studios Directory",
    description: "Browse animation studios and the popular titles they produced.",
    url: `${BASE_URL}/studios`,
    type: "website",
  },
  alternates: { canonical: `${BASE_URL}/studios` },
};

interface StudioSummary {
  id: number;
  name: string;
  titles: number;
  notable: string;
}

const getCachedPopular = unstable_cache(
  async () => getPopular(50),
  ["popular-studios-v1"],
  { revalidate: 86400, tags: ["anilist-catalog"] },
);

function summarizeStudios(media: Media[]): StudioSummary[] {
  const studios = new Map<number, StudioSummary>();

  for (const item of media) {
    const seen = new Set<number>();
    for (const node of item.studios?.nodes ?? []) {
      if (!node.name || seen.has(node.id)) continue;
      seen.add(node.id);

      const title = bestTitle(item.title);
      const existing = studios.get(node.id);
      if (existing) {
        existing.titles += 1;
      } else {
        studios.set(node.id, {
          id: node.id,
          name: node.name,
          titles: 1,
          notable: title,
        });
      }
    }
  }

  return Array.from(studios.values()).sort(
    (a, b) => b.titles - a.titles || a.name.localeCompare(b.name),
  );
}

export default async function StudiosPage() {
  let popular: Media[];
  try {
    popular = await getCachedPopular();
  } catch (error) {
    if (error instanceof AniListUnavailableError) {
      return <AnimeUnavailableCard href="/studios" />;
    }
    throw error;
  }

  const studios = summarizeStudios(popular);

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <nav className="mb-6 text-xs text-[var(--color-mute)]">
          <Link href="/" className="hover:text-[var(--color-cyan)]">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--color-ink)]">Studios</span>
        </nav>

        <section className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6 sm:p-9">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-violet)]">
            Production credits
          </p>
          <h1 className="mt-2 font-display text-3xl font-black sm:text-5xl">
            Anime studios
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)]">
            Start from a popular title and follow its studio. Counts below come from
            the current popular-anime snapshot, and every card opens a real studio
            page with that studio&apos;s catalogue.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/top-anime"
              className="rounded-full bg-[var(--color-violet)] px-4 py-2 text-xs font-bold text-black transition-opacity hover:opacity-80"
            >
              Popular anime
            </Link>
            <Link
              href="/genres"
              className="rounded-full border border-[var(--color-line)] px-4 py-2 text-xs font-bold text-[var(--color-ink)] transition-colors hover:border-[var(--color-violet)] hover:text-[var(--color-violet)]"
            >
              Browse genres
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-xl font-bold">Studios in focus</h2>
            <span className="font-mono text-xs text-[var(--color-mute)]">
              {studios.length} studios
            </span>
          </div>

          {studios.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {studios.map((studio) => (
                <Link
                  key={studio.id}
                  href={`/studio/${studio.id}`}
                  className="group flex gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface1)] p-4 transition-colors hover:border-[var(--color-violet)]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-violet)] to-[var(--color-cyan)] font-display text-lg font-bold text-black">
                    {studio.name.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[var(--color-ink)] group-hover:text-[var(--color-violet)]">
                      {studio.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--color-mute)]">
                      {studio.titles} popular {studio.titles === 1 ? "title" : "titles"}
                      {studio.notable ? ` · e.g. ${studio.notable}` : ""}
                    </span>
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
                No studio credits are available in this snapshot. Try again shortly.
              </p>
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
