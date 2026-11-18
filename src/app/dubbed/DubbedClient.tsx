"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";
import { ErrorState } from "@/components/Loader";
import DubExpandingCard from "@/components/DubExpandingCard";
import NativeBannerAd from "@/components/NativeBannerAd";
import type {
  DubAnime,
  LangKey as DubLanguageKey,
  DubSchedulePayload,
} from "./page";

const LANG_TABS: { key: DubLanguageKey; label: string; accent: string }[] = [
  { key: "english", label: "English", accent: "#3b82f6" },
  { key: "hindi", label: "Hindi", accent: "#ff9933" },
  { key: "tamil", label: "Tamil", accent: "#e84a5f" },
  { key: "telugu", label: "Telugu", accent: "#6c63ff" },
];

const SECTION_LIMIT = 8;

/** currentSeason and recent come back identical from the API — show one. */
function dedupe(items: DubAnime[]): DubAnime[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.mal_id)) return false;
    seen.add(item.mal_id);
    return true;
  });
}

export default function DubbedClient({
  initialLanguage,
  initialPayload,
}: {
  initialLanguage: DubLanguageKey;
  initialPayload: DubSchedulePayload;
}) {
  const [language, setLanguage] = useState<DubLanguageKey>(initialLanguage);
  const [data, setData] = useState<DubSchedulePayload>(initialPayload);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (lang: DubLanguageKey, signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dub-schedule?language=${lang}`, { signal });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error || "Failed to fetch");
      setData({
        data: payload.data,
        counts: payload.counts,
        updatedAt: payload.updatedAt ?? null,
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  const activeRequestRef = useRef<AbortController | null>(null);

  // Fetch on tab interaction rather than in an effect: the server already
  // provided the initial payload, and event handlers keep state updates out
  // of effects (which avoids cascading renders).
  function selectLanguage(next: DubLanguageKey) {
    if (next === language) return;
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLanguage(next);
    void load(next, controller.signal);
  }

  useEffect(() => () => activeRequestRef.current?.abort(), []);

  const available = useMemo(() => dedupe(data.data.available || []), [data]);
  const comingSoon = useMemo(() => dedupe(data.data.comingSoon || []), [data]);
  const currentSeason = useMemo(() => dedupe(data.data.currentSeason || []), [data]);
  const counts = data.counts;
  const total = counts[language] || counts.total || 0;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggleExpand(section: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function sectionItems(all: DubAnime[], key: string) {
    return expanded.has(key) ? all : all.slice(0, SECTION_LIMIT);
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
          <div className="neon-rgb-border rounded-xl px-5 py-3 inline-block">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-cyan)]">Regional Dubbed Hub</p>
            <h1 className="font-display text-3xl font-black sm:text-4xl md:text-5xl tracking-tight mt-1">
              Anime Dubs
            </h1>
            <p className="mt-2 text-sm text-[var(--color-mute)]">
              Track English, Hindi, Tamil & Telugu dubbed anime from catalogue metadata.
            </p>
          </div>
        </motion.div>

        {/* Language tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {LANG_TABS.map((tab) => (
            <button key={tab.key} onClick={() => selectLanguage(tab.key)}
              className={`relative rounded-full px-5 py-2 text-sm font-bold transition-all ${
                language === tab.key
                  ? "text-black shadow-lg"
                  : "text-[var(--color-mute)] neon-rgb-border"
              }`}
              style={language === tab.key ? { backgroundColor: tab.accent } : {}}
            >
              {tab.label}
              {counts && <span className="ml-1.5 opacity-70">({counts[tab.key] || 0})</span>}
            </button>
          ))}
        </div>

        {/* Stats */}
        {counts && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-mute)] mb-8 pb-6 rounded-xl px-4 py-3 neon-rgb-border">
            {currentSeason.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--color-cyan)]" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
                {currentSeason.length} Current Season
              </span>
            )}
            {available.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--color-violet)]" />
                {available.length} Available Now
              </span>
            )}
            {comingSoon.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--color-amber)]" />
                {comingSoon.length} Coming Soon
              </span>
            )}
            <span className="font-mono">{total} Total</span>
            {data.updatedAt && <span className="font-mono">Updated {data.updatedAt}</span>}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-4" aria-busy="true">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-20 rounded-xl bg-[var(--color-panel)] animate-pulse neon-rgb-border" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load(language, new AbortController().signal)} />
        ) : (
          <div className="space-y-8">
            {currentSeason.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4 rounded-xl px-4 py-2 inline-flex neon-rgb-border">
                  <span className="h-3 w-1 rounded-full bg-[var(--color-cyan)]" />
                  Current Season ({currentSeason.length})
                </h2>
                <AnimatePresence mode="wait">
                  <motion.div key={language} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <DubExpandingCard items={sectionItems(currentSeason, "cs")} />
                    {currentSeason.length > SECTION_LIMIT && (
                      <button onClick={() => toggleExpand("cs")}
                        className="mt-3 w-full rounded-xl py-2.5 text-xs font-semibold text-[var(--color-mute)] hover:text-[var(--color-cyan)] transition-all"
                      >
                        {expanded.has("cs") ? "Show less ↑" : `View all ${currentSeason.length} →`}
                      </button>
                    )}
                  </motion.div>
                </AnimatePresence>
              </section>
            )}

            {comingSoon.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4 rounded-xl px-4 py-2 inline-flex neon-rgb-border">
                  <span className="h-3 w-1 rounded-full bg-[var(--color-amber)]" />
                  Coming Soon ({comingSoon.length})
                </h2>
                <AnimatePresence mode="wait">
                  <motion.div key={language} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <DubExpandingCard items={sectionItems(comingSoon, "co")} />
                    {comingSoon.length > SECTION_LIMIT && (
                      <button onClick={() => toggleExpand("co")}
                        className="mt-3 w-full rounded-xl py-2.5 text-xs font-semibold text-[var(--color-mute)] hover:text-[var(--color-cyan)] transition-all"
                      >
                        {expanded.has("co") ? "Show less ↑" : `View all ${comingSoon.length} →`}
                      </button>
                    )}
                  </motion.div>
                </AnimatePresence>
              </section>
            )}

            {available.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4 rounded-xl px-4 py-2 inline-flex neon-rgb-border">
                  <span className="h-3 w-1 rounded-full bg-[var(--color-violet)]" />
                  Available Now ({available.length})
                </h2>
                <AnimatePresence mode="wait">
                  <motion.div key={language} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <DubExpandingCard items={sectionItems(available, "av")} />
                    {available.length > SECTION_LIMIT && (
                      <button onClick={() => toggleExpand("av")}
                        className="mt-3 w-full rounded-xl py-2.5 text-xs font-semibold text-[var(--color-mute)] hover:text-[var(--color-cyan)] transition-all"
                      >
                        {expanded.has("av") ? "Show less ↑" : `View all ${available.length} →`}
                      </button>
                    )}
                  </motion.div>
                </AnimatePresence>
              </section>
            )}

            {currentSeason.length === 0 && available.length === 0 && comingSoon.length === 0 && (
              <div className="py-16 text-center neon-rgb-border rounded-xl">
                <p className="text-lg font-display text-[var(--color-mute)]">No dubbed anime found</p>
                <p className="mt-1 text-sm text-[var(--color-mute)]">Try selecting a different language.</p>
              </div>
            )}
          </div>
        )}

        {/* Indian Voice Actors (shown when Indian language is selected) */}
        {(language === "hindi" || language === "tamil" || language === "telugu") && (
          <div className="mt-10 rounded-xl neon-rgb-border bg-[var(--color-panel)] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold">Indian Voice Actors</h3>
                <p className="text-xs text-[var(--color-mute)] mt-1">Meet the talented artists behind Indian anime dubs.</p>
              </div>
              <Link href="/voice-actors/indian"
                className="text-xs font-semibold text-[var(--color-cyan)] hover:underline shrink-0"
              >View all →</Link>
            </div>
          </div>
        )}
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-6">
        <NativeBannerAd />
      </div>
    </PageTransition>
  );
}
