"use client";

import { useRef, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatToonYears, type CartoonEntry } from "@/lib/toons-data";
import ToonArtwork from "../ToonArtwork";
import styles from "../toons.module.css";

const COUNTRY_FLAG: Record<string, string> = {
  India: "🇮🇳",
  Japan: "🇯🇵",
  USA: "🇺🇸",
  France: "🇫🇷",
};

const STATUS_COLOR: Record<string, string> = {
  airing: "bg-green-500/15 text-green-400",
  completed: "bg-[var(--color-cyan)]/15 text-[var(--color-cyan)]",
  hiatus: "bg-amber-500/15 text-amber-400",
};

const POPULARITY_LABEL: Record<string, string> = {
  high: "🔥 Popular",
  medium: "● Known",
  low: "○ Niche",
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ToonDetailClient({ toon }: { toon: CartoonEntry }) {
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
    el.style.transform = `perspective(900px) rotateY(${px * 3}deg) rotateX(${-py * 3}deg) scale(1.005)`;
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg) scale(1)";
  }, []);

  // Unknown values are omitted rather than shown as placeholder dashes.
  const facts = [
    { label: "Network", value: toon.network },
    { label: "Studio", value: toon.studio },
    { label: "Creator", value: toon.creator },
    { label: "Country", value: `${COUNTRY_FLAG[toon.country] || "🌍"} ${toon.country}` },
    { label: "Release", value: formatToonYears(toon) },
    { label: "Episodes", value: toon.totalEpisodes != null ? String(toon.totalEpisodes) : undefined },
    { label: "Seasons", value: toon.seasons != null ? String(toon.seasons) : undefined },
    { label: "Rating", value: toon.rating },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));

  const footerMeta = [
    toon.totalEpisodes != null ? `${toon.totalEpisodes} eps` : null,
    toon.seasons != null ? `${toon.seasons} seasons` : null,
  ].filter(Boolean) as string[];

  return (
    <div className={`${styles.page} mx-auto max-w-4xl px-4 py-10 sm:px-6 animate-page-in`}>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--color-mute)]">
        <Link href="/" className="hover:text-[var(--color-cyan)] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/toons" className="hover:text-[var(--color-cyan)] transition-colors">Toons</Link>
        <span>/</span>
        <span className="text-[var(--color-ink)] line-clamp-1">{toon.displayTitle}</span>
      </nav>

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={`${styles.detailHero} neon-premium rounded-[20px]`}
      >
        <div className="neon-premium-track" />
        <div className="neon-premium-overlay" style={{ background: "rgba(10,10,15,0.92)" }} />
        <div className="neon-premium-content rounded-[20px] p-5 sm:p-8">
          <div className="mb-5 flex items-center gap-2">
            <span className="h-1.5 w-8 rounded-full bg-gradient-to-r from-[var(--color-cyan)] to-[var(--color-magenta)] shadow-[0_0_10px_rgba(0,255,224,0.4)]" />
            <span className="rounded-full border border-[var(--color-cyan)]/40 bg-[var(--color-cyan)]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-cyan)]">
              Toon Database
            </span>
            <span className="ml-auto text-lg">{COUNTRY_FLAG[toon.country] || "🌍"}</span>
          </div>

          <div className="flex flex-col gap-6 sm:flex-row">
            {/* Image */}
            <motion.div
              ref={ref}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl sm:w-72 sm:aspect-[4/3]"
              style={{ transition: "transform 0.2s ease-out" }}
            >
              <ToonArtwork
                toon={toon}
                sizes="(max-width: 640px) 100vw, 288px"
                priority
              />
            </motion.div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <h1 className={`${styles.titleGlow} font-display text-2xl font-black sm:text-3xl`}>{toon.displayTitle}</h1>
              <p className="mt-1 text-xs text-[var(--color-mute)]">
                {[toon.network, formatToonYears(toon)].filter(Boolean).join(" · ")}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${STATUS_COLOR[toon.status] || "bg-[var(--color-line)]/50 text-[var(--color-mute)]"}`}>
                  {toon.status}
                </span>
                {toon.popularity && (
                  <span className="rounded-full bg-[var(--color-magenta)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-magenta)]">
                    {POPULARITY_LABEL[toon.popularity]}
                  </span>
                )}
                {toon.rating && (
                  <span className="rounded-full border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-gold)]">
                    {toon.rating}
                  </span>
                )}
              </div>

              <p className="mt-4 text-sm leading-relaxed text-[var(--color-ink)]/90">{toon.description || toon.synopsis}</p>

              {/* Genres */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {toon.genres.map((g) => (
                  <span key={g} className={`${styles.tagChip} rounded-full bg-[var(--color-line)]/50 px-2.5 py-1 text-[10px] font-semibold text-[var(--color-mute)]`}>
                    {g}
                  </span>
                ))}
              </div>

              {/* Languages */}
              {toon.language.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {toon.language.map((l) => (
                    <span key={l} className={`${styles.tagChip} rounded bg-[var(--color-cyan)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-cyan)]`}>
                      {l}
                    </span>
                  ))}
                </div>
              )}

              {/* Watch platform */}
              {toon.dubPlatform && (
                <div className="mt-4 rounded-xl bg-[var(--color-cyan)]/5 px-4 py-3 ring-1 ring-inset ring-[var(--color-cyan)]/15">
                  <p className="text-[10px] text-[var(--color-mute)] uppercase tracking-wider">Watch on</p>
                  <p className="text-sm font-bold text-[var(--color-cyan)]">{toon.dubPlatform}</p>
                </div>
              )}
            </div>
          </div>

          {/* Facts grid */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className={`${styles.factCard} rounded-xl bg-[var(--color-void)]/40 px-3 py-2.5 ring-1 ring-inset ring-[var(--color-line)]/60`}>
                <p className="text-[9px] font-mono text-[var(--color-mute)] uppercase tracking-wider">{f.label}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-[var(--color-ink)]" title={f.value}>{f.value}</p>
              </div>
            ))}
          </div>

          {/* Tags */}
          {toon.tags.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[10px] font-mono text-[var(--color-mute)] uppercase tracking-wider">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {toon.tags.map((t) => (
                  <span key={t} className={`${styles.tagChip} rounded-full px-2.5 py-1 text-[10px] text-[var(--color-mute)] ring-1 ring-inset ring-[var(--color-line)]`}>
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Link href="/toons" className={`${styles.detailCta} rounded-xl neon-rgb-border bg-[var(--color-panel)] px-4 py-2 text-xs font-semibold text-[var(--color-cyan)] no-underline`}>
              ← Browse all toons
            </Link>
            {footerMeta.length > 0 && (
              <p className="font-mono text-[10px] text-[var(--color-mute)]">{footerMeta.join(" · ")}</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
