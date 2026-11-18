import type { Metadata } from "next";
import { CatalogScreen, type CatalogSearchParams } from "@/components/hindi-dub/CatalogScreen";

export const revalidate = 1800;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Hindi Dubbed Anime Series — Full Catalogue (2026)",
  description:
    "Browse every Hindi, Tamil, Telugu, Bengali, Malayalam and Kannada dubbed anime series with posters, genres and language tags. Filter by language, genre or rating and jump to the source episode list.",
  keywords: [
    "hindi dubbed anime series", "hindi dub anime list", "anime series in hindi",
    "tamil dubbed anime series", "telugu dubbed anime series", "hindi dub catalogue",
  ],
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
    title: "Hindi Dubbed Anime Series — Full Catalogue",
    description: "Every Hindi and regional dub series, filterable by language, genre and rating.",
    url: `${BASE_URL}/hindi-dub/series`,
    type: "website",
    siteName: "ZyniVerse",
  },
  alternates: { canonical: `${BASE_URL}/hindi-dub/series` },
  robots: { index: true, follow: true },
};

export default async function HindiDubSeriesPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  return (
    <CatalogScreen
      kind="series"
      title="Hindi & regional dub series"
      subtitle="Browse the dub series catalogue — filter by language, genre or rating."
      searchParams={params}
    />
  );
}
