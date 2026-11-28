import Link from "next/link";
import NativeBannerAd from "@/components/NativeBannerAd";
import { FadeIn } from "@/components/PageTransition";
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

  const isMovie = kind === "movie";
  const accent = isMovie ? "var(--color-magenta)" : "var(--color-violet)";
  const basePath = isMovie ? "/hindi-dub/movies" : "/hindi-dub/series";
  const otherHref = isMovie ? "/hindi-dub/series" : "/hindi-dub/movies";
  const otherLabel = isMovie ? "Browse series" : "Browse movies";
  const catalogLabel = isMovie ? "movies" : "series";

  const spotlightItems = catalog.items.slice(0, 3);
  const topLanguages = [...languages]
    .filter((item) => (isMovie ? item.movies : item.series) > 0)
    .sort((a, b) => (isMovie ? b.movies - a.movies : b.series - a.series))
    .slice(0, 3);
  const hasFilters = Boolean(
    searchParams.q ||
      searchParams.language ||
      searchParams.genre ||
      (searchParams.sort && searchParams.sort !== "recent")
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <nav
        className="dub-crumbs mb-5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-mute)]"
        aria-label="Breadcrumb"
      >
        <Link href="/hindi-dub" className="hover:text-[var(--color-cyan)]" prefetch={false}>
          Hindi Dub
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-[var(--color-ink)]">{isMovie ? "Movies" : "Series"}</span>
      </nav>

      <FadeIn>
        <section
          className="dub-catalog-hero relative overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 sm:p-9 lg:p-10"
          style={{ "--dub-accent": accent } as React.CSSProperties}
        >
          <div className="dub-aurora pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-[var(--dub-accent)]/25 blur-3xl" />
          <div className="dub-aurora dub-aurora--slow pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[var(--color-cyan)]/15 blur-3xl" />
          <div className="dub-grid pointer-events-none absolute inset-0 opacity-[0.1]" />
          <div className="dub-hero-scan pointer-events-none absolute inset-0" />

          <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-10">
            <div>
              <p className="dub-eyebrow">{isMovie ? "Big screen" : "Full catalogue"}</p>
              <h1 className="dub-section-title font-display mt-2 text-3xl font-black leading-tight tracking-tight text-[var(--color-ink)] sm:text-5xl">
                {title}
              </h1>
              <p className="dub-lede mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)] sm:text-base">
                {subtitle}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="dub-catalog-stat" data-tone="violet">
                  <span className="dub-catalog-stat-dot" aria-hidden="true" />
                  <strong>{catalog.total.toLocaleString("en-IN")}</strong> {catalogLabel}
                </span>
                <span className="dub-catalog-stat" data-tone="cyan">
                  <span className="dub-catalog-stat-dot" aria-hidden="true" />
                  <strong>{languages.length}</strong> languages
                </span>
                <span className="dub-catalog-stat" data-tone="magenta">
                  <span className="dub-catalog-stat-dot" aria-hidden="true" />
                  <strong>{genres.length}</strong> genres to explore
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link href="/hindi-dub" className="dub-hero-chip" prefetch={false}>
                  Dub hub
                </Link>
                <Link href={otherHref} className="dub-hero-chip" prefetch={false}>
                  {otherLabel}
                </Link>
                <Link
                  href="/hindi-dub/schedule"
                  className="dub-hero-chip dub-hero-chip--live"
                  prefetch={false}
                >
                  <span className="dub-live-dot" aria-hidden="true" />
                  Live schedule
                </Link>
                <Link href="#catalog-filters" className="dub-hero-chip dub-hero-chip--jump" prefetch={false}>
                  Refine results
                  <span aria-hidden="true">↓</span>
                </Link>
              </div>
            </div>

            <div className="lg:justify-self-end">
              <div className="dub-catalog-spotlight relative overflow-hidden rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
                <div className="dub-catalog-spotlight-glow pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="dub-eyebrow">From this view</p>
                    <p className="mt-1 text-xs text-[var(--color-mute)]">Poster preview</p>
                  </div>
                  <span className="dub-catalog-spotlight-badge" aria-hidden="true">
                    ★
                  </span>
                </div>

                {spotlightItems.length > 0 ? (
                  <div className="dub-spotlight-stack relative mt-4 flex justify-center">
                    {spotlightItems.map((item, index) => (
                      <Link
                        key={item.id}
                        href={`/search?q=${encodeURIComponent(item.title)}`}
                        className="dub-spotlight-poster relative overflow-hidden rounded-xl border border-[var(--color-line)] bg-black/40"
                        style={{ "--i": index } as React.CSSProperties}
                        prefetch={false}
                        title={`Search ${item.title} on ZyniVerse`}
                      >
                        {item.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.posterUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover object-top"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] font-bold text-[var(--color-mute)]">
                            {item.title}
                          </span>
                        )}
                        <span className="dub-spotlight-index" aria-hidden="true">
                          0{index + 1}
                        </span>
                        <span className="sr-only">{item.title}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="dub-spotlight-empty mt-4 grid h-[190px] place-items-center rounded-xl border border-dashed border-[var(--color-line)] text-center text-xs text-[var(--color-mute)]">
                    No posters in this view yet.
                  </div>
                )}

                {topLanguages.length > 0 && (
                  <div className="relative mt-4">
                    <p className="dub-eyebrow">Popular languages</p>
                    <div className="dub-spotlight-langs mt-2 flex flex-wrap gap-1.5">
                      {topLanguages.map((item) => {
                        const count = isMovie ? item.movies : item.series;
                        return (
                          <Link
                            key={item.slug}
                            href={`${basePath}?language=${encodeURIComponent(item.language)}`}
                            className="dub-spotlight-lang"
                            prefetch={false}
                          >
                            {item.language}
                            <span>{count}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </FadeIn>

      <NativeBannerAd className="my-6" />

      <CatalogView
        basePath={basePath}
        accent={accent}
        title="All titles"
        subtitle="Use the filters below to narrow the catalogue by language, genre or rating."
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
        hasFilters={hasFilters}
      />
    </main>
  );
}
