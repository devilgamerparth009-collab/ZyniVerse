"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import { CardSkeleton } from "@/components/Loader";
import { PageTransition } from "@/components/PageTransition";
import MangaCard from "@/components/MangaCard";
import MangaSearch from "@/components/MangaSearch";
import AffiliateLink from "@/components/AffiliateLink";
import PlayAsiaPill from "@/components/PlayAsiaPill";
import AdBanner from "@/components/AdBanner";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  MANGA_TYPE_OPTIONS,
  getMediaTypeLabel,
  getMediaTypeColor,
  type MangaTypeKey,
} from "@/lib/manga";
import type { Media } from "@/lib/anilist";

interface MangaEntryDB {
  id: string;
  mediaId: number;
  title: string;
  coverImage: string | null;
  status: string;
  chapters: number;
  volumes: number;
  totalChapters: number | null;
  totalVolumes: number | null;
  score: number | null;
  subType?: string | null;
  mangaDexId?: string | null;
  updatedAt?: string;
}

interface HistoryItem {
  chapter: number;
  title: string | null;
  readAt: string | null;
  entry: {
    mediaId: number;
    title: string;
    coverImage: string | null;
    subType: string | null;
    mangaDexId: string | null;
    chapters?: number;
    totalChapters?: number | null;
    score?: number | null;
  } | null;
}

const BROWSE_TABS = [
  { key: "trending", label: "Trending" },
  { key: "popular", label: "Popular" },
  { key: "top", label: "Top Rated" },
] as const;
type BrowseTab = (typeof BROWSE_TABS)[number]["key"];

const LIST_TABS = [
  "ALL",
  "READING",
  "COMPLETED",
  "PLANNING",
  "PAUSED",
  "DROPPED",
] as const;
type ListTab = (typeof LIST_TABS)[number];

const SORT_OPTIONS = [
  { key: "updated", label: "Recently updated" },
  { key: "title", label: "Title A–Z" },
  { key: "score", label: "Top rated" },
  { key: "chapters", label: "Most read" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

const LIST_STATUS_ACCENT: Record<string, string> = {
  READING: "var(--color-cyan)",
  COMPLETED: "#4ade80",
  PLANNING: "var(--color-violet)",
  PAUSED: "var(--color-amber)",
  DROPPED: "#f87171",
  REREADING: "var(--color-magenta)",
};

const GRID_CLASS =
  "mtk-grid grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";
const RAIL_CLASS =
  "mtk-rail board-scroll flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory";

const PER_PAGE = 24;
const MAX_EXPORT_PAGES = 40;

type ViewMode = "grid" | "carousel";

/* ---------------------------------------------------------------- helpers */

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function Aurora() {
  return (
    <div
      aria-hidden
      className="mtk-aurora pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="mtk-orb mtk-orb-a absolute -left-24 -top-28 h-64 w-64 rounded-full bg-[var(--color-violet)]/25 blur-3xl" />
      <div className="mtk-orb mtk-orb-b absolute -right-20 -top-10 h-60 w-60 rounded-full bg-[var(--color-magenta)]/20 blur-3xl" />
      <div className="mtk-orb mtk-orb-c absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-[var(--color-cyan)]/20 blur-3xl" />
      <div className="mtk-hero-scan absolute inset-0" />
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 120, damping: 22 });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  useMotionValueEvent(spring, "change", (v) =>
    setDisplay(Math.round(v as number)),
  );
  return <>{display}</>;
}

function LoadMore({
  hasMore,
  loading,
  onClick,
}: {
  hasMore: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  if (!hasMore) return null;
  return (
    <div className="mtk-loadmore-wrap mt-8 flex flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
        className="mtk-loadmore inline-flex items-center gap-2.5 rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-7 py-3 text-sm font-semibold text-[var(--color-text)] transition-all hover:border-[var(--color-violet)] hover:text-[var(--color-violet)] disabled:cursor-wait disabled:opacity-70"
      >
        <span className="mtk-loadmore-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="mtk-loadmore-label">{loading ? "Loading…" : "Load more"}</span>
        <svg className="mtk-loadmore-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <span className="mtk-loadmore-hint" aria-hidden>
        More stories are waiting
      </span>
    </div>
  );
}

function EmptyState({
  emoji,
  title,
  body,
  cta,
  secondary,
}: {
  emoji: string;
  title: string;
  body: string;
  cta?: { href: string; label: string };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="mtk-empty relative py-16 text-center"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-void)] text-3xl">
        {emoji}
      </div>
      <h2 className="mt-5 font-display text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-mute)]">
        {body}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {cta && (
          <Link
            href={cta.href}
            className="mtk-empty-cta rounded-full bg-[var(--color-magenta)] px-5 py-2.5 text-sm font-semibold text-black"
          >
            {cta.label}
          </Link>
        )}
        {secondary && (
          <button
            type="button"
            onClick={secondary.onClick}
            className="mtk-empty-secondary rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-violet)] hover:text-[var(--color-violet)]"
          >
            {secondary.label}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="mtk-stat rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 px-4 py-2.5 backdrop-blur-sm">
      <div className="font-mono text-lg font-bold" style={{ color: accent }}>
        <AnimatedNumber value={value} />
      </div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-mute)]">
        {label}
      </p>
    </div>
  );
}

function TypeChips({
  value,
  onChange,
  accent = "var(--color-violet)",
}: {
  value: MangaTypeKey;
  onChange: (v: MangaTypeKey) => void;
  accent?: string;
}) {
  return (
    <div className="mtk-type-bar">
      <span className="mtk-type-bar-label" aria-hidden>TYPE</span>
      <div className="mtk-type-chips flex flex-wrap items-center gap-1.5">
        {MANGA_TYPE_OPTIONS.map((t) => {
          const active = value === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              aria-pressed={active}
              style={
                active
                  ? {
                      background:
                        t.key === "ALL" ? accent : getMediaTypeColor(t.key),
                    }
                  : undefined
              }
              className={`mtk-type-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                active
                  ? "text-black"
                  : "border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <span className="mtk-type-dot" aria-hidden />
              <span className="mtk-type-label">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  return (
    <label className="mtk-sort relative inline-flex items-center">
      <span className="sr-only">Sort your list</span>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="pointer-events-none absolute left-2.5 text-[var(--color-mute)]"
      >
        <path d="M3 6h18M6 12h12M10 18h4" />
      </svg>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="mtk-sort-select appearance-none rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] py-1.5 pl-8 pr-7 text-xs text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-violet)]"
      >
        {SORT_OPTIONS.map((s) => (
          <option key={s.key} value={s.key} className="bg-[var(--color-panel)]">
            {s.label}
          </option>
        ))}
      </select>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="pointer-events-none absolute right-2.5 text-[var(--color-mute)]"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}

function ListSearch({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={`mtk-list-search relative ${className}`}>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-mute)]"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search my list…"
        aria-label="Search your manga list"
        className="mtk-list-search-input w-full rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] py-1.5 pl-8 pr-7 text-xs text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-mute)]/60 focus:border-[var(--color-violet)]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[var(--color-mute)] transition-colors hover:text-[var(--color-ink)]"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- browse */

function BrowseView({
  items,
  loading,
  error,
  hasMore,
  page,
  view,
  reduce,
  onLoadMore,
  onRetry,
}: {
  items: Media[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
  view: ViewMode;
  reduce: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <EmptyState
        emoji="⚠️"
        title="Couldn't load manga"
        body={error}
        secondary={{ label: "Try again", onClick: onRetry }}
      />
    );
  }

  const firstLoad = loading && items.length === 0;
  const appending = loading && items.length > 0;
  const makeSkeletons = (n: number) =>
    Array.from({ length: n }).map((_, i) => <CardSkeleton key={`s${i}`} />);

  return (
    <>
      <motion.div
        key={view}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={view === "grid" ? GRID_CLASS : RAIL_CLASS}
      >
        {items.map((m, i) => (
          <div
            key={m.id}
            className={`mtk-card-wrap ${
              view === "carousel"
                ? "w-40 shrink-0 snap-start"
                : "h-full min-w-0"
            }`}
          >
            <MangaCard manga={m} index={i} />
          </div>
        ))}
        {firstLoad && makeSkeletons(6)}
        {view === "grid" && appending && makeSkeletons(6)}
        {view === "carousel" &&
          appending &&
          makeSkeletons(6).map((s, i) => (
            <div key={`rs${i}`} className="w-40 shrink-0">
              {s}
            </div>
          ))}
      </motion.div>

      {!loading && items.length === 0 && (
        <EmptyState
          emoji="🔍"
          title="No manga here"
          body="Try a different tab or type, or search for a specific title above."
        />
      )}

      <LoadMore
        hasMore={hasMore && items.length > 0}
        loading={loading && page > 1}
        onClick={onLoadMore}
      />
    </>
  );
}

/* --------------------------------------------------------------- my list */

function MyMangaCard({
  entry,
  index,
  reduce,
  onIncrement,
  onRemove,
}: {
  entry: MangaEntryDB;
  index: number;
  reduce: boolean;
  onIncrement: (e: MangaEntryDB) => void;
  onRemove: (e: MangaEntryDB) => void;
}) {
  const total = entry.totalChapters ?? 0;
  const pct =
    total > 0 ? Math.min(100, Math.round((entry.chapters / total) * 100)) : 0;
  const complete = total > 0 && entry.chapters >= total;
  const subType = entry.subType || "manga";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: reduce ? 0 : Math.min(index, 12) * 0.03,
      }}
      className="mtk-list-card group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 transition-colors hover:border-[var(--color-violet)]/50"
    >
      <Link
        href={`/manga/${entry.mediaId}`}
        className="mtk-list-media relative block aspect-[2/3] overflow-hidden"
      >
        {entry.coverImage ? (
          <Image
            src={entry.coverImage}
            alt={entry.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-void)] text-3xl opacity-50">
            📖
          </div>
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        <span
          className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: STATUS_COLORS[entry.status] || "var(--color-mute)",
            color: "#000",
          }}
        >
          {STATUS_LABELS[entry.status] || entry.status}
        </span>
        {entry.score ? (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-mono font-semibold text-white">
            ★ {(entry.score / 10).toFixed(1)}
          </span>
        ) : null}
        {subType !== "manga" && (
          <span
            className="absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: getMediaTypeColor(subType), color: "#000" }}
          >
            {getMediaTypeLabel(subType)}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <Link
          href={`/manga/${entry.mediaId}`}
          className="line-clamp-2 text-sm font-semibold leading-tight transition-colors hover:text-[var(--color-violet)]"
        >
          {entry.title}
        </Link>

        <div className="mt-auto pt-2">
          <div className="mb-1 flex items-center justify-between text-[10px] text-[var(--color-mute)]">
            <span>
              {entry.chapters}
              {total ? ` / ${total}` : ""} ch
            </span>
            {total ? (
              <span className={complete ? "text-[#4ade80]" : ""}>
                {complete ? "Done" : `${pct}%`}
              </span>
            ) : null}
          </div>
          {total ? (
            <div className="mtk-progress h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
              <div
                className="mtk-progress-fill h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: complete ? "#4ade80" : "var(--color-violet)",
                }}
              />
            </div>
          ) : null}

          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onIncrement(entry)}
              disabled={complete}
              className="mtk-card-action flex-1 rounded-lg border border-[var(--color-line)] px-2 py-1 text-[11px] font-medium transition-colors hover:border-[var(--color-violet)] hover:text-[var(--color-violet)] disabled:opacity-40"
            >
              +1 Chapter
            </button>
            <button
              type="button"
              onClick={() => onRemove(entry)}
              aria-label={`Remove ${entry.title}`}
              className="mtk-remove rounded-lg border border-[var(--color-line)] px-2 py-1 text-[11px] text-[var(--color-mute)] transition-colors hover:border-[var(--color-magenta)] hover:text-[var(--color-magenta)]"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MyListView({
  entries,
  loading,
  error,
  total,
  hasMore,
  query,
  view,
  reduce,
  onLoadMore,
  onIncrement,
  onRemove,
  onClearQuery,
  onShowAll,
  onRetry,
}: {
  entries: MangaEntryDB[];
  loading: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  query: string;
  view: ViewMode;
  reduce: boolean;
  onLoadMore: () => void;
  onIncrement: (e: MangaEntryDB) => void;
  onRemove: (e: MangaEntryDB) => void;
  onClearQuery: () => void;
  onShowAll: () => void;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <EmptyState
        emoji="⚠️"
        title="Couldn't load your list"
        body={error}
        secondary={{ label: "Try again", onClick: onRetry }}
      />
    );
  }

  const firstLoad = loading && entries.length === 0;
  if (firstLoad) {
    return (
      <div className={GRID_CLASS}>
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={`s${i}`} />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    if (query.trim()) {
      return (
        <EmptyState
          emoji="🔍"
          title={`No matches for “${query.trim()}”`}
          body="Nothing in your list matches that search."
          secondary={{ label: "Clear search", onClick: onClearQuery }}
        />
      );
    }
    if (total === 0) {
      return (
        <EmptyState
          emoji="📚"
          title="Your list is empty"
          body="Search for a manga above and add it to Reading or Plan to Read to start tracking."
          cta={{ href: "/search?type=MANGA", label: "Explore manga" }}
        />
      );
    }
    return (
      <EmptyState
        emoji="🗂️"
        title="Nothing in this view"
        body="No titles match the current status or type filters."
        secondary={{ label: "Show all", onClick: onShowAll }}
      />
    );
  }

  return (
    <>
      <motion.div
        key={view}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={view === "grid" ? GRID_CLASS : RAIL_CLASS}
      >
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className={`mtk-card-wrap ${
              view === "carousel"
                ? "w-40 shrink-0 snap-start"
                : "h-full min-w-0"
            }`}
          >
            <MyMangaCard
              entry={entry}
              index={i}
              reduce={reduce}
              onIncrement={onIncrement}
              onRemove={onRemove}
            />
          </div>
        ))}
        {view === "grid" &&
          loading &&
          entries.length > 0 &&
          Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={`a${i}`} />
          ))}
      </motion.div>
      <LoadMore hasMore={hasMore} loading={loading} onClick={onLoadMore} />
    </>
  );
}

/* ------------------------------------------------------------------ main */

export default function MangaBrowseClient({
  initialManga,
}: {
  initialManga: Media[];
}) {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;

  const [mode, setMode] = useState<"browse" | "my">("browse");
  const [tab, setTab] = useState<BrowseTab>("trending");
  const [browseType, setBrowseType] = useState<MangaTypeKey>("ALL");
  const [genres, setGenres] = useState<string[]>([]);

  const [browse, setBrowse] = useState<Media[]>(initialManga);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseHasMore, setBrowseHasMore] = useState(initialManga.length > 0);
  const [browseRetry, setBrowseRetry] = useState(0);
  const bootstrapped = useRef(false);

  const [myEntries, setMyEntries] = useState<MangaEntryDB[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState<string | null>(null);
  const [myPage, setMyPage] = useState(1);
  const [myHasMore, setMyHasMore] = useState(false);
  const [myTotal, setMyTotal] = useState(0);
  const [myRetry, setMyRetry] = useState(0);
  const [listTab, setListTab] = useState<ListTab>("ALL");
  const [listType, setListType] = useState<MangaTypeKey>("ALL");
  const [listSort, setListSort] = useState<SortKey>("updated");
  const [listQuery, setListQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [overallTotal, setOverallTotal] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [summaryRetry, setSummaryRetry] = useState(0);
  const [view, setView] = useState<ViewMode>("grid");
  const [toast, setToast] = useState("");
  const [exporting, setExporting] = useState(false);
  const [stickyShow, setStickyShow] = useState(false);
  const [headerH, setHeaderH] = useState(52);

  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/anilist/genres")
      .then((r) => r.json())
      .then(setGenres)
      .catch(() => {});
  }, []);

  // Remember the preferred layout across visits.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("zyniverse_manga_view");
      if (saved === "grid" || saved === "carousel") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setView(saved);
      }
    } catch {}
  }, []);

  // Keep the sticky toolbar tucked right under the site header.
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const ro = new ResizeObserver(() => {
      setHeaderH(header.getBoundingClientRect().height || 52);
    });
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // Reveal the compact toolbar once the main one scrolls under the header.
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setStickyShow(el.getBoundingClientRect().top < headerH);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [headerH]);

  const chooseView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem("zyniverse_manga_view", next);
    } catch {}
  };

  // Debounce the in-list search and reset paging together so the fetch effect
  // fires once per settled query.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(listQuery);
      setMyPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [listQuery]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;
    Promise.all([
      fetch("/api/manga/list?perPage=1")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/manga/history?limit=24")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([list, hist]) => {
        if (cancelled) return;
        if (list) {
          setCounts(list.counts || {});
          setOverallTotal(list.overallTotal || 0);
        }
        if (hist) setHistory(hist.history || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authStatus, summaryRetry]);

  // Browse fetch. The server already rendered Trending page 1, so skip that
  // one request on first paint and reuse `initialManga`.
  useEffect(() => {
    if (mode !== "browse") return;
    if (
      !bootstrapped.current &&
      tab === "trending" &&
      browseType === "ALL" &&
      browsePage === 1 &&
      initialManga.length > 0
    ) {
      bootstrapped.current = true;
      return;
    }
    let cancelled = false;
    setBrowseLoading(true);
    setBrowseError(null);
    const typeParam = browseType !== "ALL" ? `&type=${browseType}` : "";
    fetch(
      `/api/anilist/manga?tab=${tab}&perPage=${PER_PAGE}&page=${browsePage}${typeParam}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json() as Promise<Media[]>;
      })
      .then((d) => {
        if (cancelled) return;
        setBrowse((prev) => (browsePage === 1 ? d : [...prev, ...d]));
        setBrowseHasMore(d.length >= PER_PAGE);
      })
      .catch((e: Error) => {
        if (!cancelled) setBrowseError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBrowseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, tab, browseType, browsePage, browseRetry, initialManga]);

  // My list fetch (status + type + search + sort + page).
  useEffect(() => {
    if (mode !== "my") return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyLoading(true); setMyError(null);
    const params = new URLSearchParams();
    if (listTab !== "ALL") params.set("status", listTab);
    if (listType !== "ALL") params.set("type", listType);
    if (listSort !== "updated") params.set("sort", listSort);
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    params.set("perPage", String(PER_PAGE));
    params.set("page", String(myPage));
    fetch(`/api/manga/list?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setMyEntries((prev) =>
          myPage === 1 ? d.entries : [...prev, ...d.entries],
        );
        setMyHasMore(!!d.hasMore);
        setMyTotal(d.total ?? 0);
        if (d.counts) setCounts(d.counts);
        if (typeof d.overallTotal === "number") setOverallTotal(d.overallTotal);
      })
      .catch((e: Error) => {
        if (!cancelled) setMyError(e.message);
      })
      .finally(() => {
        if (!cancelled) setMyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, listTab, listType, listSort, debouncedQuery, myPage, myRetry]);

  // Latest chapter per series, most-recent first.
  const continueItems = useMemo(() => {
    const seen = new Set<number>();
    const out: HistoryItem[] = [];
    for (const h of history) {
      if (!h.entry || seen.has(h.entry.mediaId)) continue;
      seen.add(h.entry.mediaId);
      out.push(h);
      if (out.length >= 8) break;
    }
    return out;
  }, [history]);

  const stats = [
    { label: "Saved", value: overallTotal, accent: "var(--color-ink)" },
    { label: "Reading", value: counts.READING || 0, accent: "var(--color-cyan)" },
    { label: "Completed", value: counts.COMPLETED || 0, accent: "#4ade80" },
    { label: "Planned", value: counts.PLANNING || 0, accent: "var(--color-violet)" },
  ];

  const changeTab = (next: BrowseTab) => {
    setTab(next);
    setBrowsePage(1);
  };

  const changeBrowseType = (next: MangaTypeKey) => {
    setBrowseType(next);
    setBrowsePage(1);
  };

  const changeListTab = (next: ListTab) => {
    setListTab(next);
    setMyPage(1);
  };

  const changeListType = (next: MangaTypeKey) => {
    setListType(next);
    setMyPage(1);
  };

  const changeListSort = (next: SortKey) => {
    setListSort(next);
    setMyPage(1);
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2600);
  };

  const incrementChapter = async (entry: MangaEntryDB) => {
    const next = entry.chapters + 1;
    if (entry.totalChapters && next > entry.totalChapters) return;
    setMyEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, chapters: next } : e)),
    );
    try {
      const res = await fetch(`/api/manga/list/${entry.mediaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapters: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setMyEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, chapters: entry.chapters } : e,
        ),
      );
      flash("Couldn't save progress — try again.");
    }
  };

  const removeEntry = async (entry: MangaEntryDB) => {
    const snapshot = myEntries;
    setMyEntries((prev) => prev.filter((e) => e.id !== entry.id));
    setCounts((prev) => ({
      ...prev,
      [entry.status]: Math.max(0, (prev[entry.status] || 0) - 1),
    }));
    setOverallTotal((t) => Math.max(0, t - 1));
    try {
      const res = await fetch("/api/manga/list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: entry.mediaId }),
      });
      if (!res.ok) throw new Error();
      flash(`Removed “${entry.title}”.`);
    } catch {
      setMyEntries(snapshot);
      setCounts((prev) => ({
        ...prev,
        [entry.status]: (prev[entry.status] || 0) + 1,
      }));
      setOverallTotal((t) => t + 1);
      flash("Couldn't remove — try again.");
    }
  };

  const luckyPick = async () => {
    try {
      const page = 1 + Math.floor(Math.random() * 8);
      const typeParam = browseType !== "ALL" ? `&type=${browseType}` : "";
      const r = await fetch(
        `/api/anilist/manga?tab=popular&perPage=25&page=${page}${typeParam}`,
      );
      if (!r.ok) throw new Error();
      const list = (await r.json()) as Media[];
      if (!list.length) throw new Error();
      const pick = list[Math.floor(Math.random() * list.length)];
      router.push(`/manga/${pick.id}`);
    } catch {
      flash("Couldn't find a pick — try again.");
    }
  };

  const exportList = async (format: "csv" | "json") => {
    if (exporting) return;
    setExporting(true);
    try {
      const all: MangaEntryDB[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= MAX_EXPORT_PAGES) {
        const params = new URLSearchParams();
        if (listTab !== "ALL") params.set("status", listTab);
        if (listType !== "ALL") params.set("type", listType);
        if (listSort !== "updated") params.set("sort", listSort);
        if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
        params.set("perPage", "48");
        params.set("page", String(page));
        const res = await fetch(`/api/manga/list?${params.toString()}`);
        if (!res.ok) throw new Error();
        const d = await res.json();
        all.push(...(d.entries as MangaEntryDB[]));
        hasMore = !!d.hasMore;
        page += 1;
      }
      if (all.length === 0) {
        flash("Nothing to export yet.");
        return;
      }

      let blob: Blob;
      let filename: string;
      if (format === "json") {
        blob = new Blob([JSON.stringify(all, null, 2)], {
          type: "application/json",
        });
        filename = "zyniverse-manga-list.json";
      } else {
        const header = [
          "Title",
          "Status",
          "Type",
          "Chapters",
          "Total chapters",
          "Volumes",
          "Total volumes",
          "Score",
          "Updated",
        ];
        const rows = all.map((e) => [
          e.title,
          STATUS_LABELS[e.status] || e.status,
          getMediaTypeLabel(e.subType || "manga"),
          e.chapters,
          e.totalChapters ?? "",
          e.volumes,
          e.totalVolumes ?? "",
          e.score ?? "",
          e.updatedAt ?? "",
        ]);
        const csv = [header, ...rows]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n");
        blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        filename = "zyniverse-manga-list.csv";
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash(`Exported ${all.length} title${all.length === 1 ? "" : "s"}.`);
    } catch {
      flash("Export failed — try again.");
    } finally {
      setExporting(false);
    }
  };

  const activeStatuses = LIST_TABS.filter(
    (t) => t === "ALL" || (counts[t] || 0) > 0,
  );

  const mySkeleton = (
    <div className={GRID_CLASS}>
      {Array.from({ length: 8 }).map((_, i) => (
        <CardSkeleton key={`s${i}`} />
      ))}
    </div>
  );

  return (
    <PageTransition>
      <div className="mtk-shell mx-auto max-w-7xl px-4 py-10 sm:px-6 animate-page-in">
        {/* Hero */}
        <div className="mtk-hero relative overflow-hidden rounded-3xl border border-[var(--color-line)] bg-[var(--color-panel)]/50 p-6 sm:p-8">
          <Aurora />
          <div className="mtk-hero-inner relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="mtk-hero-copy-col min-w-0">
              <p className="mtk-kicker font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-violet)]">
                Manga Tracker
                <span className="mtk-kicker-line" aria-hidden />
              </p>
              <h1 className="mtk-title mt-4 font-display text-3xl font-bold sm:text-4xl">
                <span className="mtk-title-frame neon-rgb-border relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-4 py-1.5">
                  <svg className="mtk-title-mark" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M4 5.5A2.5 2.5 0 016.5 3H19v16H6.5A2.5 2.5 0 004 21.5V5.5z" />
                    <path d="M4 18.5A2.5 2.5 0 016.5 16H19" />
                    <path d="M9 7h6" />
                  </svg>
                  <span className="mtk-title-text">Your Manga</span>
                  <span className="mtk-title-sheen" aria-hidden />
                </span>
              </h1>
              <p className="mtk-copy mt-4 max-w-md text-sm text-[var(--color-mute)]">
                Track every series, chapter by chapter. Saved to your account
                when you sign in.
              </p>

              {overallTotal > 0 ? (
                <div className="mtk-stats mt-5 flex flex-wrap gap-2">
                  {stats.map((s) => (
                    <Stat
                      key={s.label}
                      label={s.label}
                      value={s.value}
                      accent={s.accent}
                    />
                  ))}
                </div>
              ) : authStatus === "unauthenticated" ? (
                <div className="mtk-signin mt-5">
                  <span className="mtk-signin-icon" aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="4" y="10" width="16" height="11" rx="2" />
                      <path d="M8 10V7a4 4 0 018 0v3" />
                    </svg>
                  </span>
                  <span className="mtk-signin-copy text-xs text-[var(--color-mute)]">
                    <Link
                      href="/login?next=%2Fmanga"
                      className="mtk-signin-link"
                    >
                      Sign in <span aria-hidden>→</span>
                    </Link>{" "}
                    to sync your reading list and progress.
                  </span>
                  <span className="mtk-signin-glow" aria-hidden />
                </div>
              ) : null}
            </div>

            <div className="mtk-search-wrap w-full lg:max-w-md">
              <div className="mtk-search-panel">
                <div className="mtk-search-panel-head">
                  <span className="mtk-search-panel-label">QUICK ADD</span>
                  <span className="mtk-search-panel-badge">
                    <span aria-hidden /> 1000+ titles
                  </span>
                </div>
                <MangaSearch
                  onAdd={() => {
                    setMode("my");
                    setListTab("READING");
                    setMyPage(1);
                    setSummaryRetry((n) => n + 1);
                  }}
                />
                <span className="mtk-search-corners" aria-hidden>
                  <i /><i /><i /><i />
                </span>
              </div>
              <p className="mtk-search-hint mt-3 text-[11px] text-[var(--color-mute)]">
                <span className="mtk-search-hint-dot" aria-hidden />
                Search 1000+ series and add them to{" "}
                <span className="mtk-hint-tag">Reading</span> or{" "}
                <span className="mtk-hint-tag mtk-hint-tag-alt">Plan to Read</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Continue reading */}
        {continueItems.length > 0 && (
          <div className="mtk-continue mt-8">
            <div className="mtk-section-head mb-2 flex items-center justify-between">
              <p className="mtk-section-label flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.25em] text-[var(--color-cyan)]">
                <span className="mtk-section-dot h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)] shadow-[0_0_8px_var(--color-cyan)]" />
                Continue Reading
              </p>
              <span className="mtk-section-count text-[10px] font-mono text-[var(--color-mute)]">
                {continueItems.length}
              </span>
            </div>
            <div className="mtk-continue-stage relative">
              <div
                aria-hidden
                className="mtk-rail-fade mtk-rail-fade-left pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[var(--color-void)] to-transparent"
              />
              <div
                aria-hidden
                className="mtk-rail-fade mtk-rail-fade-right pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[var(--color-void)] to-transparent"
              />
              <div className={RAIL_CLASS}>
                {continueItems.map((h) => {
                  const e = h.entry!;
                  const total = e.totalChapters ?? 0;
                  const read = Math.max(h.chapter, e.chapters ?? 0);
                  const pct =
                    total > 0
                      ? Math.min(100, Math.round((read / total) * 100))
                      : 0;
                  return (
                    <Link
                      key={e.mediaId}
                      href={`/manga/${e.mediaId}`}
                      className="mtk-continue-card group relative w-32 shrink-0 snap-start overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] transition-all hover:border-[var(--color-violet)]/60"
                    >
                      <div className="relative aspect-[2/3] w-full">
                        {e.coverImage ? (
                          <Image
                            src={e.coverImage}
                            alt={e.title}
                            fill
                            className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                            sizes="128px"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-void)] text-3xl opacity-50">
                            📖
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-2">
                          <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-white drop-shadow-lg">
                            {e.title}
                          </p>
                        </div>
                      </div>
                      {total > 0 && (
                        <div className="mtk-mini-progress h-1 w-full bg-[var(--color-line)]">
                          <div
                            className="mtk-mini-progress-fill h-full rounded-r-full bg-[var(--color-cyan)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between px-2 py-1.5 text-[9px] font-mono text-[var(--color-mute)]">
                        <span>
                          Ch. {read}
                          {total ? `/${total}` : ""}
                        </span>
                        <span className="mtk-resume inline-flex items-center gap-0.5 text-[var(--color-cyan)] transition-transform group-hover:translate-x-0.5">
                          Resume →
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Mode toggle + view toggle */}
        <div
          ref={toolbarRef}
          className="mtk-toolbar mtk-toolbar-panel mt-8 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-line)] p-2.5"
        >
          <div className="mtk-mode-toggle flex items-center">
            {(["browse", "my"] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={active}
                  className="mtk-mode-btn relative inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                >
                  {active && (
                    <motion.span
                      layoutId="manga-mode"
                      className="absolute inset-0 rounded-lg bg-[var(--color-magenta)]/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span
                    className={`mtk-mode-inner relative z-10 inline-flex items-center gap-1.5 ${
                      active
                        ? "text-[var(--color-magenta)]"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    <span className="mtk-mode-icon" aria-hidden>
                      {m === "browse" ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 4h12v16l-6-4-6 4V4z" />
                        </svg>
                      )}
                    </span>
                    <span>{m === "browse" ? "Browse" : "My List"}</span>
                    {m === "my" && overallTotal > 0 && (
                      <span className="mtk-mode-count font-mono text-xs">
                        {overallTotal}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mtk-toolbar-actions ml-auto flex items-center gap-3">
            <div className="mtk-view-toggle flex gap-0.5 rounded-lg border border-[var(--color-line)] p-0.5">
              <button
                type="button"
                onClick={() => chooseView("grid")}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                className={`mtk-view-btn flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                  view === "grid"
                    ? "bg-[var(--color-magenta)] text-black"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => chooseView("carousel")}
                aria-label="Carousel view"
                aria-pressed={view === "carousel"}
                className={`mtk-view-btn flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                  view === "carousel"
                    ? "bg-[var(--color-magenta)] text-black"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M7 4v16M17 4v16" />
                </svg>
              </button>
            </div>
            <Link
              href="/search?type=MANGA"
              className="mtk-advanced inline-flex items-center gap-1.5 text-xs text-[var(--color-cyan)]"
            >
              <svg className="mtk-advanced-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.6-3.6" />
              </svg>
              <span>Advanced Search</span>
              <span className="mtk-advanced-arrow" aria-hidden>→</span>
            </Link>
          </div>
        </div>

        {/* Browse controls */}
        {mode === "browse" && (
          <>
            <div className="mtk-browse-bar mt-4 flex flex-wrap items-center gap-2">
              {BROWSE_TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => changeTab(t.key)}
                    aria-pressed={active}
                    className="mtk-browse-tab relative rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
                  >
                    {active && (
                      <motion.span
                        layoutId="manga-browse-tab"
                        className="absolute inset-0 rounded-lg bg-[var(--color-violet)]/10"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span
                      className={`mtk-browse-tab-inner relative z-10 inline-flex items-center gap-1.5 ${
                        active
                          ? "text-[var(--color-violet)]"
                          : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      <span className="mtk-browse-tab-dot" aria-hidden />
                      {t.label}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={luckyPick}
                className="mtk-lucky ml-auto inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-xs font-semibold text-[var(--color-mute)] transition-colors hover:border-[var(--color-magenta)] hover:text-[var(--color-magenta)]"
              >
                <span className="mtk-lucky-icon" aria-hidden>🎲</span>
                <span className="mtk-lucky-label">Surprise me</span>
                <span className="mtk-lucky-spark" aria-hidden>✦</span>
              </button>
            </div>

            <div className="mt-3">
              <TypeChips value={browseType} onChange={changeBrowseType} />
            </div>

            {genres.length > 0 && (
              <div className="mtk-genre-shell mt-3">
                <span className="mtk-genre-kicker" aria-hidden>GENRES</span>
                <div className="mtk-genres flex flex-wrap gap-1.5">
                  {genres.slice(0, 15).map((g) => (
                    <Link
                      key={g}
                      href={`/search?genre=${g}&type=MANGA`}
                      className="mtk-genre inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-0.5 text-[10px] text-[var(--color-mute)] transition-colors"
                    >
                      <span className="mtk-genre-hash" aria-hidden>#</span>
                      <span className="mtk-genre-name">{g}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* My List controls */}
        {mode === "my" && authStatus === "authenticated" && (
          <>
            <div className="mtk-list-bar mt-4 flex flex-wrap items-center gap-2">
              {activeStatuses.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => changeListTab(t)}
                  style={
                    listTab === t
                      ? { background: LIST_STATUS_ACCENT[t] || "var(--color-violet)" }
                      : undefined
                  }
                  className={`mtk-status-chip rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                    listTab === t
                      ? "text-black"
                      : "border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {t === "ALL" ? "All" : STATUS_LABELS[t] || t}
                  <span className="ml-1.5 font-mono opacity-70">
                    {t === "ALL" ? overallTotal : counts[t] || 0}
                  </span>
                </button>
              ))}

              <ListSearch
                value={listQuery}
                onChange={setListQuery}
                className="ml-auto w-44"
              />
            </div>

            <div className="mtk-list-tools mt-3 flex flex-wrap items-center gap-3">
              <TypeChips
                value={listType}
                onChange={changeListType}
                accent="var(--color-cyan)"
              />
              <div className="ml-auto flex items-center gap-2">
                <SortSelect value={listSort} onChange={changeListSort} />
                <div className="mtk-export-group flex items-center gap-0.5 rounded-full border border-[var(--color-line)] p-0.5">
                  <button
                    type="button"
                    onClick={() => exportList("csv")}
                    disabled={exporting}
                    className="mtk-export-btn rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--color-mute)] transition-colors hover:text-[var(--color-ink)] disabled:opacity-40"
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => exportList("json")}
                    disabled={exporting}
                    className="mtk-export-btn rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--color-mute)] transition-colors hover:text-[var(--color-ink)] disabled:opacity-40"
                  >
                    JSON
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Affiliates + ad (browse only) */}
        {mode === "browse" && (
          <>
            <div className="mtk-affiliates mtk-buy-panel mt-6">
              <div className="mtk-buy-head">
                <span className="mtk-buy-icon" aria-hidden>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 9l1.5-5h15L21 9" />
                    <path d="M4 9h16v11H4z" />
                    <path d="M9 20v-6h6v6" />
                  </svg>
                </span>
                <div className="mtk-buy-head-copy">
                  <p className="mtk-affiliate-label">Where to buy</p>
                  <p className="mtk-buy-sub">Official stores · sponsored links</p>
                </div>
                <span className="mtk-buy-line" aria-hidden />
              </div>
              <div className="mtk-affiliate-row mt-3 flex flex-wrap gap-3">
                <AffiliateLink
                  partner="bookwalker"
                  path="https://global.bookwalker.jp"
                  className="mtk-affiliate inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--color-violet)] to-[var(--color-magenta)] px-5 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
                >
                  📖 Buy Manga on BookWalker
                </AffiliateLink>
                <AffiliateLink
                  partner="amazon"
                  path="https://www.amazon.in/s?k=manga"
                  className="mtk-affiliate inline-flex items-center gap-2 rounded-full neon-rgb-border px-5 py-2.5 text-sm font-semibold text-[var(--color-mute)] transition-all hover:text-[var(--color-cyan)]"
                >
                  📦 Buy Manga on Amazon
                </AffiliateLink>
                <PlayAsiaPill
                  query="manga merch"
                  label="Play-Asia merch"
                  className="mtk-affiliate"
                />
              </div>
            </div>
            <div className="mtk-ad mx-auto mt-6 max-w-[728px]">
              <span className="mtk-ad-frame" aria-hidden><i /><i /><i /><i /></span>
              <AdBanner placement="manga" type="sidebar" />
            </div>
          </>
        )}

        {/* Content */}
        <div className="mtk-content mt-8">
          {mode === "browse" ? (
            <BrowseView
              items={browse}
              loading={browseLoading}
              error={browseError}
              hasMore={browseHasMore}
              page={browsePage}
              view={view}
              reduce={reduce}
              onLoadMore={() => setBrowsePage((p) => p + 1)}
              onRetry={() => {
                setBrowsePage(1);
                setBrowseRetry((n) => n + 1);
              }}
            />
          ) : authStatus === "loading" ? (
            mySkeleton
          ) : authStatus !== "authenticated" ? (
            <EmptyState
              emoji="🔒"
              title="Sign in to track manga"
              body="Your reading list and progress are saved to your account across devices."
              cta={{ href: "/login?next=%2Fmanga", label: "Sign in" }}
            />
          ) : (
            <MyListView
              entries={myEntries}
              loading={myLoading}
              error={myError}
              total={myTotal}
              hasMore={myHasMore}
              query={debouncedQuery}
              view={view}
              reduce={reduce}
              onLoadMore={() => setMyPage((p) => p + 1)}
              onIncrement={incrementChapter}
              onRemove={removeEntry}
              onClearQuery={() => setListQuery("")}
              onShowAll={() => {
                setListTab("ALL");
                setListType("ALL");
                setMyPage(1);
              }}
              onRetry={() => {
                setMyPage(1);
                setMyRetry((n) => n + 1);
              }}
            />
          )}
        </div>

        {/* Sticky mini-toolbar */}
        <AnimatePresence>
          {stickyShow && (
            <motion.div
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{ top: headerH }}
              className="mtk-sticky fixed inset-x-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-void)]/90 backdrop-blur-md"
            >
              <div className="mtk-sticky-inner mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:px-6">
                <div className="mtk-sticky-mode flex gap-0.5 rounded-lg border border-[var(--color-line)] p-0.5">
                  {(["browse", "my"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                        mode === m
                          ? "bg-[var(--color-magenta)] text-black"
                          : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      {m === "browse" ? "Browse" : "My List"}
                    </button>
                  ))}
                </div>

                {mode === "my" && authStatus === "authenticated" ? (
                  <ListSearch
                    value={listQuery}
                    onChange={setListQuery}
                    className="min-w-0 flex-1"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={luckyPick}
                    className="mtk-lucky mtk-sticky-lucky inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--color-mute)] transition-colors hover:border-[var(--color-magenta)] hover:text-[var(--color-magenta)]"
                  >
                    <span className="mtk-lucky-icon" aria-hidden>🎲</span>
                    <span className="mtk-lucky-label">Surprise me</span>
                  </button>
                )}

                <div className="mtk-view-toggle ml-auto flex gap-0.5 rounded-lg border border-[var(--color-line)] p-0.5">
                  <button
                    type="button"
                    onClick={() => chooseView("grid")}
                    aria-label="Grid view"
                    aria-pressed={view === "grid"}
                    className={`mtk-view-btn flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                      view === "grid"
                        ? "bg-[var(--color-magenta)] text-black"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseView("carousel")}
                    aria-label="Carousel view"
                    aria-pressed={view === "carousel"}
                    className={`mtk-view-btn flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                      view === "carousel"
                        ? "bg-[var(--color-magenta)] text-black"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path d="M7 4v16M17 4v16" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="mtk-toast-wrap pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center md:bottom-8"
          >
            <div className="mtk-toast rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm shadow-2xl backdrop-blur">
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
