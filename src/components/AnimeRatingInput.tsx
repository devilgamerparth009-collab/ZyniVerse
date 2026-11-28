"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useWatchlist } from "@/components/WatchlistProvider";
import type { SubScores } from "@/components/WatchlistProvider";
import boxStyles from "./detailBoxes.module.css";

const CATEGORIES: { key: keyof SubScores; label: string; hint: string }[] = [
  { key: "story", label: "Story", hint: "Plot & writing" },
  { key: "art", label: "Art", hint: "Animation & visuals" },
  { key: "sound", label: "Sound", hint: "OST & voice acting" },
  { key: "characters", label: "Characters", hint: "Cast & development" },
  { key: "enjoyment", label: "Enjoyment", hint: "How fun it was" },
];

const SCORE_VALUES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

function scoreColor(value: number): string {
  if (value >= 9) return "#10b981";
  if (value >= 7) return "var(--color-cyan)";
  if (value >= 5) return "#f59e0b";
  return "var(--color-magenta)";
}

function computeOverall(subs: SubScores): number | null {
  const vals = Object.values(subs).filter((s): s is number => typeof s === "number" && s >= 1 && s <= 10);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export default function AnimeRatingInput({
  mediaId,
  type = "ANIME",
  className = "",
}: {
  mediaId: number;
  type?: string;
  className?: string;
}) {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user);
  const { getScore, getSubScores, rate } = useWatchlist();
  const savedSubs = getSubScores(mediaId);
  const savedOverall = getScore(mediaId);

  const [draft, setDraft] = useState<SubScores>(() => ({
    story: savedSubs.story ?? null,
    art: savedSubs.art ?? null,
    sound: savedSubs.sound ?? null,
    characters: savedSubs.characters ?? null,
    enjoyment: savedSubs.enjoyment ?? null,
  }));
  const [hovering, setHovering] = useState<Partial<SubScores>>({});
  const [saving, setSaving] = useState(false);

  const overall = useMemo(() => computeOverall(draft), [draft]);
  const hasAny = Object.values(draft).some((s) => s != null);
  const isSubScoreMode = hasAny || Object.values(savedSubs).some((s) => s != null);

  async function handleSet(key: keyof SubScores, value: number | null) {
    if (!signedIn) return;
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (value === null && !Object.values(next).some((s) => s != null)) {
      // clearing everything removes the rating too
      setSaving(true);
      try { rate(mediaId, null, type, next); } finally { setSaving(false); }
      return;
    }
    setSaving(true);
    try { rate(mediaId, computeOverall(next), type, next); } finally { setSaving(false); }
  }

  async function handleClearAll() {
    if (!signedIn) return;
    setSaving(true);
    try {
      setDraft({ story: null, art: null, sound: null, characters: null, enjoyment: null });
      rate(mediaId, null, type, { story: null, art: null, sound: null, characters: null, enjoyment: null });
    } finally { setSaving(false); }
  }

  return (
    <div className={`${boxStyles.box} ${className}`}>
      <div className={boxStyles.sectionHead}>
        <h3 className={`font-display text-sm font-bold flex items-center gap-2 ${boxStyles.boxTitle}`}>
          <span className={boxStyles.headingMark} />
          Your Rating
        </h3>
        {overall || (isSubScoreMode ? null : savedOverall) ? (
          <div className="flex items-center gap-2">
            <div
              className={`${boxStyles.scoreOrb} font-mono text-sm font-bold text-black shadow-lg`}
              style={{ backgroundColor: scoreColor((overall ?? savedOverall) as number) }}
            >
              {overall ?? savedOverall}
            </div>
            <span className={boxStyles.tinyMuted}>
              {isSubScoreMode ? "overall" : "score"}/10
            </span>
          </div>
        ) : null}
      </div>

      {!signedIn && (
        <div className={`${boxStyles.noteCard} ${boxStyles.mutedText} mb-3`} role="status">
          <Link href="/login" className={boxStyles.textLink}>Sign in</Link> to save your rating.
        </div>
      )}

      {!isSubScoreMode && savedOverall && (
        <p className={`mb-3 ${boxStyles.tinyMuted}`}>
          You rated {savedOverall}/10. Set sub-scores below for a detailed breakdown (AniList style).
        </p>
      )}

      <div className="space-y-3">
        {CATEGORIES.map((cat) => {
          const display = hovering[cat.key] ?? draft[cat.key];
          return (
            <div key={cat.key}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-[var(--color-mute)]">
                  {cat.label}
                  <span className="ml-1.5 text-[9px] font-normal opacity-60">{cat.hint}</span>
                </span>
                {display != null && (
                  <span className="font-mono text-[11px] font-bold" style={{ color: scoreColor(display) }}>
                    {display}
                  </span>
                )}
              </div>
              <div className={`flex flex-wrap gap-1 ${boxStyles.ratingRow}`}>
                {SCORE_VALUES.map((v) => {
                  const active = display === v;
                  return (
                    <button
                      key={v}
                      onClick={() => handleSet(cat.key, active ? null : v)}
                      onMouseEnter={() => setHovering((h) => ({ ...h, [cat.key]: v }))}
                      onMouseLeave={() => setHovering((h) => ({ ...h, [cat.key]: null }))}
                      disabled={saving}
                      className={`${boxStyles.scoreButton} ${
                        active ? `${boxStyles.scoreButtonActive} text-black scale-105` : ""
                      }`}
                      style={
                        active
                          ? { backgroundColor: scoreColor(v) }
                          : undefined
                      }
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {(hasAny || isSubScoreMode) && (
        <div className={`mt-4 flex items-center justify-between pt-3 ${boxStyles.rowDivider}`}>
          <span className={boxStyles.tinyMuted}>
            Overall = average of your sub-scores
          </span>
          <button
            onClick={handleClearAll}
            disabled={saving}
            className={boxStyles.clearButton}
          >
            Clear rating
          </button>
        </div>
      )}
    </div>
  );
}
