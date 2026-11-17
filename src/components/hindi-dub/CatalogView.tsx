import Link from "next/link";
import { DubTitleGrid } from "./DubTitleCard";
import type { DubTitleDTO } from "@/lib/dub-import/queries";

export interface CatalogFilterState {
  q?: string;
  language?: string;
  genre?: string;
  sort?: string;
}

interface CatalogViewProps {
  basePath: string;
  title: string;
  subtitle: string;
  items: DubTitleDTO[];
  total: number;
  page: number;
  totalPages: number;
  filters: CatalogFilterState;
  languages: { language: string; slug: string; total: number }[];
  genres: string[];
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
  title,
  subtitle,
  items,
  total,
  page,
  totalPages,
  filters,
  languages,
  genres,
}: CatalogViewProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)] sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-[var(--color-mute)]">{subtitle}</p>
        </div>
        <p className="text-xs uppercase tracking-wide text-[var(--color-mute)]">
          {total.toLocaleString("en-IN")} titles
        </p>
      </div>

      <form action={basePath} className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search Hindi dub titles…"
          className="min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-mute)] focus:border-[var(--color-violet)]"
        />
        {filters.language && <input type="hidden" name="language" value={filters.language} />}
        {filters.genre && <input type="hidden" name="genre" value={filters.genre} />}
        {filters.sort && filters.sort !== "recent" && <input type="hidden" name="sort" value={filters.sort} />}
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-violet)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={hrefFor(basePath, filters, { language: undefined, page: 1 })}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            filters.language
              ? "border-[var(--color-line)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              : "border-[var(--color-violet)] bg-[var(--color-violet)]/15 text-[var(--color-ink)]"
          }`}
        >
          All languages
        </Link>
        {languages.slice(0, 12).map((language) => (
          <Link
            key={language.slug}
            href={hrefFor(basePath, filters, { language: language.language, page: 1 })}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filters.language === language.language
                ? "border-[var(--color-violet)] bg-[var(--color-violet)]/15 text-[var(--color-ink)]"
                : "border-[var(--color-line)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            {language.language}
            <span className="ml-1 text-[10px] opacity-60">{language.total}</span>
          </Link>
        ))}
      </div>

      {genres.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-[var(--color-mute)]">Genre</span>
          <Link
            href={hrefFor(basePath, filters, { genre: undefined, page: 1 })}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
              filters.genre
                ? "border-[var(--color-line)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                : "border-[var(--color-cyan)]/60 text-[var(--color-cyan)]"
            }`}
          >
            Any
          </Link>
          {genres.map((genre) => (
            <Link
              key={genre}
              href={hrefFor(basePath, filters, { genre, page: 1 })}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                filters.genre === genre
                  ? "border-[var(--color-cyan)]/60 text-[var(--color-cyan)]"
                  : "border-[var(--color-line)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              {genre}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-[var(--color-mute)]">Sort</span>
        {SORTS.map((sort) => {
          const active = (filters.sort ?? "recent") === sort.value;
          return (
            <Link
              key={sort.value}
              href={hrefFor(basePath, filters, { sort: sort.value, page: 1 })}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                active
                  ? "border-[var(--color-magenta)]/60 text-[var(--color-magenta)]"
                  : "border-[var(--color-line)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              {sort.label}
            </Link>
          );
        })}
      </div>

      <DubTitleGrid items={items} />

      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-1 pt-2">
          {page > 1 && (
            <Link
              href={hrefFor(basePath, filters, { page: page - 1 })}
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-mute)] transition hover:text-[var(--color-ink)]"
            >
              ← Prev
            </Link>
          )}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
            .map((n, index, list) => (
              <span key={n} className="flex items-center gap-1">
                {index > 0 && n - list[index - 1] > 1 && (
                  <span className="px-1 text-xs text-[var(--color-mute)]">…</span>
                )}
                <Link
                  href={hrefFor(basePath, filters, { page: n })}
                  className={`min-w-9 rounded-lg border px-3 py-1.5 text-center text-sm transition ${
                    n === page
                      ? "border-[var(--color-violet)] bg-[var(--color-violet)]/20 text-[var(--color-ink)]"
                      : "border-[var(--color-line)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {n}
                </Link>
              </span>
            ))}
          {page < totalPages && (
            <Link
              href={hrefFor(basePath, filters, { page: page + 1 })}
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-mute)] transition hover:text-[var(--color-ink)]"
            >
              Next →
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
