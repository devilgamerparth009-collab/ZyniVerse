"use client";

import { useEffect, useState, useRef, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";
import MangaCard from "@/components/MangaCard";
import AffiliateLink from "@/components/AffiliateLink";
import PlayAsiaPill from "@/components/PlayAsiaPill";
import RevealTitle from "@/components/RevealTitle";
import RevealLabel from "@/components/RevealLabel";
import EmptyState from "@/components/EmptyState";
import type { Media } from "@/lib/anilist";

interface MangaEntryDB {
  id: string;
  mediaId: number;
  title: string;
  coverImage: string | null;
  subType?: string;
  status: string;
  chapters: number;
  volumes: number;
  totalChapters: number | null;
  totalVolumes: number | null;
  score: number | null;
}

const FADE_UP = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } };

const TABS = [
  { key: "trending", label: "🔥 Trending" },
  { key: "popular", label: "⭐ Popular" },
  { key: "top", label: "🏆 Top Rated" },
];

const STATUS_FILTERS = ["ALL", "READING", "COMPLETED", "PLANNING", "PAUSED", "DROPPED"];
const STATUS_LABELS: Record<string, string> = { READING: "Reading", COMPLETED: "Completed", PLANNING: "Plan to Read", DROPPED: "Dropped", PAUSED: "On Hold", REREADING: "Re-reading" };

const GENRE_FILTERS = [
  { label: "All", value: "" },
  { label: "Fantasy", value: "Fantasy" },
  { label: "Romance", value: "Romance" },
  { label: "Action", value: "Action" },
  { label: "Comedy", value: "Comedy" },
  { label: "Drama", value: "Drama" },
  { label: "Sci-Fi", value: "Sci-Fi" },
  { label: "Slice of Life", value: "Slice of Life" },
  { label: "Mystery", value: "Mystery" },
  { label: "Horror", value: "Horror" },
  { label: "Supernatural", value: "Supernatural" },
];

const PILL_SPRING = { type: "spring" as const, stiffness: 500, damping: 40 };

export default function LightNovelBrowseClient({
  initialList = [],
  initialTotal = 0,
  initialHasNext = false,
}: {
  initialList?: Media[];
  initialTotal?: number;
  initialHasNext?: boolean;
}) {
  const { data: session } = useSession();
  const reduce = useReducedMotion() ?? false;
  const [tab, setTab] = useState("trending");
  const [list, setList] = useState<Media[]>(initialList);
  const [loading, setLoading] = useState(initialList.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myEntries, setMyEntries] = useState<MangaEntryDB[]>([]);
  const [listTab, setListTab] = useState("ALL");
  const [showMyList, setShowMyList] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasNext);
  const [myListTotal, setMyListTotal] = useState(0);
  const [myListStats, setMyListStats] = useState({ reading: 0, completed: 0, planning: 0, paused: 0, dropped: 0 });
  const [continueReading, setContinueReading] = useState<MangaEntryDB[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  // Reset to the first page and (re)load whenever a filter changes.
  useEffect(() => {
    // The server already rendered Trending page 1 — reuse it and skip the
    // first client request (avoids a redundant AniList fetch / rate-limit hit).
    if (
      !bootstrapped.current &&
      !showMyList &&
      !debouncedQuery.trim() &&
      !selectedGenre &&
      tab === "trending" &&
      initialList.length > 0
    ) {
      bootstrapped.current = true;
      return;
    }

    let cancelled = false;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setPage(1);

    async function run() {
      try {
        if (showMyList) {
          const params = new URLSearchParams();
          if (listTab !== "ALL") params.set("status", listTab);
          params.set("page", "1");
          const r = await fetch(`/api/light-novels/list?${params}`, { signal: controller.signal });
          const d = await r.json();
          if (cancelled) return;
          setMyEntries(d.entries || []);
          setMyListTotal(d.total || 0);
          setTotal(d.total || 0);
          setHasMore(Boolean(d.hasMore));
          return;
        }

        const params = debouncedQuery.trim()
          ? new URLSearchParams({ q: debouncedQuery.trim(), page: "1" })
          : new URLSearchParams({ tab, perPage: "24", page: "1" });
        if (selectedGenre) params.set("genre", selectedGenre);
        const url = debouncedQuery.trim()
          ? `/api/light-novels/search?${params}`
          : `/api/anilist/light-novels?${params}`;
        const r = await fetch(url, { signal: controller.signal });
        const d = await r.json();
        if (cancelled) return;
        setList(d.media || []);
        setTotal(d.pageInfo?.total ?? (d.media?.length ?? 0));
        setHasMore(Boolean(d.pageInfo?.hasNextPage));
      } catch (e) {
        if (!cancelled && (e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tab, showMyList, listTab, debouncedQuery, selectedGenre, initialList]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setLoadingMore(true);
    try {
      if (showMyList) {
        const params = new URLSearchParams();
        if (listTab !== "ALL") params.set("status", listTab);
        params.set("page", String(next));
        const r = await fetch(`/api/light-novels/list?${params}`);
        const d = await r.json();
        setMyEntries((prev) => [...prev, ...(d.entries || [])]);
        setHasMore(Boolean(d.hasMore));
      } else {
        const params = debouncedQuery.trim()
          ? new URLSearchParams({ q: debouncedQuery.trim(), page: String(next) })
          : new URLSearchParams({ tab, perPage: "24", page: String(next) });
        if (selectedGenre) params.set("genre", selectedGenre);
        const url = debouncedQuery.trim()
          ? `/api/light-novels/search?${params}`
          : `/api/anilist/light-novels?${params}`;
        const r = await fetch(url);
        const d = await r.json();
        setList((prev) => [...prev, ...(d.media || [])]);
        setHasMore(Boolean(d.pageInfo?.hasNextPage));
      }
      setPage(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, showMyList, listTab, debouncedQuery, selectedGenre, tab]);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/light-novels/stats")
      .then((r) => r.json())
      .then((d) => {
        const c = d.counts || {};
        setMyListStats({
          reading: c.READING || 0,
          completed: c.COMPLETED || 0,
          planning: c.PLANNING || 0,
          paused: c.PAUSED || 0,
          dropped: c.DROPPED || 0,
        });
        setContinueReading(d.reading || []);
      })
      .catch(() => {});
  }, [session]);

  const loadedCount = showMyList ? myEntries.length : list.length;
  const isEmpty = !loading && loadedCount === 0;

  const HERO_STATS = [
    { label: "Reading", value: myListStats.reading, color: "#00ffff" },
    { label: "Completed", value: myListStats.completed, color: "#8a2be2" },
    { label: "Planned", value: myListStats.planning, color: "#ff00ff" },
    { label: "On Hold", value: myListStats.paused, color: "#ffaa00" },
    { label: "Dropped", value: myListStats.dropped, color: "#ff4d6d" },
  ];

  return (
    <div className="lnv-page min-h-screen animate-page-in">
      {/* ═══════════════ HERO ═══════════════ */}
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <div className="lnv-hero relative overflow-hidden rounded-3xl border border-[var(--color-line)]">
          <div className="lnv-hero-glow" aria-hidden />
          <div className="lnv-hero-grid" aria-hidden />
          <div className="lnv-hero-inner relative grid gap-8 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
            <div className="lnv-hero-copy flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="lnv-hero-icon mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]/70 backdrop-blur-sm">
                <span className="text-xl">📖</span>
              </div>

              <RevealLabel
                as="span"
                spacing="0.2em"
                fromSpacing="0.4em"
                className="lnv-kicker mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-cyan)]"
              >
                Light Novels
              </RevealLabel>

              <div className="lnv-title-wrap mt-1 rounded-xl px-4 py-2">
                <RevealTitle
                  as="h1"
                  className="font-display text-4xl font-bold text-[var(--color-ink)] sm:text-5xl"
                >
                  Track Your <span className="lnv-title-accent">Reading Journey</span>
                </RevealTitle>
              </div>
              <p className="lnv-hero-subtitle mt-3 max-w-lg text-base text-[var(--color-mute)]">
                Discover trending light novels, track your progress, and find your next favorite series.
              </p>

              {/* Quick Stats */}
              {session?.user?.id && (
                <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3 lg:justify-start">
                  {HERO_STATS.map((s, i) => (
                    <div key={s.label} className="lnv-stat text-center" style={{ "--lnv-stat-i": i } as CSSProperties}>
                      <div className="font-mono text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-[9px] uppercase tracking-widest text-[var(--color-mute)]">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lnv-hero-art" aria-hidden>
              <span className="lnv-book-orbit" />
              <span className="lnv-book">
                <span className="lnv-book-page lnv-book-page-left" />
                <span className="lnv-book-page lnv-book-page-right" />
                <span className="lnv-book-spine" />
                <span className="lnv-book-shine" />
              </span>
              <span className="lnv-book-dot lnv-book-dot-a" />
              <span className="lnv-book-dot lnv-book-dot-b" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {/* Search */}
        <motion.div {...FADE_UP} className="lnv-panel">
          <div className="lnv-search rounded-xl bg-[var(--color-panel)]/60 backdrop-blur-sm">
            <form onSubmit={(e) => { e.preventDefault(); setShowMyList(false); }} className="flex items-center gap-3 px-4 py-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-mute)] shrink-0">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search light novels by title..."
                className="flex-1 bg-transparent text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-mute)]/50"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(""); setDebouncedQuery(""); }} className="text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              )}
              <button type="submit" className="lnv-search-btn rounded-xl px-6 py-2.5 text-sm font-bold">Search</button>
            </form>
          </div>
        </motion.div>

        {/* Toggle: Browse / My List */}
        <motion.div {...FADE_UP} className="lnv-panel">
          <div className="flex items-center gap-3 border-b border-[var(--color-line)] pb-3">
            <button
              onClick={() => { setShowMyList(false); setTab("trending"); setQuery(""); setDebouncedQuery(""); }}
              className={`lnv-toggle relative rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors ${!showMyList ? "is-active" : ""}`}
            >
              Browse
              {!showMyList && (
                <motion.span layoutId="ln-toggle-underline" className="lnv-toggle-underline absolute -bottom-3 left-0 right-0 h-0.5 rounded-full bg-[var(--color-cyan)]" />
              )}
            </button>
            {session?.user?.id && (
              <button
                onClick={() => setShowMyList(true)}
                className={`lnv-toggle relative rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors ${showMyList ? "is-active" : ""}`}
              >
                My List {myListTotal > 0 && <span className="ml-1 text-[10px] font-mono opacity-60">({myListTotal})</span>}
                {showMyList && (
                  <motion.span layoutId="ln-toggle-underline" className="lnv-toggle-underline absolute -bottom-3 left-0 right-0 h-0.5 rounded-full bg-[var(--color-cyan)]" />
                )}
              </button>
            )}
            <Link href="/search?type=MANGA&format=NOVEL"
              className="lnv-text-link ml-auto text-xs text-[var(--color-mute)] transition-colors"
            >Advanced Search →</Link>
          </div>
        </motion.div>

        {/* Continue Reading */}
        {!showMyList && !debouncedQuery.trim() && continueReading.length > 0 && (
          <motion.div {...FADE_UP} className="lnv-panel">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="lnv-section-title flex items-center gap-2 font-display text-lg font-bold">
                <span className="lnv-section-mark" aria-hidden />
                Continue Reading
              </h2>
              <button onClick={() => setShowMyList(true)} className="lnv-text-link text-xs text-[var(--color-mute)] transition-colors">
                View list →
              </button>
            </div>
            <div className="lnv-rail -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
              {continueReading.map((entry, i) => (
                <div key={entry.id} className="lnv-card-cell w-32 shrink-0 snap-start" style={{ "--lnv-i": i } as CSSProperties}>
                  <MangaCard manga={entry} entry={entry} showProgress index={i} subtle />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Browse Tabs + Genre Filters */}
        {!showMyList && !debouncedQuery.trim() && (
          <motion.div {...FADE_UP} className="lnv-panel space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`lnv-chip lnv-chip-lg relative rounded-xl px-6 py-3 text-sm font-bold transition-colors ${active ? "is-active" : ""}`}
                  >
                    {active && <motion.span layoutId="ln-tab-bg" className="lnv-chip-bg absolute inset-0 rounded-xl" transition={reduce ? { duration: 0 } : PILL_SPRING} />}
                    <span className="relative z-10">{t.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {GENRE_FILTERS.map((g) => {
                const isActive = selectedGenre === g.value;
                return (
                  <button key={g.value || "all"} onClick={() => setSelectedGenre(g.value)}
                    className={`lnv-chip relative rounded-xl px-4 py-2 text-xs font-bold transition-colors ${isActive ? "is-active" : ""}`}
                  >
                    {isActive && <motion.span layoutId="ln-genre-bg" className="lnv-chip-bg absolute inset-0 rounded-xl" transition={reduce ? { duration: 0 } : PILL_SPRING} />}
                    <span className="relative z-10">{g.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* My List Status Tabs */}
        {showMyList && (
          <motion.div {...FADE_UP} className="lnv-panel">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((s) => (
                <button key={s} onClick={() => setListTab(s)}
                  className={`lnv-chip lnv-chip-lg relative rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${listTab === s ? "is-active" : ""}`}
                >
                  {listTab === s && <motion.span layoutId="ln-status-bg" className="lnv-chip-bg absolute inset-0 rounded-xl" transition={reduce ? { duration: 0 } : PILL_SPRING} />}
                  <span className="relative z-10">{s === "ALL" ? "All" : STATUS_LABELS[s] || s}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Affiliate Links */}
        <motion.div {...FADE_UP} className="lnv-panel lnv-affiliates flex flex-wrap gap-3">
          <AffiliateLink partner="bookwalker" path="https://global.bookwalker.jp"
            className="lnv-affiliate lnv-affiliate-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all"
          >📖 Buy on BookWalker</AffiliateLink>
          <AffiliateLink partner="amazon" path="https://www.amazon.in/s?k=light+novel"
            className="lnv-affiliate inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all"
          >📦 Buy on Amazon</AffiliateLink>
          <PlayAsiaPill query="light novel merch" label="Play-Asia merch" className="lnv-affiliate" />
        </motion.div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Grid */}
        <motion.div {...FADE_UP} className="lnv-panel lnv-grid-panel">
          {!loading && total > 0 && (
            <p className="lnv-count mb-3 text-xs font-mono uppercase tracking-widest text-[var(--color-mute)]">
              {total.toLocaleString()} light novel{total === 1 ? "" : "s"}
            </p>
          )}

          {loading ? (
            <div className="lnv-grid grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="lnv-skeleton rounded-xl bg-[var(--color-panel)]/60 backdrop-blur-sm overflow-hidden">
                  <div className="aspect-[3/4] bg-[var(--color-void)]" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 w-3/4 bg-[var(--color-void)] rounded" />
                    <div className="h-3 w-1/2 bg-[var(--color-void)] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : showMyList ? (
            <div className="lnv-grid grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {myEntries.map((entry, i) => (
                <div key={entry.id} className="lnv-card-cell" style={{ "--lnv-i": i } as CSSProperties}>
                  <MangaCard manga={entry} entry={entry} showProgress index={i} subtle />
                </div>
              ))}
            </div>
          ) : (
            <div className="lnv-grid grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {list.map((m, i) => (
                <div key={m.id} className="lnv-card-cell" style={{ "--lnv-i": i } as CSSProperties}>
                  <MangaCard manga={m} index={i} href={`/light-novels/${m.id}`} subtle />
                </div>
              ))}
            </div>
          )}

          {isEmpty && (
            showMyList ? (
              <EmptyState
                icon="bookmark"
                title="Your list is empty"
                description="Search and add light novels to start tracking your reading."
                actionLabel="Browse Light Novels"
                onAction={() => setShowMyList(false)}
              />
            ) : debouncedQuery ? (
              <EmptyState
                icon="search"
                title="No light novels found"
                description={`Nothing matched "${debouncedQuery}".`}
                actionLabel="Clear search"
                onAction={() => { setQuery(""); setDebouncedQuery(""); }}
              />
            ) : (
              <EmptyState
                icon="search"
                title="No light novels found"
                description="Try a different genre or tab."
              />
            )
          )}

          {!loading && hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="lnv-load-more rounded-full px-8 py-3 text-sm font-bold transition-all disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load More"}
              </button>
            </div>
          )}
        </motion.div>
      </div>

      <div className="h-12" />
    </div>
  );
}
