"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion, animate, useInView, useMotionValue, useTransform, useScroll, useSpring } from "framer-motion";
import { DOUJINSHI_GENRE_TAGS, type DoujinshiEntry } from "@/lib/mangadex-api";
import DoujinshiCard from "@/components/DoujinshiCard";
import DoujinshiFlexCard from "@/components/DoujinshiFlexCard";
import RevealTitle from "@/components/RevealTitle";
import { logError } from "@/lib/logger";

const FADE_UP = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } };

/** Neon progress line pinned to the top; fills as the page is scrolled. */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-[#ff00ff] via-[#8a2be2] to-[#00ffff] shadow-[0_0_12px_rgba(255,0,255,0.6)]"
    />
  );
}

/** Counts up from 0 the first time it scrolls into view. */
function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration: 0.9, ease: "easeOut" });
    return () => controls.stop();
  }, [inView, value, mv]);
  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}

/** Card-grid skeleton shown while the featured rails load. */
function RailsSkeleton() {
  return (
    <div className="space-y-10" aria-hidden>
      {[8, 5].map((count, row) => (
        <div key={row}>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-[var(--color-panel)] animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-[var(--color-panel)] animate-pulse" />
              <div className="h-3 w-24 rounded bg-[var(--color-panel)] animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="neon-rgb-border rounded-xl bg-[var(--color-panel)]/60 backdrop-blur-sm overflow-hidden animate-pulse">
                <div className="aspect-[3/4] bg-[var(--color-void)]" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-[var(--color-void)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--color-void)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Only offer tags the API can filter server-side, so counts + pagination stay accurate.
const GENRE_TAGS = [
  { label: "All", value: "" },
  ...DOUJINSHI_GENRE_TAGS.map((g) => ({ label: g, value: g })),
];

const SORTS = [
  { value: "popular", label: "🔥 Popular" },
  { value: "latest", label: "🆕 Latest" },
  { value: "rating", label: "⭐ Rating" },
  { value: "title", label: "🔤 Title" },
] as const;
type SortKey = (typeof SORTS)[number]["value"];

// MangaDex translatedLanguage codes.
const LANGUAGES = [
  { value: "", label: "All Languages" },
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "pt-br", label: "Portuguese" },
  { value: "zh", label: "Chinese" },
  { value: "ko", label: "Korean" },
  { value: "ru", label: "Russian" },
  { value: "id", label: "Indonesian" },
  { value: "vi", label: "Vietnamese" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
];

export default function DoujinshiBrowseClient() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  // Initialize filters from the URL so links are shareable/bookmarkable.
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get("q") ?? "");
  const [selectedTag, setSelectedTag] = useState(() => searchParams.get("tag") ?? "");
  const [sort, setSort] = useState<SortKey>(() => {
    const s = searchParams.get("sort");
    return SORTS.some((x) => x.value === s) ? (s as SortKey) : "popular";
  });
  const [language, setLanguage] = useState(() => searchParams.get("lang") ?? "");
  const [entries, setEntries] = useState<DoujinshiEntry[]>([]);
  const [trending, setTrending] = useState<DoujinshiEntry[]>([]);
  const [popular, setPopular] = useState<DoujinshiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [error, setError] = useState("");
  const [trackedMap, setTrackedMap] = useState<Record<string, string>>({});
  const [trackedCount, setTrackedCount] = useState(0);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [showBrowse, setShowBrowse] = useState(() =>
    Boolean(
      searchParams.get("q") ||
        searchParams.get("tag") ||
        searchParams.get("sort") ||
        searchParams.get("lang") ||
        searchParams.get("page"),
    ),
  );
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get("page")) || 1));
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const didMountRef = useRef(false);
  const prevNavRef = useRef({ sort, selectedTag, language, page });

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch trending + popular on mount
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");

    Promise.all([
      fetch("/api/doujinshi?sort=latest&perPage=10").then((r) => r.json()),
      fetch("/api/doujinshi?sort=popular&perPage=10").then((r) => r.json()),
    ])
      .then(([t, p]) => {
        if (cancelled) return;
        setTrending(t.entries || []);
        setPopular(p.entries || []);
        setLibraryTotal(Math.max(t.total || 0, p.total || 0));
        if ((t.entries || []).length === 0 && (p.entries || []).length === 0) {
          setError("Could not load doujinshi from MangaDex. Please try again later.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load doujinshi. Check your connection.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Fetch browse results
  useEffect(() => {
    if (!showBrowse) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrowseLoading(true);
    setError("");

    const sp = new URLSearchParams();
    if (debouncedSearch) sp.set("search", debouncedSearch);
    if (sort) sp.set("sort", sort);
    if (selectedTag) sp.set("genres", selectedTag);
    if (language) sp.set("lang", language);
    sp.set("perPage", "50");
    sp.set("page", String(page));

    fetch(`/api/doujinshi?${sp.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.error) {
          setError(data.error);
          setEntries([]);
        } else {
          setEntries(data.entries || []);
          setTotal(data.total || 0);
          setHasMore(data.hasMore || false);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("Failed to search. Please try again.");
          setEntries([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBrowseLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, sort, selectedTag, language, showBrowse, page]);

  // Reset to page 1 when filters change (but not on the initial URL-driven render).
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setPage(1);
  }, [debouncedSearch, sort, selectedTag, language]);

  // Keep the URL in sync with the filters (shareable links + working back/forward).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams();
    if (debouncedSearch) sp.set("q", debouncedSearch);
    if (sort !== "popular") sp.set("sort", sort);
    if (selectedTag) sp.set("tag", selectedTag);
    if (language) sp.set("lang", language);
    if (page > 1) sp.set("page", String(page));
    const qs = sp.toString();
    const target = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (target === current) return;
    const prev = prevNavRef.current;
    const discrete =
      prev.sort !== sort || prev.selectedTag !== selectedTag || prev.language !== language || prev.page !== page;
    prevNavRef.current = { sort, selectedTag, language, page };
    if (discrete) window.history.pushState(null, "", target);
    else window.history.replaceState(null, "", target);
  }, [debouncedSearch, sort, selectedTag, language, page]);

  // Restore filter state when the user navigates back/forward.
  useEffect(() => {
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search);
      const q = sp.get("q") ?? "";
      const tag = sp.get("tag") ?? "";
      const lang = sp.get("lang") ?? "";
      const s = sp.get("sort");
      const nextSort: SortKey = SORTS.some((x) => x.value === s) ? (s as SortKey) : "popular";
      const nextPage = Math.max(1, Number(sp.get("page")) || 1);
      prevNavRef.current = { sort: nextSort, selectedTag: tag, language: lang, page: nextPage };
      setSearch(q);
      setDebouncedSearch(q);
      setSelectedTag(tag);
      setLanguage(lang);
      setSort(nextSort);
      setPage(nextPage);
      setShowBrowse(Boolean(sp.toString()));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Fetch tracked status
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/doujinshi/my")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {};
        data.entries?.forEach((e: { doujinshi: { id: string }; entry: { status: string } }) => {
          map[e.doujinshi.id] = e.entry.status;
        });
        setTrackedMap(map);
        setTrackedCount(Object.keys(map).length);
      })
      .catch(() => {});
  }, [session]);

  // Tags for the hero ticker strip (derived from the featured sections).
  const marqueeTags = useMemo(() => {
    const tags = new Set<string>();
    [...trending, ...popular].forEach((d) => d.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).slice(0, 28);
  }, [trending, popular]);

  const handleTrack = useCallback(async (id: string, status: string) => {
    if (!session?.user?.id) return;
    try {
      // Empty status = untrack (DELETE), otherwise upsert the given status (POST).
      const res = status
        ? await fetch(`/api/doujinshi/${id}/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          })
        : await fetch(`/api/doujinshi/${id}/track`, { method: "DELETE" });
      if (res.ok) {
        setTrackedMap((prev) => {
          const next = { ...prev };
          if (status) next[id] = status;
          else delete next[id];
          return next;
        });
      }
    } catch (e) { logError(e); }
  }, [session]);

  const startBrowse = () => {
    setShowBrowse(true);
    setPage(1);
  };

  // Featured rails are still loading (and we have nothing yet) → skeleton.
  const showRailsSkeleton = loading && trending.length === 0 && popular.length === 0;

  return (
    <div className="min-h-screen animate-page-in">
      <ScrollProgress />
      {/* ═══════════════ HERO ═══════════════ */}
      <div className="djb-hero">
        <span className="djb-hero-orb djb-hero-orb-a" aria-hidden="true" />
        <span className="djb-hero-orb djb-hero-orb-b" aria-hidden="true" />
        <span className="djb-hero-orb djb-hero-orb-c" aria-hidden="true" />
        <span className="djb-hero-grid" aria-hidden="true" />
        <span className="djb-hero-scan" aria-hidden="true" />

        <div className="djb-hero-inner">
          <div className="djb-hero-main">
            <div className="djb-hero-badge">
              <span className="djb-hero-icon" aria-hidden="true">📚</span>
              <span>Doujinshi</span>
              <span className="djb-hero-badge-line" aria-hidden="true" />
            </div>

            <div className="djb-title-frame">
              <RevealTitle
                as="h1"
                delay={0.15}
                className="djb-title"
              >
                Fan Works & <span className="djb-title-accent">Creations</span>
              </RevealTitle>
            </div>

            <p className="djb-hero-copy">
              Discover, track, and explore doujinshi from MangaDex. Fan-made masterpieces from your favorite series.
            </p>

            <div className="djb-hero-rule" aria-hidden="true" />
          </div>

          <div className="djb-stats-card">
            <span className="djb-stats-glow" aria-hidden="true" />
            <div className="djb-stats-head">
              <span className="djb-stats-head-left">
                <span className="djb-stats-pulse" aria-hidden="true" />
                <span>Catalogue snapshot</span>
              </span>
              <span className="djb-stats-live" aria-hidden="true">
                <i /><i /><i />
              </span>
            </div>

            <div className="djb-stat-grid">
              <div className="djb-stat djb-stat-magenta">
                <div className="djb-stat-top">
                  <span className="djb-stat-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 4.5h6v15H5z" />
                      <path d="M13 7.5h6v12h-6z" />
                      <path d="M3.5 19.5h17" />
                    </svg>
                  </span>
                  <span className="djb-stat-spark" aria-hidden="true" />
                </div>
                <CountUp value={libraryTotal} className="djb-stat-value" />
                <span className="djb-stat-label">In Library</span>
                <span className="djb-stat-track" aria-hidden="true" />
              </div>
              <div className="djb-stat djb-stat-cyan">
                <div className="djb-stat-top">
                  <span className="djb-stat-icon" aria-hidden="true">
                    {session ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 3.5h12v17l-6-4-6 4z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.5 3H20v7.5L11.5 19a2 2 0 0 1-2.8 0L4 14.3a2 2 0 0 1 0-2.8L12.5 3z" />
                        <circle cx="16.5" cy="7.5" r="1.2" />
                      </svg>
                    )}
                  </span>
                  <span className="djb-stat-spark" aria-hidden="true" />
                </div>
                <CountUp value={session ? trackedCount : DOUJINSHI_GENRE_TAGS.length} className="djb-stat-value" />
                <span className="djb-stat-label">{session ? "Tracked" : "Genres"}</span>
                <span className="djb-stat-track" aria-hidden="true" />
              </div>
            </div>

            {session ? (
              <Link href="/doujinshi/my" className="djb-hero-cta djb-hero-cta-primary">
                <span className="djb-cta-shine" aria-hidden="true" />
                <span>My Doujinshi →</span>
              </Link>
            ) : (
              <Link href="/login?next=%2Fdoujinshi" className="djb-hero-cta">
                <span className="djb-cta-shine" aria-hidden="true" />
                <span>Sign in to track →</span>
              </Link>
            )}

            <div className="djb-stats-foot" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>

        <div className="djb-hero-line" aria-hidden="true" />
      </div>

      {/* ═══════════════ TAG TICKER ═══════════════ */}
      {marqueeTags.length > 0 && (
        <div className="djb-ticker ticker-window relative overflow-hidden border-b border-[var(--color-line)] bg-[var(--color-void)]/70">
          <span className="djb-ticker-aura" aria-hidden="true" />
          <div className="ticker-track djb-ticker-track flex w-max will-change-transform">
            {[0, 1].map((copy) => (
              <div key={copy} className="djb-ticker-group flex shrink-0" aria-hidden={copy === 1}>
                {[...marqueeTags, ...marqueeTags, ...marqueeTags].map((tag, i) => (
                  <button
                    key={`${tag}-${i}`}
                    type="button"
                    tabIndex={copy === 1 ? -1 : undefined}
                    onClick={() => { setSelectedTag(tag); setShowBrowse(true); }}
                    className="djb-tag-chip"
                  >
                    <span className="djb-tag-hash">#</span>
                    <span className="djb-tag-name">{tag}</span>
                    <span className="djb-tag-diamond">◆</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-10">
        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {showRailsSkeleton ? (
          <RailsSkeleton />
        ) : (
        <>
        {/* ═══════════════ TRENDING ═══════════════ */}
        {trending.length > 0 && !showBrowse && (
          <motion.div {...FADE_UP} className="djb-trend-section">
            <div className="djb-trend-head">
              <span className="djb-trend-mark" aria-hidden="true">🔥</span>
              <div className="djb-trend-copy">
                <RevealTitle text="Trending Now" as="h2" delay={0.05} className="djb-trend-title" />
                <p className="djb-trend-sub">Latest uploads from MangaDex</p>
              </div>
              <span className="djb-trend-wave" aria-hidden="true" />
              <span className="djb-trend-under" aria-hidden="true" />
            </div>
            <DoujinshiFlexCard items={trending.slice(0, 8)} />
          </motion.div>
        )}

        {/* ═══════════════ POPULAR ═══════════════ */}
        {popular.length > 0 && !showBrowse && (
          <motion.div {...FADE_UP}>
            <div className="djb-pop-head">
              <span className="djb-pop-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7.5l4.2 3.4L12 5l4.8 5.9L21 7.5l-1.6 10.2H4.6L3 7.5z" />
                  <path d="M4.8 20.2h14.4" />
                </svg>
              </span>
              <div className="djb-pop-copy">
                <RevealTitle text="Most Popular" as="h2" delay={0.05} className="djb-pop-title" />
                <p className="djb-pop-sub">Highest followed doujinshi</p>
              </div>
              <span className="djb-pop-spark" aria-hidden="true" />
              <span className="djb-pop-under" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {popular.slice(0, 5).map((entry, i) => (
                <DoujinshiCard key={entry.id} entry={entry} onTrack={handleTrack} trackedStatus={trackedMap[entry.id] || null} index={i} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══════════════ BROWSE TOGGLE ═══════════════ */}
        {!showBrowse && (
          <motion.div {...FADE_UP} className="djb-all-cta-wrap">
            <span className="djb-all-cta-glow" aria-hidden="true" />
            <button
              onClick={startBrowse}
              className="djb-all-cta"
            >
              <span className="djb-all-cta-shine" aria-hidden="true" />
              <span className="djb-all-cta-label">Browse All Doujinshi →</span>
            </button>
          </motion.div>
        )}

        {/* ═══════════════ BROWSE SECTION ═══════════════ */}
        {showBrowse && (
          <motion.div {...FADE_UP} className="djb-browse-wrap space-y-6">
            {/* Back + Search + Sort */}
            <div className="djb-browse-panel">
              <span className="djb-browse-aura" aria-hidden="true" />

              <button
                onClick={() => setShowBrowse(false)}
                className="djb-browse-back"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="djb-back-arrow"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                <span>Back to Overview</span>
              </button>

              <div className="djb-browse-controls">
                <div className="djb-browse-search-wrap">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="djb-search-icon">
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search doujinshi by title..."
                    aria-label="Search doujinshi by title"
                    className="djb-browse-search"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} aria-label="Clear search" className="djb-browse-clear">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                <div className="djb-browse-sorts" role="group" aria-label="Sort results">
                  {SORTS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setSort(s.value)}
                      aria-pressed={sort === s.value}
                      className="djb-sort-btn"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="djb-browse-lang">
                <label htmlFor="doujinshi-lang" className="djb-browse-label">Language</label>
                <div className="djb-select-wrap">
                  <select
                    id="doujinshi-lang"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="djb-browse-select"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value} className="bg-[var(--color-void)] text-[var(--color-ink)]">
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="djb-browse-divider" aria-hidden="true" />

              {/* Tag Filters */}
              <div className="djb-browse-tags" role="group" aria-label="Filter by genre">
                {GENRE_TAGS.map((tag) => (
                  <button
                    key={tag.value}
                    onClick={() => setSelectedTag(tag.value)}
                    aria-pressed={selectedTag === tag.value}
                    className="djb-genre-chip"
                  >
                    {tag.label}
                  </button>
                ))}
              </div>

              {/* Results count */}
              {total > 0 && (
                <p className="djb-browse-count">
                  Showing <span className="djb-count-num">{entries.length}</span> of <span className="djb-count-num">{total}</span> results
                  {debouncedSearch && <> for &quot;<span className="djb-count-term">{debouncedSearch}</span>&quot;</>}
                </p>
              )}
            </div>

            {/* Results */}
            {browseLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="neon-rgb-border rounded-xl bg-[var(--color-panel)]/60 backdrop-blur-sm overflow-hidden animate-pulse">
                    <div className="aspect-[3/4] bg-[var(--color-void)]" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 w-3/4 bg-[var(--color-void)] rounded" />
                      <div className="h-3 w-1/2 bg-[var(--color-void)] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-4xl block mb-3">🔍</span>
                <p className="text-sm text-[var(--color-mute)]">
                  {debouncedSearch
                    ? `No doujinshi found for "${debouncedSearch}"`
                    : "No doujinshi found matching your filters."
                  }
                </p>
                {debouncedSearch && (
                  <button
                    onClick={() => { setSearch(""); setSelectedTag(""); }}
                    className="mt-3 text-xs text-[var(--color-cyan)] hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {entries.map((entry, i) => (
                    <DoujinshiCard key={entry.id} entry={entry} onTrack={handleTrack} trackedStatus={trackedMap[entry.id] || null} index={i} />
                  ))}
                </div>

                {/* Pagination */}
                {(hasMore || page > 1) && (
                  <div className="djb-page-bar">
                    <span className="djb-page-rail" aria-hidden="true" />
                    {page > 1 && (
                      <button
                        onClick={() => setPage((p) => p - 1)}
                        className="djb-page-btn djb-page-prev"
                      ><span>← Previous</span></button>
                    )}
                    {hasMore && (
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        className="djb-page-btn djb-page-next"
                      ><span>Next →</span></button>
                    )}
                    <span className="djb-page-rail" aria-hidden="true" />
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
        </>
        )}
      </div>

      <div className="h-12" />
    </div>
  );
}
