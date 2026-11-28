import Link from "next/link";
import { DubTitleCard } from "./DubTitleCard";
import { FadeIn, StaggerGrid, StaggerItem } from "@/components/PageTransition";
import type { DubTitleDTO } from "@/lib/dub-import/queries";

export interface CatalogFilterState {
  q?: string;
  language?: string;
  genre?: string;
  sort?: string;
}

interface CatalogViewProps {
  basePath: string;
  accent?: string;
  title: string;
  subtitle: string;
  items: DubTitleDTO[];
  total: number;
  page: number;
  totalPages: number;
  filters: CatalogFilterState;
  languages: { language: string; slug: string; total: number }[];
  genres: string[];
  hasFilters?: boolean;
}

const SORTS: { value: string; label: string }[] = [
  { value: "recent", label: "Recently updated" },
  { value: "title", label: "A–Z" },
  { value: "rating", label: "Top rated" },
  { value: "year", label: "Newest year" },
];

function hrefFor(basePath: string, filters: CatalogFilterState, overrides: Partial<CatalogFilterState & { page: number }> = {}) {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.language) params.set("language", merged.language);
  if (merged.genre) params.set("genre", merged.genre);
  if (merged.sort && merged.sort !== "recent") params.set("sort", merged.sort);
  if (overrides.page && overrides.page > 1) params.set("page", String(overrides.page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function CatalogView({
  basePath,
  accent = "var(--color-violet)",
  title,
  subtitle,
  items,
  total,
  page,
  totalPages,
  filters,
  languages,
  genres,
  hasFilters = false,
}: CatalogViewProps) {
  return (
    <section
      className="dub-catalog space-y-5"
      style={{ "--dub-accent": accent } as React.CSSProperties}
    >
      <FadeIn>
        <div className="dub-catalog-heading flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-6">
          <div>
            <p className="dub-eyebrow">Explore titles</p>
            <h2 className="dub-section-title font-display mt-1.5 text-2xl font-black text-[var(--color-ink)] sm:text-3xl">
              {title}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-[var(--color-mute)]">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="dub-catalog-total rounded-full border border-[var(--color-line)] bg-black/25 px-3 py-1.5 font-mono text-xs text-[var(--color-mute)]">
              {total.toLocaleString("en-IN")} titles
            </span>
            {totalPages > 1 && (
              <span className="dub-catalog-page-pill rounded-full border border-[var(--color-line)] bg-black/25 px-3 py-1.5 font-mono text-xs text-[var(--color-mute)]">
                Page {page} / {totalPages}
              </span>
            )}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div id="catalog-filters" className="dub-filter-board rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 sm:p-6">
          <div className="dub-filter-top mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="dub-eyebrow">Refine results</p>
              <p className="mt-1 text-xs text-[var(--color-mute)]">
                Pick a language, genre or sort order.
              </p>
            </div>
            {hasFilters && (
              <Link href={basePath} prefetch={false} className="dub-filter-reset">
                Reset filters
              </Link>
            )}
          </div>

          <form action={basePath} className="dub-search-form flex flex-col gap-2.5 sm:flex-row">
            <label className="dub-search-field flex-1">
              <span className="dub-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                type="search"
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Search Hindi dub titles…"
                aria-label="Search dubbed titles"
                className="w-full rounded-xl border border-[var(--color-line)] bg-black/25 py-2.5 pl-10 pr-3 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-mute)]"
              />
            </label>
            {filters.language && <input type="hidden" name="language" value={filters.language} />}
            {filters.genre && <input type="hidden" name="genre" value={filters.genre} />}
            {filters.sort && filters.sort !== "recent" && <input type="hidden" name="sort" value={filters.sort} />}
            <button type="submit" className="dub-search-button rounded-xl px-5 py-2.5 text-sm font-bold">
              Search
            </button>
          </form>

          <div className="dub-filter-row mt-5">
            <span className="dub-filter-label">Language</span>
            <div className="dub-filter-chips">
              <Link
                href={hrefFor(basePath, filters, { language: undefined, page: 1 })}
                data-active={!filters.language ? "true" : undefined}
                data-tone="violet"
                className="dub-filter-chip"
              >
                All languages
              </Link>
              {languages.slice(0, 12).map((language) => (
                <Link
                  key={language.slug}
                  href={hrefFor(basePath, filters, { language: language.language, page: 1 })}
                  data-active={filters.language === language.language ? "true" : undefined}
                  data-tone="violet"
                  className="dub-filter-chip"
                >
                  {language.language}
                  <span className="dub-filter-chip-count">{language.total}</span>
                </Link>
              ))}
            </div>
          </div>

          {genres.length > 0 && (
            <div className="dub-filter-row mt-3">
              <span className="dub-filter-label">Genre</span>
              <div className="dub-filter-chips">
                <Link
                  href={hrefFor(basePath, filters, { genre: undefined, page: 1 })}
                  data-active={!filters.genre ? "true" : undefined}
                  data-tone="cyan"
                  className="dub-filter-chip"
                >
                  Any
                </Link>
                {genres.map((genre) => (
                  <Link
                    key={genre}
                    href={hrefFor(basePath, filters, { genre, page: 1 })}
                    data-active={filters.genre === genre ? "true" : undefined}
                    data-tone="cyan"
                    className="dub-filter-chip"
                  >
                    {genre}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="dub-filter-row mt-3">
            <span className="dub-filter-label">Sort</span>
            <div className="dub-filter-chips">
              {SORTS.map((sort) => {
                const active = (filters.sort ?? "recent") === sort.value;
                return (
                  <Link
                    key={sort.value}
                    href={hrefFor(basePath, filters, { sort: sort.value, page: 1 })}
                    data-active={active ? "true" : undefined}
                    data-tone="magenta"
                    className="dub-filter-chip"
                  >
                    {sort.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        {items.length > 0 ? (
          <StaggerGrid className="dub-catalog-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 sm:gap-5">
            {items.map((item) => (
              <StaggerItem key={item.id}>
                <DubTitleCard item={item} size="lg" />
              </StaggerItem>
            ))}
          </StaggerGrid>
        ) : (
          <div className="dub-catalog-empty rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-panel)] p-10 text-center">
            <p className="font-display text-lg font-bold text-[var(--color-ink)]">No titles match these filters.</p>
            <p className="mt-1 text-sm text-[var(--color-mute)]">Try another language, genre or search term.</p>
            <Link href={basePath} className="dub-catalog-reset mt-4 inline-flex rounded-full px-4 py-2 text-xs font-bold">
              Clear filters
            </Link>
          </div>
        )}
      </FadeIn>

      {totalPages > 1 && (
        <FadeIn delay={0.12} className="pt-1">
          <p className="dub-pagination-label mb-3 text-center font-mono text-[11px] text-[var(--color-mute)]">
            Page {page} of {totalPages}
          </p>
          <nav className="dub-pagination flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
            {page > 1 && (
              <Link href={hrefFor(basePath, filters, { page: page - 1 })} className="dub-page-link">
                ← Prev
              </Link>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
              .map((n, index, list) => (
                <span key={n} className="flex items-center gap-1.5">
                  {index > 0 && n - list[index - 1] > 1 && (
                    <span className="px-1 text-xs text-[var(--color-mute)]">…</span>
                  )}
                  <Link
                    href={hrefFor(basePath, filters, { page: n })}
                    data-active={n === page ? "true" : undefined}
                    className="dub-page-link min-w-9 text-center"
                  >
                    {n}
                  </Link>
                </span>
              ))}
            {page < totalPages && (
              <Link href={hrefFor(basePath, filters, { page: page + 1 })} className="dub-page-link">
                Next →
              </Link>
            )}
          </nav>
        </FadeIn>
      )}
    </section>
  );
}
