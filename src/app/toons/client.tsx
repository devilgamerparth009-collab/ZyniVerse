"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { TOON_STATS, formatToonYears } from "@/lib/toons-data";
import type { CartoonEntry } from "@/lib/toons-data";
import ToonArtwork from "./ToonArtwork";
import styles from "./toons.module.css";

const NETWORK_FILTERS = ["All", "Indian", "International"] as const;
const GENRE_FILTERS = ["All", "Comedy", "Action", "Adventure", "Sci-Fi", "Fantasy", "Slice of Life"] as const;
const STATUS_FILTERS = ["All", "Airing", "Completed"] as const;

const PAGE_SIZE = 16;

const STATS = [
  { label: "Total Toons", value: TOON_STATS.totalCartoons, color: "var(--color-cyan)", icon: "grid" },
  { label: "Indian Originals", value: TOON_STATS.indianOriginals, color: "#ff9933", icon: "flag" },
  { label: "International", value: TOON_STATS.internationalPopular, color: "#3b82f6", icon: "globe" },
  { label: "Currently Airing", value: TOON_STATS.airingShows, color: "#22c55e", icon: "bolt" },
] as const;

const TONE_CLASS = {
  magenta: styles.filterChipMagenta,
  cyan: styles.filterChipCyan,
  gold: styles.filterChipGold,
} as const;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function StatIcon({ kind }: { kind: (typeof STATS)[number]["icon"] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (kind === "grid") {
    return <svg {...common} aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
  }
  if (kind === "flag") {
    return <svg {...common} aria-hidden="true"><path d="M5 21V4" /><path d="M5 5h11l-2 3.5L16 12H5" /></svg>;
  }
  if (kind === "globe") {
    return <svg {...common} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>;
  }
  return <svg {...common} aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>;
}

function CardIcon({ kind }: { kind: "episodes" | "seasons" | "calendar" | "play" | "arrow" }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (kind === "episodes") {
    return <svg {...common}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" /></svg>;
  }
  if (kind === "seasons") {
    return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /></svg>;
  }
  if (kind === "calendar") {
    return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
  }
  if (kind === "play") {
    return <svg {...common}><path d="m8 5 11 7-11 7V5Z" /></svg>;
  }
  return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
  tone,
}: {
  label: string;
  options: readonly T[];
  value: string;
  onChange: (next: T) => void;
  tone: keyof typeof TONE_CLASS;
}) {
  return (
    <div className={styles.filterRow}>
      <span className={styles.filterLabel}>{`${label}:`}</span>
      <div className={styles.chipScroll} role="group" aria-label={label}>
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              onClick={() => onChange(option)}
              className={`${styles.filterChip} ${TONE_CLASS[tone]} ${active ? styles.filterChipActive : ""}`}
              aria-pressed={active}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Card3D({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const px = (e.clientX - cx) / (rect.width / 2);
    const py = (e.clientY - cy) / (rect.height / 2);
    el.style.transform = `perspective(800px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg) scale(1.02)`;
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)";
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="group h-full"
      style={{ transition: "transform 0.2s ease-out" }}
    >
      {children}
    </motion.div>
  );
}

export default function ToonsBrowseClient({ toons }: { toons: CartoonEntry[] }) {
  const [networkFilter, setNetworkFilter] = useState<string>("All");
  const [genreFilter, setGenreFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = toons.filter((t) => {
    if (networkFilter === "Indian" && t.country !== "India") return false;
    if (networkFilter === "International" && t.country === "India") return false;
    if (genreFilter !== "All" && !t.genres.includes(genreFilter)) return false;
    if (statusFilter === "Airing" && t.status !== "airing") return false;
    if (statusFilter === "Completed" && t.status !== "completed") return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.displayTitle.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const shown = filtered.slice(0, visible);

  return (
    <PageTransition>
      <div className={`${styles.page} mx-auto max-w-7xl px-4 py-10 sm:px-6 animate-page-in`}>
        <span className={`${styles.aurora} ${styles.auroraOne}`} aria-hidden="true" />
        <span className={`${styles.aurora} ${styles.auroraTwo}`} aria-hidden="true" />

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--color-mute)]">
          <Link href="/" className="hover:text-[var(--color-cyan)] transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[var(--color-ink)]">Toons</span>
        </nav>

        {/* Header */}
        <header className={`${styles.header} mb-6`}>
          <div className={styles.heroPanel}>
            <p className={`${styles.eyebrow} font-mono`}>Cartoons & Toons</p>
            <h1 className={`${styles.heroTitle} font-display mt-2 font-black tracking-tight`}>
              Indian & International Toons
            </h1>
            <p className={styles.heroCopy}>
              From Chhota Bheem to Doraemon — every cartoon popular in India with Hindi dub info, episode counts & where to watch.
            </p>
          </div>
        </header>

        {/* Stats Bar */}
        <div className={`${styles.statsGrid} mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4`}>
          {STATS.map((stat) => (
            <div key={stat.label} className={`${styles.statCard} relative overflow-hidden rounded-2xl p-4`}>
              <span aria-hidden="true" className={styles.statGlow} style={{ background: stat.color }} />
              <div className={styles.statTop}>
                <span className={styles.statIcon} style={{ color: stat.color }}>
                  <StatIcon kind={stat.icon} />
                </span>
                <p className={`${styles.statValue} font-display`} style={{ color: stat.color }}>{stat.value}</p>
              </div>
              <p className={styles.statLabel}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <section className={`${styles.controls} mb-7 rounded-2xl p-4 sm:p-5`} aria-label="Toon filters">
          <div className={`${styles.searchWrap} relative`}>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`${styles.searchIcon} absolute left-4 top-1/2 -translate-y-1/2`}
            >
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search toons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${styles.searchInput} w-full rounded-xl py-3 pl-11 pr-4 text-sm outline-none`}
            />
          </div>

          <div className={styles.filterRows}>
            <FilterRow label="Region" options={NETWORK_FILTERS} value={networkFilter} onChange={setNetworkFilter} tone="magenta" />
            <FilterRow label="Genre" options={GENRE_FILTERS} value={genreFilter} onChange={setGenreFilter} tone="cyan" />
            <FilterRow label="Status" options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} tone="gold" />
          </div>
        </section>

        {/* Results Count */}
        <p className="mb-5 flex items-center gap-2 font-mono text-[11px] text-[var(--color-mute)] tracking-wider uppercase">
          <span className={`${styles.resultDot} h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)]`} aria-hidden="true" />
          {filtered.length} {filtered.length === 1 ? "toon" : "toons"} found
        </p>

        {/* Toon Grid — Premium Neon Cards */}
        <div className={`${styles.grid} grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}>
          {shown.map((toon, idx) => {
            const years = formatToonYears(toon);
            const meta = [
              toon.totalEpisodes ? { icon: "episodes" as const, text: `${toon.totalEpisodes} eps` } : null,
              toon.seasons ? { icon: "seasons" as const, text: `${toon.seasons} seasons` } : null,
              years ? { icon: "calendar" as const, text: years } : null,
            ].filter(Boolean) as { icon: "episodes" | "seasons" | "calendar"; text: string }[];

            return (
              <Card3D key={toon.id} index={idx}>
                <Link href={`/toons/${toon.id}`} className={`${styles.card} toon-card group block h-full rounded-2xl no-underline`}>
                  <article className={styles.cardShell}>
                    {/* Artwork */}
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <ToonArtwork toon={toon} sizes="(max-width: 768px) 100vw, 33vw" />
                      <div className={styles.imageOverlay} aria-hidden="true" />

                      <div className={styles.badgeRow}>
                        {toon.status === "airing" && (
                          <span className={styles.statusBadge}>
                            <span className={`${styles.liveBadge} h-1.5 w-1.5 rounded-full`} aria-hidden="true" />
                            AIRING
                          </span>
                        )}
                        {toon.popularity === "high" && (
                          <span className={styles.popularBadge}>POPULAR</span>
                        )}
                      </div>

                      <span className={styles.flagTile} aria-label={toon.country}>
                        {toon.country === "India" ? "🇮🇳" : toon.country === "Japan" ? "🇯🇵" : toon.country === "France" ? "🇫🇷" : "🇺🇸"}
                      </span>

                      <div className={styles.titlePlate}>
                        <h3 className={`${styles.cardTitle} font-display`}>{toon.displayTitle}</h3>
                        <p className={styles.cardSubtitle}>
                          {[toon.network, years].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className={styles.cardBody}>
                      <div className={styles.genreRow}>
                        {toon.genres.slice(0, 3).map((g) => (
                          <span key={g} className={styles.genreChip}>{g}</span>
                        ))}
                      </div>

                      <p className={styles.synopsis}>{toon.synopsis}</p>

                      <div className={styles.metaRow}>
                        {meta.map((item) => (
                          <span key={item.text} className={styles.metaItem}>
                            <CardIcon kind={item.icon} />
                            {item.text}
                          </span>
                        ))}
                      </div>

                      {toon.language.length > 0 && (
                        <div className={styles.languageRow}>
                          {toon.language.slice(0, 4).map((l) => (
                            <span key={l} className={styles.langChip}>{l}</span>
                          ))}
                          {toon.language.length > 4 && (
                            <span className={styles.langMore}>+{toon.language.length - 4}</span>
                          )}
                        </div>
                      )}

                      {toon.dubPlatform && (
                        <div className={styles.platformRow}>
                          <span className={styles.platformIcon}><CardIcon kind="play" /></span>
                          <span className="min-w-0">
                            <span className={styles.platformLabel}>Watch on</span>
                            <span className={styles.platformName}>{toon.dubPlatform}</span>
                          </span>
                        </div>
                      )}

                      <div className={styles.cardSpacer} aria-hidden="true" />
                      <div className={styles.detailsCta}>
                        <span>View Details</span>
                        <CardIcon kind="arrow" />
                      </div>
                    </div>
                  </article>
                </Link>
              </Card3D>
            );
          })}
        </div>

        {/* Load More */}
        {filtered.length > visible && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className={`${styles.loadMore} rounded-xl neon-rgb-border bg-[var(--color-panel)] px-6 py-3 text-sm font-semibold text-[var(--color-cyan)]`}
            >
              Load More ({filtered.length - visible} more)
            </button>
          </div>
        )}

        {filtered.length === 0 && (
          <div className={`${styles.emptyState} py-20 text-center`}>
            <div className={`${styles.emptyIcon} mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-panel)] ring-1 ring-inset ring-[var(--color-line)]`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-mute)]">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><path d="M8 11h6" />
              </svg>
            </div>
            <p className="font-display text-lg font-bold text-[var(--color-mute)]">No toons found</p>
            <p className="mt-1 text-sm text-[var(--color-mute)] opacity-60">Try adjusting your filters or search terms.</p>
            <button
              onClick={() => { setNetworkFilter("All"); setGenreFilter("All"); setStatusFilter("All"); setSearch(""); }}
              className="mt-4 rounded-full neon-rgb-border px-4 py-2 text-xs text-[var(--color-mute)] transition-all hover:text-[var(--color-cyan)]"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
