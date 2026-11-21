import { cache } from "react";
import {
  getAnimeDetailFull,
  AniListUnavailableError,
  bestTitle,
  type MediaAnimeFull,
} from "@/lib/anilist";
import { getDubPageSlugForMalId, getDubPageSlugForTitle } from "@/lib/dub-page-index";
import { notFound, redirect } from "next/navigation";
import AnimeDetailClient from "./detail-client";
import AnimeUnavailableCard from "@/components/AnimeUnavailableCard";
import { getAnimeEditorial, type AnimeEditorial } from "@/lib/anime-editorials";
import { prisma } from "@/lib/prisma";

// 7 days. Anime metadata (episode count, cover, cast) changes slowly, and the
// previous 48h window meant every crawler pass over the catalog re-rendered
// the same pages. AniList detail fetches revalidate on their own cache window,
// and `revalidatePath("/anime/<id>")` on reel upload still refreshes the page
// on demand, so community clips stay prompt.
export const revalidate = 604800;

// Empty array => no build-time prerender, but on-demand ISR at runtime
// (Next.js only enables it for a dynamic segment when this function exists).
export function generateStaticParams() {
  return [];
}

const getAnimeDetailCached = cache(getAnimeDetailFull);

interface AnimeReelLink {
  id: string;
  thumbnailUrl: string | null;
  caption: string | null;
  views: number;
  duration: number;
  likesCount: number;
  username: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

function buildAnimeJsonLd(anime: MediaAnimeFull) {
  const id = String(anime.id);
  const title = anime.title?.english || anime.title?.romaji || "Anime";
  const desc = (anime.description || "").replace(/<[^>]*>/g, "").slice(0, 200);
  const image =
    anime.coverImage?.extraLarge ||
    anime.coverImage?.large ||
    `${BASE_URL}/logo.png`;
  const type =
    anime.format === "MOVIE"
      ? "Movie"
      : anime.format === "ONA" || anime.format === "OVA"
        ? "CreativeWork"
        : "TVSeries";
  const schema = {
    "@context": "https://schema.org",
    "@type": type,
    name: title,
    alternateName: [anime.title?.romaji, anime.title?.native].filter(Boolean),
    url: `${BASE_URL}/anime/${id}`,
    image,
    description: desc,
    datePublished: anime.startDate?.year
      ? `${anime.startDate.year}-${String(anime.startDate.month || 1).padStart(2, "0")}-${String(anime.startDate.day || 1).padStart(2, "0")}`
      : undefined,
    dateModified: undefined,
    inLanguage: anime.countryOfOrigin === "JP" ? "ja" : undefined,
    genre: (anime.genres || []).slice(0, 5),
    contentRating: anime.isAdult ? "Mature" : "Everyone",
    aggregateRating: anime.averageScore
      ? {
          "@type": "AggregateRating",
          ratingValue: (anime.averageScore / 10).toFixed(1),
          bestRating: "10",
          ratingCount: anime.favourites || 1,
        }
      : undefined,
    creator: anime.studios?.nodes?.length
      ? { "@type": "Organization", name: anime.studios.nodes[0].name }
      : undefined,
    numberOfEpisodes: anime.episodes || undefined,
    isPartOf:
      anime.season && anime.seasonYear
        ? {
            "@type": "CreativeWorkSeason",
            name: `${anime.season} ${anime.seasonYear}`,
            startDate: undefined,
          }
        : undefined,
    publisher: { "@type": "Organization", name: "ZyniVerse", url: BASE_URL },
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Anime",
        item: `${BASE_URL}/seasonal`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: `${BASE_URL}/anime/${id}`,
      },
    ],
  };
  return [JSON.stringify(schema), JSON.stringify(breadcrumb)];
}

function buildEditorialJsonLd(
  anime: MediaAnimeFull,
  editorial: AnimeEditorial,
) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Review",
    name: `ZyniVerse Editorial: ${anime.title?.english || anime.title?.romaji || "Anime"}`,
    itemReviewed: {
      "@type": "CreativeWork",
      name: anime.title?.english || anime.title?.romaji || "Anime",
      url: `${BASE_URL}/anime/${anime.id}`,
      image:
        anime.coverImage?.extraLarge || anime.coverImage?.large || undefined,
    },
    author: { "@type": "Organization", name: "ZyniVerse", url: BASE_URL },
    publisher: { "@type": "Organization", name: "ZyniVerse", url: BASE_URL },
    reviewRating: {
      "@type": "Rating",
      ratingValue: editorial.rating,
      bestRating: "5",
      worstRating: "1",
      alternateName: editorial.ratingLabel,
    },
    reviewBody: editorial.verdict,
    datePublished: new Date().toISOString().slice(0, 10),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const anime = await getAnimeDetailCached(id);
    const title = anime.title?.english || anime.title?.romaji || "Anime";
    const ogImage = `${BASE_URL}/api/og/anime/${id}`;
    return {
      title,
      description: (anime.description || "")
        .replace(/<[^>]*>/g, "")
        .slice(0, 160),
      openGraph: {
        title: `${title} — Anime Guide`,
        description: (anime.description || "")
          .replace(/<[^>]*>/g, "")
          .slice(0, 160),
        type: "website",
        url: `${BASE_URL}/anime/${id}`,
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: "summary_large_image" as const,
        title: `${title}`,
        images: [ogImage],
      },
    };
  } catch {
    return { title: "Anime" };
  }
}

export default async function AnimeDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let anime;
  try {
    anime = await getAnimeDetailCached(id);
  } catch (err) {
    if (err instanceof AniListUnavailableError) {
      return <AnimeUnavailableCard href={`/anime/${id}`} />;
    }
    notFound();
  }
  if (!anime) notFound();
  if (anime.type === "MANGA") redirect(`/manga/${anime.id}`);
  const editorial = getAnimeEditorial(anime.title);

  // Reels linked to this anime (uploaded against /reels/upload's anime picker).
  const idNum = Number(id);
  let animeReels: AnimeReelLink[] = [];
  if (Number.isInteger(idNum)) {
    try {
      const rows = await prisma.reel.findMany({
        where: { animeId: idNum },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          user: { select: { username: true } },
          _count: { select: { likes: true } },
        },
      });
      animeReels = rows.map((r) => ({
        id: r.id,
        thumbnailUrl: r.thumbnailUrl,
        caption: r.caption,
        views: r.views,
        duration: r.duration,
        likesCount: r._count.likes,
        username: r.user.username,
      }));
    } catch {
      animeReels = [];
    }
  }

  const jsonLd = buildAnimeJsonLd(anime);
  const reviewLd = editorial ? buildEditorialJsonLd(anime, editorial) : null;

  // Internal links to the two India-specific guides. Without these the
  // /watch/{id} pages were orphans — reachable only through the sitemap, with
  // zero inbound internal links from the 7k+ anime detail pages.
  const dubPageSlug =
    getDubPageSlugForMalId(anime.idMal) ??
    getDubPageSlugForTitle(anime.title?.english) ??
    getDubPageSlugForTitle(anime.title?.romaji) ??
    getDubPageSlugForTitle(bestTitle(anime.title));

  return (
    <>
      {jsonLd.map((json, i) => (
        <script
          key={i}
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: json }}
        />
      ))}
      {reviewLd && (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: reviewLd }}
        />
      )}
      <AnimeDetailClient
        anime={anime}
        editorial={editorial}
        reels={animeReels}
        dubGuideHref={dubPageSlug ? `/indian-dubs/${dubPageSlug}` : null}
      />
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-white">About this anime page</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-mute)]">
            This page combines anime metadata, episode details, character information, and ZyniVerse tools like watch order, filler guides, and Hindi dub availability where relevant.
            Information is sourced from public metadata providers and curated references, and it may change as new episodes or official updates are released.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3 text-sm">
            <div className="rounded-xl border border-[var(--color-line)] bg-black/20 p-4">
              <p className="font-semibold text-white">Check watch order</p>
              <p className="mt-1 text-xs text-[var(--color-mute)]">Use watch order guides for franchises with multiple seasons, movies, or timelines.</p>
            </div>
            <div className="rounded-xl border border-[var(--color-line)] bg-black/20 p-4">
              <p className="font-semibold text-white">Skip filler wisely</p>
              <p className="mt-1 text-xs text-[var(--color-mute)]">Filler guides help you save time while keeping important canon episodes.</p>
            </div>
            <div className="rounded-xl border border-[var(--color-line)] bg-black/20 p-4">
              <p className="font-semibold text-white">Verify availability</p>
              <p className="mt-1 text-xs text-[var(--color-mute)]">Streaming and dub availability can change by region and platform. Confirm on official services.</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-[var(--color-mute)]">
            <h3 className="font-semibold text-white">FAQ</h3>
            <p><span className="text-white">Is this anime canon/filler information accurate?</span> We use available episode data and guide references. If you notice an issue, use the feedback/contact page so we can review it.</p>
            <p><span className="text-white">Can I watch anime here?</span> No. ZyniVerse does not host or stream anime episodes. We provide information, guides, and links to official platforms where available.</p>
          </div>
        </div>
      </section>
    </>
  );
}
