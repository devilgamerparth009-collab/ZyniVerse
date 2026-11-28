import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMangaDetailFull, AniListUnavailableError } from "@/lib/anilist";
import MangaDetailClient from "./manga-client";
import AnimeUnavailableCard from "@/components/AnimeUnavailableCard";

// Same reasoning as /character/[id]: a manga page is a high-cardinality
// AniList mirror. An empty `generateStaticParams()` made every crawled id an
// on-demand ISR entry, and the 7-day `force-cache` query added a second one.
// Render dynamically with no-store data fetches and let the CDN cache output.
export const dynamic = "force-dynamic";

const getMangaCached = cache((id: string) => getMangaDetailFull(id, { noStore: true }));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return { title: "Manga", robots: { index: false, follow: false } };
  }
  try {
    const manga = await getMangaCached(id);
    const title = manga.title?.english || manga.title?.romaji || "Manga";
    const description =
      (manga.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) ||
      `${title} — chapters, ratings, characters and reading progress on ZyniVerse.`;
    return {
      title: `${title} — Manga`,
      description,
      robots: { index: false, follow: false },
      openGraph: {
        title: `${title} — Manga`,
        description,
        images: manga.coverImage?.extraLarge || manga.coverImage?.large
          ? [{ url: manga.coverImage.extraLarge || manga.coverImage.large!, alt: title }]
          : undefined,
      },
    };
  } catch {
    return { title: "Manga", robots: { index: false, follow: false } };
  }
}

export default async function MangaDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  let manga;
  try {
    manga = await getMangaCached(id);
  } catch (err) {
    if (err instanceof AniListUnavailableError) {
      return <AnimeUnavailableCard href={`/manga/${id}`} />;
    }
    notFound();
  }
  if (!manga) notFound();
  return <MangaDetailClient initialManga={manga} />;
}
