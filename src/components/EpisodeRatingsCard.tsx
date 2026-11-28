"use client";

import { useEffect, useState, useMemo } from "react";
import boxStyles from "./detailBoxes.module.css";

interface EpisodeData {
  episode: number;
  title: string;
  rating: number | null;
  replies: number;
  filler: boolean;
  recap: boolean;
}

interface RatingsResponse {
  episodes: EpisodeData[];
  totalEpisodes: number;
  ratedCount: number;
  averageScore: number;
  totalReplies: number;
}

interface Props {
  malId: number;
  /** Anime detail pages show the source as plain text, never as an exit link. */
  internalOnly?: boolean;
  className?: string;
}

export default function EpisodeRatingsCard({ malId, internalOnly = false, className = "" }: Props) {
  const [data, setData] = useState<RatingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortBy, setSortBy] = useState<"episode" | "rating-desc" | "rating-asc" | "replies">("episode");
  const [showTop, setShowTop] = useState<"all" | "best" | "worst">("all");

  useEffect(() => {
    fetch(`/api/anime/${malId}/episode-ratings`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [malId]);

  const sortedEpisodes = useMemo(() => {
    if (!data) return [];
    let eps = [...data.episodes];

    if (showTop === "best") {
      eps = eps.filter((e) => e.rating !== null).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);
    } else if (showTop === "worst") {
      eps = eps.filter((e) => e.rating !== null).sort((a, b) => (a.rating || 0) - (b.rating || 0)).slice(0, 10);
    } else {
      if (sortBy === "rating-desc") eps = eps.filter((e) => e.rating !== null).sort((a, b) => (b.rating || 0) - (a.rating || 0));
      else if (sortBy === "rating-asc") eps = eps.filter((e) => e.rating !== null).sort((a, b) => (a.rating || 0) - (b.rating || 0));
      else if (sortBy === "replies") eps = eps.filter((e) => e.rating !== null).sort((a, b) => b.replies - a.replies);
    }

    return eps;
  }, [data, sortBy, showTop]);

  if (loading) {
    return (
      <div className={`${boxStyles.box} ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-[var(--color-line)] rounded w-1/2" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              // eslint-disable-next-line react-hooks/purity
              <div key={i} className="h-3 bg-[var(--color-line)] rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const { episodes, ratedCount, averageScore } = data;

  const ratedEps = episodes.filter((e) => e.rating !== null);
  const minRating = Math.min(...ratedEps.map((e) => e.rating || 5));
  const maxRating = Math.max(...ratedEps.map((e) => e.rating || 0));
  const range = Math.max(maxRating - minRating, 0.1);

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return "#10b981";
    if (score >= 4.0) return "var(--color-cyan)";
    if (score >= 3.5) return "#f59e0b";
    return "var(--color-magenta)";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 4.5) return "Masterpiece";
    if (score >= 4.0) return "Great";
    if (score >= 3.5) return "Good";
    if (score >= 3.0) return "Average";
    return "Below Avg";
  };

  return (
    <div className={`${boxStyles.box} ${className}`}>
      <div className={`${boxStyles.sectionHead} items-end`}>
        <h3 className={`font-display text-base font-bold flex items-center gap-2 ${boxStyles.boxTitle}`}>
          <span className={boxStyles.headingMark} />
          Episode Ratings
        </h3>
        <div className="text-right">
          <span className="font-mono text-sm font-bold text-[var(--color-magenta)]">
            {averageScore.toFixed(2)}
          </span>
          <span className={`${boxStyles.tinyMuted} ml-1`}>/ 5</span>
        </div>
      </div>

      {/* Stats */}
      <div className={`mb-4 flex flex-wrap items-center gap-3 text-[10px] text-[var(--color-mute)] ${boxStyles.statRow}`}>
        <span>{ratedCount}/{episodes.length} rated</span>
        <span className={boxStyles.tinyMuted}>·</span>
        <span className="text-[var(--color-magenta)]">
          Best: #{ratedEps.sort((a, b) => (b.rating || 0) - (a.rating || 0))[0]?.episode || "—"}
        </span>
      </div>

      {/* Filter tabs */}
      <div className={`mb-3 flex flex-wrap gap-1.5 ${boxStyles.pillRow}`}>
        {(["all", "best", "worst"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setShowTop(tab)}
            className={`${boxStyles.tab} ${showTop === tab ? boxStyles.tabActive : ""}`}
          >
            {tab === "all" ? "All" : tab === "best" ? "Best 10" : "Worst 10"}
          </button>
        ))}
        {showTop === "all" && (
          <div className="ml-auto flex gap-1">
            {(["episode", "rating-desc", "replies"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`${boxStyles.tab} ${sortBy === s ? boxStyles.tabActive : ""}`}
              >
                {s === "episode" ? "Ep#" : s === "rating-desc" ? "Top" : "Popular"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Episode chart */}
      <div className="space-y-1.5 max-h-80 overflow-y-auto scrollbar-thin pr-1">
        {showTop === "all" && sortBy === "episode" ? (
          /* Full chart view — all episodes in order */
          episodes.map((ep) => {
            const barWidth = ep.rating !== null
              ? ((ep.rating - minRating) / range) * 100
              : 0;
            const color = ep.rating !== null ? getScoreColor(ep.rating) : "var(--color-line)";
            const isSpecial = ep.filler || ep.recap;

            return (
              <div key={ep.episode} className="group flex items-center gap-2">
                <span className="w-7 text-right text-[10px] font-mono text-[var(--color-mute)] shrink-0">
                  {ep.episode}
                </span>
                <div className={`relative h-5 flex-1 overflow-hidden rounded ${boxStyles.track}`}>
                  {ep.rating !== null && (
                    <div
                      className="h-full rounded transition-all duration-500"
                      style={{ width: `${Math.max(barWidth, 2)}%`, backgroundColor: color }}
                    />
                  )}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 px-2">
                    <span className="text-[8px] font-bold text-white drop-shadow-lg truncate">
                      {ep.title}
                    </span>
                  </div>
                </div>
                <span className="w-8 text-right text-[10px] font-mono font-semibold shrink-0" style={{ color }}>
                  {ep.rating !== null ? ep.rating.toFixed(2) : "—"}
                </span>
                <span className="w-10 text-right text-[9px] text-[var(--color-mute)] shrink-0 hidden sm:block">
                  {ep.replies > 0 ? `${ep.replies}` : ""}
                </span>
                {isSpecial && (
                  <span className={`text-[8px] font-bold shrink-0 ${ep.filler ? "text-amber-400" : "text-[var(--color-mute)]"}`}>
                    {ep.filler ? "F" : "R"}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          /* Sorted list view — best/worst/custom sort */
          sortedEpisodes.map((ep, idx) => {
            const color = getScoreColor(ep.rating || 0);

            return (
              <div
                key={ep.episode}
                className={`flex items-center gap-3 rounded-lg border border-[var(--color-line)]/50 bg-[var(--color-surface)]/50 p-2.5 transition-all ${boxStyles.subCard}`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold font-mono shrink-0"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {showTop !== "all" ? idx + 1 : ep.episode}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">
                    Ep {ep.episode}: {ep.title || "Untitled"}
                  </p>
                  <p className="text-[9px] text-[var(--color-mute)]">
                    {ep.replies.toLocaleString()} replies
                    {ep.filler && <span className="ml-1 text-amber-400">· Filler</span>}
                    {ep.recap && <span className="ml-1 text-[var(--color-mute)]">· Recap</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold font-mono" style={{ color }}>
                    {ep.rating?.toFixed(2) || "—"}
                  </span>
                  <span className="text-[8px] text-[var(--color-mute)] block">
                    {getScoreLabel(ep.rating || 0)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className={`mt-3 flex flex-wrap gap-3 pt-3 ${boxStyles.rowDivider} ${boxStyles.legend}`}>
        <span className={boxStyles.legendItem}><span className={`${boxStyles.legendDot} bg-emerald-500`} /> 4.5+ Masterpiece</span>
        <span className={boxStyles.legendItem}><span className={`${boxStyles.legendDot} bg-[var(--color-cyan)]`} /> 4.0+ Great</span>
        <span className={boxStyles.legendItem}><span className={`${boxStyles.legendDot} bg-amber-500`} /> 3.5+ Good</span>
        <span className={boxStyles.legendItem}><span className={`${boxStyles.legendDot} bg-[var(--color-magenta)]`} /> Below 3.5</span>
        <span className={boxStyles.legendItem}><span className={`${boxStyles.legendDot} bg-amber-400`} /> F</span>
      </div>

      <p className={`mt-2 ${boxStyles.sourceNote}`}>
        Ratings source: {internalOnly ? "MyAnimeList" : <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--color-cyan)]">MyAnimeList</a>} (1-5 scale)
      </p>
    </div>
  );
}
