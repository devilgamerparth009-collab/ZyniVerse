import type { Metadata } from "next";
import { CatalogScreen, type CatalogSearchParams } from "@/components/hindi-dub/CatalogScreen";

export const revalidate = 1800;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Hindi Dubbed Anime Movies — Full Catalogue (2026)",
  description:
    "Every Hindi, Tamil, Telugu and multi-audio dubbed anime movie in one catalogue, with posters, genres and language tags. Filter by language or sort by rating.",
  keywords: [
    "hindi dubbed anime movie", "anime movie in hindi", "hindi dub movies list",
    "tamil dubbed anime movie", "telugu dubbed anime movie", "multi audio anime movie",
  ],
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
    title: "Hindi Dubbed Anime Movies — Full Catalogue",
    description: "Every Hindi and regional dub movie, filterable by language and rating.",
    url: `${BASE_URL}/hindi-dub/movies`,
    type: "website",
    siteName: "ZyniVerse",
  },
  alternates: { canonical: `${BASE_URL}/hindi-dub/movies` },
  robots: { index: true, follow: true },
};

export default async function HindiDubMoviesPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  return (
    <CatalogScreen
      kind="movie"
      title="Hindi & regional dub movies"
      subtitle="Dubbed anime films, source pages ke direct link ke saath."
      searchParams={params}
    />
  );
}
