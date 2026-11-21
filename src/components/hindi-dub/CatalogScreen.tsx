import Link from "next/link";
import NativeBannerAd from "@/components/NativeBannerAd";
import { CatalogView } from "./CatalogView";
import { getDubCatalog, getDubGenres, getDubLanguages } from "@/lib/dub-import/queries";

export interface CatalogSearchParams {
  q?: string;
  language?: string;
  genre?: string;
  sort?: string;
  page?: string;
}

export async function CatalogScreen({
  kind,
  title,
  subtitle,
  searchParams,
}: {
  kind: "series" | "movie";
  title: string;
  subtitle: string;
  searchParams: CatalogSearchParams;
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const [catalog, languages, genres] = await Promise.all([
    getDubCatalog({
      kind,
      q: searchParams.q,
      language: searchParams.language,
      genre: searchParams.genre,
      sort: searchParams.sort,
      page,
      limit: 36,
    }),
    getDubLanguages(),
    getDubGenres(kind),
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-4 flex items-center gap-2 text-xs text-[var(--color-mute)]">
        <Link href="/hindi-dub" className="hover:text-[var(--color-cyan)]">
          Hindi Dub
        </Link>
        <span>/</span>
        <span className="text-[var(--color-ink)]">{kind === "movie" ? "Movies" : "Series"}</span>
      </nav>
      <NativeBannerAd className="mb-6" />
      <CatalogView
        basePath={kind === "movie" ? "/hindi-dub/movies" : "/hindi-dub/series"}
        title={title}
        subtitle={subtitle}
        items={catalog.items}
        total={catalog.total}
        page={catalog.page}
        totalPages={catalog.totalPages}
        filters={{
          q: searchParams.q,
          language: searchParams.language,
          genre: searchParams.genre,
          sort: searchParams.sort,
        }}
        languages={languages}
        genres={genres}
      />
    </main>
  );
}
