import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { cache } from "react";
import SimilarTitlesReveal from "@/components/SimilarTitlesReveal";
import { getMangaDetailFull, bestTitle } from "@/lib/anilist";

// This mirror is crawled at high cardinality. The page is force-dynamic with
// no-store AniList fetches, so the layout must not reintroduce one data-cache
// entry per id through `generateMetadata` or its own render.
const getMangaDetailCached = cache((id: string) =>
  getMangaDetailFull(id, { noStore: true }),
);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return { title: "Manga Details", robots: { index: false, follow: false } };
  }
  try {
    const manga = await getMangaDetailCached(id);
    const title = bestTitle(manga.title);
    const desc = manga.description
      ? manga.description.replace(/<[^>]*>/g, "").slice(0, 200)
      : `Read ${title} — manga details, chapters, recommendations, and more on ZyniVerse.`;

    return {
      title: `${title} — Read Manga, Chapters & Recommendations`,
      description: desc,
      openGraph: {
        title: `${title} — Manga`,
        description: desc,
        url: `${BASE_URL}/manga/${id}`,
        images: manga.coverImage?.extraLarge ? [{ url: manga.coverImage.extraLarge }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: `${title}`,
        description: desc,
      },
      alternates: {
        canonical: `${BASE_URL}/manga/${id}`,
      },
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: "Manga Details",
      description: "Browse detailed manga information including chapters, genres, characters, and recommendations. Read manga online for free.",
      alternates: { canonical: `${BASE_URL}/manga/${id}` },
      robots: { index: false, follow: false },
    };
  }
}

export default async function MangaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  let manga = null;
  const { id } = await params;
  if (/^\d+$/.test(id)) {
    try {
      manga = await getMangaDetailCached(id);
    } catch {
      /* invalid or unavailable mangaId */
    }
  }

  const title = manga ? bestTitle(manga.title) : "";
  const desc = manga?.description
    ? manga.description.replace(/<[^>]*>/g, "").slice(0, 300)
    : "";
  const voteCount = (manga?.stats?.scoreDistribution || []).reduce(
    (sum, d) => sum + (d.amount || 0),
    0,
  );

  const jsonLd = manga
    ? {
        "@context": "https://schema.org",
        "@type": "Book",
        name: title,
        alternateName: [manga.title?.native, manga.title?.romaji].filter(Boolean),
        description: desc || undefined,
        url: `${BASE_URL}/manga/${manga.id}`,
        image: manga.coverImage?.extraLarge || manga.coverImage?.large || undefined,
        bookFormat: "https://schema.org/GraphicNovel",
        genre: manga.genres || undefined,
        inLanguage: ["ja"],
        aggregateRating: manga.averageScore
          ? {
              "@type": "AggregateRating",
              ratingValue: (manga.averageScore / 10).toFixed(1),
              bestRating: "10",
              worstRating: "0",
              ratingCount: voteCount || undefined,
            }
          : undefined,
        sameAs: [
          manga.idMal ? `https://myanimelist.net/manga/${manga.idMal}` : null,
          `https://anilist.co/manga/${manga.id}`,
        ].filter(Boolean),
      }
    : null;

  // Real AniList recommendations (sorted by rating) as internal links. Cross-type
  // entries (a manga recommending an anime, or vice versa) route to the right
  // section instead of emitting a broken /manga/<animeId> link.
  const similar = (manga?.recommendations?.edges || [])
    .map((e) => e.node?.mediaRecommendation)
    .filter((m): m is NonNullable<typeof m> => Boolean(m?.id && m?.title));

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
      {similar.length > 0 && (
        <SimilarTitlesReveal>
          <div className="mdt-similar-card">
            <span className="mdt-similar-glow" aria-hidden />
            <div className="mdt-similar-head-row">
              <div className="mdt-similar-heading">
                <span className="mdt-similar-kicker" aria-hidden>◇</span>
                <div>
                  <h2 className="mdt-similar-head font-display font-bold">
                    <span className="mdt-similar-title-text">Similar Titles</span>
                  </h2>
                  <p className="mdt-similar-sub">Based on AniList community recommendations</p>
                </div>
              </div>
              <span className="mdt-card-badge mdt-similar-badge">{similar.length} real picks</span>
            </div>
            <div className="mdt-similar-track">
              {similar.slice(0, 12).map((m, i) => {
                const name = bestTitle(m.title);
                const cover = m.coverImage?.large || m.coverImage?.medium || "";
                const isAnime = m.type === "ANIME";
                return (
                  <Link
                    key={`${m.type}-${m.id}`}
                    href={`/${isAnime ? "anime" : "manga"}/${m.id}`}
                    className={`mdt-poster-link ${isAnime ? "is-anime" : "is-manga"}`}
                    style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
                  >
                    <span className="mdt-poster-frame">
                      {cover ? (
                        <Image
                          src={cover}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 24vw, 160px"
                          className="mdt-poster-img"
                          unoptimized
                        />
                      ) : (
                        <span className="mdt-poster-fallback" aria-hidden>{name.charAt(0)}</span>
                      )}
                      <span className="mdt-poster-scrim" aria-hidden />
                      <span className="mdt-poster-rank" aria-hidden>#{String(i + 1).padStart(2, "0")}</span>
                      <span className="mdt-poster-type">{isAnime ? "Anime" : "Manga"}</span>
                      <span className="mdt-poster-info">
                        <span className="mdt-poster-name">{name}</span>
                        <span className="mdt-poster-arrow" aria-hidden>↗</span>
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </SimilarTitlesReveal>
      )}
    </>
  );
}
