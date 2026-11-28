import type { Metadata } from "next";
import { cache } from "react";
import { getCharacter, bestTitle } from "@/lib/anilist";

// The page is force-dynamic with no-store AniList fetches; metadata must use
// the same policy or it recreates one data-cache entry per crawled character id.
const getCharacterCached = cache((id: string) =>
  getCharacter(id, { noStore: true }),
);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return { title: "Character Details", robots: { index: false, follow: false } };
  }
  try {
    const char = await getCharacterCached(id);
    const name = char.name?.full || "Unknown Character";
    const animeNames = (char.media?.edges || [])
      .slice(0, 3)
      .map((e) => e.node ? bestTitle(e.node.title) : "")
      .filter(Boolean);
    const animeStr = animeNames.length > 0 ? ` from ${animeNames.join(", ")}` : "";

    return {
      title: `${name} — Anime Character Details`,
      description: char.description
        ? char.description.replace(/<[^>]*>/g, "").slice(0, 200)
        : `Learn about ${name}${animeStr}. Voice actors, appearances, favorites, and more on ZyniVerse.`,
      openGraph: {
        title: `${name} — Anime Character`,
        description: char.description
          ? char.description.replace(/<[^>]*>/g, "").slice(0, 200)
          : `Learn about ${name}${animeStr} on ZyniVerse.`,
        url: `${BASE_URL}/character/${id}`,
        images: char.image?.large ? [{ url: char.image.large }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: `${name}`,
        description: char.description
          ? char.description.replace(/<[^>]*>/g, "").slice(0, 200)
          : `Learn about ${name} on ZyniVerse.`,
      },
      alternates: {
        canonical: `${BASE_URL}/character/${id}`,
      },
      // Thin AniList mirror: the same character text exists on AniList/MAL/
      // Fandom, so indexing these pages only adds near-duplicate thin content
      // that keeps landing in Google's "crawled - currently not indexed".
      // This route is also rate-limited/hard-404'd for abusive crawlers, so
      // nofollow matches the HTTP X-Robots-Tag header exactly.
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: "Character Details",
      description: "Explore detailed anime character information including voice actors, appearances, and trivia. Free anime platform.",
      alternates: { canonical: `${BASE_URL}/character/${id}` },
      robots: { index: false, follow: false },
    };
  }
}

export default function CharacterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
