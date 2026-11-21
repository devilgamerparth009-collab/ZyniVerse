import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getDubCatalog,
  getDubLanguages,
} from "@/lib/dub-import/queries";
import { DubTitleGrid } from "@/components/hindi-dub/DubTitleCard";
import NativeBannerAd from "@/components/NativeBannerAd";

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export async function generateStaticParams() {
  try {
    const languages = await getDubLanguages();
    return languages.map((language) => ({ language: language.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ language: string }>;
}): Promise<Metadata> {
  const { language: slug } = await params;
  const languages = await getDubLanguages().catch(() => []);
  const match = languages.find((item) => item.slug === slug);
  const label = match?.language ?? slug;

  return {
    title: `${label} Dubbed Anime — Series & Movies (2026)`,
    description: `Every anime with a ${label} dub: series, movies, episode info and source links. Auto-updated from Indian dub listings.`,
    keywords: [
      `${label.toLowerCase()} dubbed anime`,
      `anime in ${label.toLowerCase()}`,
      `${label.toLowerCase()} dub list`,
      `${label.toLowerCase()} dub anime schedule`,
    ],
    openGraph: {
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
      title: `${label} Dubbed Anime — Series & Movies`,
      description: `Every ${label} dub in the ZyniVerse catalogue.`,
      url: `${BASE_URL}/hindi-dub/languages/${slug}`,
      type: "website",
      siteName: "ZyniVerse",
    },
    alternates: { canonical: `${BASE_URL}/hindi-dub/languages/${slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function LanguagePage({
  params,
}: {
  params: Promise<{ language: string }>;
}) {
  const { language: slug } = await params;
  const languages = await getDubLanguages();
  const match = languages.find((item) => item.slug === slug);
  if (!match) notFound();

  const [series, movies] = await Promise.all([
    getDubCatalog({ language: match.language, kind: "series", sort: "recent", limit: 18 }),
    getDubCatalog({ language: match.language, kind: "movie", sort: "recent", limit: 12 }),
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--color-mute)]">
        <Link href="/hindi-dub" className="hover:text-[var(--color-cyan)]">
          Hindi Dub
        </Link>
        <span>/</span>
        <Link href="/hindi-dub/series" className="hover:text-[var(--color-cyan)]">
          Languages
        </Link>
        <span>/</span>
        <span className="text-[var(--color-ink)]">{match.language}</span>
      </nav>

      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6">
        <h1 className="text-2xl font-black text-[var(--color-ink)] sm:text-4xl">
          {match.language} dubbed anime
        </h1>
        <p className="mt-2 text-sm text-[var(--color-mute)]">
          {match.total.toLocaleString("en-IN")} titles · {match.series.toLocaleString("en-IN")} series ·{" "}
          {match.movies.toLocaleString("en-IN")} movies
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/hindi-dub/series?language=${encodeURIComponent(match.language)}`}
            className="rounded-full bg-[var(--color-violet)] px-4 py-1.5 text-xs font-semibold text-white"
          >
            All {match.language} series
          </Link>
          <Link
            href={`/hindi-dub/movies?language=${encodeURIComponent(match.language)}`}
            className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs font-semibold text-[var(--color-ink)]"
          >
            All {match.language} movies
          </Link>
          <Link
            href="/hindi-dub/schedule"
            className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs font-semibold text-[var(--color-ink)]"
          >
            Weekly schedule
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-black text-[var(--color-ink)]">Latest {match.language} dub series</h2>
        <div className="mt-4">
          <DubTitleGrid items={series.items} />
        </div>
      </section>

      {movies.items.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-black text-[var(--color-ink)]">{match.language} dub movies</h2>
          <div className="mt-4">
            <DubTitleGrid items={movies.items} />
          </div>
        </section>
      )}

      <div className="mt-8">
        <NativeBannerAd />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {languages
          .filter((item) => item.slug !== match.slug)
          .map((item) => (
            <Link
              key={item.slug}
              href={`/hindi-dub/languages/${item.slug}`}
              className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs text-[var(--color-mute)] transition hover:text-[var(--color-ink)]"
            >
              {item.language}
            </Link>
          ))}
      </div>
    </main>
  );
}
