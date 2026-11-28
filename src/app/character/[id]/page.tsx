import { cache } from "react";
import { notFound } from "next/navigation";
import { getCharacter, AniListUnavailableError } from "@/lib/anilist";
import CharacterDetailClient from "./character-client";
import AnimeUnavailableCard from "@/components/AnimeUnavailableCard";

// This is a noindex/disallowed AniList mirror crawled at very high cardinality.
// An empty `generateStaticParams()` used to make every new id an on-demand ISR
// entry, and the 7-day `force-cache` query added a second entry per id. Render
// dynamically, skip the Next data cache, and let the CDN cache the response.
export const dynamic = "force-dynamic";

const getCharacterCached = cache((id: string) => getCharacter(id, { noStore: true }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return { title: "Character", robots: { index: false, follow: false } };
  }
  try {
    const char = await getCharacterCached(id);
    const name = char.name?.full || "Character";
    const description = (char.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    return {
      title: `${name} — Character`,
      description: description || `Anime appearances, voice actors and details for ${name}.`,
      robots: { index: false, follow: false },
      openGraph: {
        title: `${name} — Character`,
        description,
        images: char.image?.large ? [{ url: char.image.large, alt: name }] : undefined,
      },
    };
  } catch {
    return { title: "Character", robots: { index: false, follow: false } };
  }
}

export default async function CharacterDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  let char;
  try {
    char = await getCharacterCached(id);
  } catch (err) {
    if (err instanceof AniListUnavailableError) {
      return <AnimeUnavailableCard href={`/character/${id}`} />;
    }
    notFound();
  }
  if (!char) notFound();
  return <CharacterDetailClient initialChar={char} />;
}
