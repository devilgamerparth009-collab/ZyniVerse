"use client";

import { useEffect, useRef, useState } from "react";
import { DubTitleCard } from "@/components/hindi-dub/DubTitleCard";
import type { DubTitleDTO } from "@/lib/dub-import/queries";

/** Public `/api/dub/catalog` results omit internal source fields. */
export type PublicDubTitle = Omit<DubTitleDTO, "source" | "sourceName">;

type SortKey = "recent" | "title" | "rating" | "year";

interface CatalogResult {
  items: PublicDubTitle[];
  total: number;
  page: number;
  totalPages: number;
}

const LIMIT = 12;

const SORTS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently updated" },
  { value: "title", label: "A–Z" },
  { value: "rating", label: "Top rated" },
  { value: "year", label: "Newest year" },
];

export default function IndianDubCatalogBrowser({
  initial,
  languages,
}: {
  initial: CatalogResult;
  languages: { language: string; total: number }[];
}) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("All");
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CatalogResult>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);

      const params = new URLSearchParams({
        limit: String(LIMIT),
        sort,
        page: String(page),
      });
      const term = query.trim();
      if (term) params.set("q", term);
      if (language !== "All") params.set("language", language);

      try {
        const response = await fetch(`/api/dub/catalog?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const json = (await response.json()) as {
          success?: boolean;
          items?: PublicDubTitle[];
          total?: number;
          page?: number;
          totalPages?: number;
        };
        if (!json.success || !Array.isArray(json.items)) throw new Error("Invalid response");

        setResult({
          items: json.items,
          total: json.total ?? 0,
          page: json.page ?? page,
          totalPages: json.totalPages ?? 1,
        });
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, language, sort, page]);

  const hasFilters = Boolean(query.trim()) || language !== "All" || sort !== "recent";
  const languageOptions = languages.slice(0, 7);

  function reset() {
    setQuery("");
    setLanguage("All");
    setSort("recent");
    setPage(1);
  }

  return (
    <section
      id="catalogue"
      className="idub-browser dub-section scroll-mt-24 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-7 lg:p-8"
      style={{ "--dub-accent": "var(--color-cyan)" } as React.CSSProperties}
      aria-label="Live Indian dub catalogue"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="dub-eyebrow">Live catalogue</p>
          <h2 className="dub-section-title font-display mt-1.5 text-2xl font-black text-[var(--color-ink)] sm:text-3xl">
            Browse every listed dub
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-mute)]">
            Search, filter and sort the real catalogue. Results come from the live dub listing and update after each sync.
          </p>
        </div>
        <div className="idub-browser-count rounded-full border border-[var(--color-line)] bg-black/25 px-3 py-1.5 font-mono text-xs text-[var(--color-mute)]" aria-live="polite">
          {loading ? "Loading…" : `${result.total.toLocaleString("en-IN")} titles`}
        </div>
      </div>

      <div className="idub-browser-controls mt-5 rounded-xl border border-[var(--color-line)] bg-black/20 p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <label className="idub-browser-search relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)]" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search a title…"
              aria-label="Search the live dub catalogue"
              className="w-full rounded-lg border border-[var(--color-line)] bg-black/30 py-2.5 pl-9 pr-3 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-mute)] focus:border-[var(--color-cyan)]/60"
            />
          </label>

          <label className="sr-only" htmlFor="idub-sort">Sort catalogue</label>
          <select
            id="idub-sort"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortKey);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-cyan)]/60"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={reset}
              className="idub-browser-reset rounded-lg px-3 py-2.5 text-sm font-bold text-[var(--color-mute)] transition hover:text-[var(--color-ink)]"
            >
              Reset
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2" aria-label="Filter by language">
          {[{ language: "All", total: result.total }, ...languageOptions].map((option) => {
            const active = language === option.language;
            return (
              <button
                key={option.language}
                type="button"
                data-active={active}
                onClick={() => {
                  setLanguage(option.language);
                  setPage(1);
                }}
                className="idub-browser-chip rounded-full border px-3 py-1.5 text-xs font-semibold text-[var(--color-mute)]"
              >
                {option.language}
                <span className="ml-1.5 font-mono text-[10px] opacity-70">{option.total.toLocaleString("en-IN")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 px-4 py-3 text-xs text-[var(--color-amber)]" role="status">
          The catalogue didn&apos;t respond this time. Please try another filter in a moment.
        </p>
      )}

      <div className={`idub-browser-grid mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 ${loading ? "is-loading" : ""}`}>
        {result.items.map((item, index) => (
          <div
            key={item.id}
            className="idub-catalog-card min-w-0"
            style={{ animationDelay: `${Math.min(index, 11) * 35}ms` }}
          >
            <DubTitleCard item={item} />
          </div>
        ))}
      </div>

      {result.items.length === 0 && !loading && !error && (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] bg-black/20 p-8 text-center">
          <p className="font-semibold text-[var(--color-ink)]">No titles match those filters</p>
          <p className="mt-1 text-xs text-[var(--color-mute)]">Try another language or clear the search.</p>
        </div>
      )}

      <nav className="mt-6 flex flex-wrap items-center justify-center gap-3" aria-label="Catalogue pagination">
        <button
          type="button"
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          disabled={page <= 1 || loading}
          className="idub-page-button rounded-full border border-[var(--color-line)] px-4 py-2 text-xs font-bold text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Previous
        </button>
        <span className="font-mono text-xs text-[var(--color-mute)]">
          Page {result.page} / {result.totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((value) => Math.min(result.totalPages, value + 1))}
          disabled={page >= result.totalPages || loading}
          className="idub-page-button rounded-full border border-[var(--color-line)] px-4 py-2 text-xs font-bold text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </nav>
    </section>
  );
}
