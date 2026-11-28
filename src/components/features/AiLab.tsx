"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import styles from "./AiLab.module.css";

type CardId = "theory" | "taste" | "fancast" | "s2predict" | "dreamteam";

type PredictionType = "ending" | "next_arc" | "villain" | "power_up" | "romance" | "twist" | "side_plot";

interface TheoryCard {
  headline: string;
  confidence: number;
  predictions: { type: PredictionType; title: string; text: string }[];
}
interface TasteCard { score: number; verdict: string; brief: string; reasons: string[]; }
interface FancastCard { hook: string; casting: { role: string; actor: string; reason: string }[]; }
interface S2Card { headline: string; story: string; arcs: string[]; stakes: string; new_chars: string[]; reveal: string; }
interface DreamTeamCard { mission: string; team: { member: string; role: string; power: string }[]; }

const TABS: { id: CardId; emoji: string; label: string; blurb: string; public: boolean }[] = [
  { id: "theory", emoji: "🔮", label: "Future Theory", blurb: "Predict what happens next", public: true },
  { id: "taste", emoji: "🎯", label: "Will you like it?", blurb: "AI taste-match for you", public: false },
  { id: "fancast", emoji: "🎬", label: "Live-Action Cast", blurb: "Who would play who", public: true },
  { id: "s2predict", emoji: "🚀", label: "Next Season", blurb: "Predict the continuation", public: true },
  { id: "dreamteam", emoji: "⚔️", label: "Dream Team", blurb: "Assemble a squad", public: true },
];

const PREDICTION_META: Record<PredictionType, { label: string; emoji: string }> = {
  ending: { label: "Ending", emoji: "🔚" },
  next_arc: { label: "Next Arc", emoji: "🧭" },
  villain: { label: "Villain", emoji: "👹" },
  power_up: { label: "Power-up", emoji: "🔥" },
  romance: { label: "Romance", emoji: "💘" },
  twist: { label: "Twist", emoji: "😱" },
  side_plot: { label: "Side Plot", emoji: "🌱" },
};

const VERDICT_COLOR: Record<string, string> = {
  watch: "var(--color-cyan)",
  binge: "var(--color-magenta)",
  wait: "#f59e0b",
  skip: "#ef4444",
};

interface LoadState {
  status: "idle" | "loading" | "done" | "error";
  data: unknown;
  error: string;
}

const emptyState: LoadState = { status: "idle", data: null, error: "" };

export default function AiLab({ animeId, title }: { animeId: number; title: string }) {
  const [active, setActive] = useState<CardId>("theory");
  const [cards, setCards] = useState<Record<CardId, LoadState>>({
    theory: emptyState,
    taste: emptyState,
    fancast: emptyState,
    s2predict: emptyState,
    dreamteam: emptyState,
  });
  const [votes, setVotes] = useState<{ agree: number; refute: number; myVote: boolean | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async (cardId: CardId, fresh = false) => {
    setCards((prev) => ({ ...prev, [cardId]: { status: "loading", data: null, error: "" } }));
    setCopied(false);
    try {
      const params = new URLSearchParams({ card: cardId });
      if (fresh) params.set("refresh", "1");
      const res = await fetch(`/api/anime/${animeId}/ai-lab?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        setCards((prev) => ({
          ...prev,
          [cardId]: { status: "error", data: null, error: "signin" },
        }));
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.card) {
        setCards((prev) => ({
          ...prev,
          [cardId]: { status: "error", data: null, error: json.error || "Something went wrong." },
        }));
        return;
      }
      setCards((prev) => ({ ...prev, [cardId]: { status: "done", data: json.card, error: "" } }));
    } catch {
      setCards((prev) => ({
        ...prev,
        [cardId]: { status: "error", data: null, error: "Network error — try again." },
      }));
    }
  }, [animeId]);

  useEffect(() => {
    fetch(`/api/anime/${animeId}/ai-lab/vote`)
      .then((r) => r.json())
      .then((d) => setVotes(d))
      .catch(() => {});
  }, [animeId]);

  function openTab(id: CardId) {
    setActive(id);
    const s = cards[id];
    if (s.status === "idle" || s.status === "error") load(id);
  }

  async function toggleVote(agree: boolean) {
    const prev = votes;
    setVotes((v) =>
      v
        ? {
            agree: v.agree + (v.myVote === true ? -1 : 0) + (agree && v.myVote !== true ? 1 : 0),
            refute: v.refute + (v.myVote === false ? -1 : 0) + (!agree && v.myVote !== false ? 1 : 0),
            myVote: v.myVote === agree ? null : agree,
          }
        : v
    );
    try {
      const res = await fetch(`/api/anime/${animeId}/ai-lab/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agree }),
      });
      if (res.status === 401) {
        setVotes(prev);
        router.push("/login");
        return;
      }
      const d = await res.json();
      if (d) setVotes({ agree: d.agree, refute: d.refute, myVote: d.myVote });
    } catch {
      setVotes(prev);
    }
  }

  const theory = cards.theory.data as TheoryCard | null;
  const theoryShareText = theory
    ? `🔮 ${title} — Zyni AI Future Theory: ${theory.headline}\n\n${theory.predictions
        .map((p) => `${PREDICTION_META[p.type]?.emoji || "▪"} ${p.title}: ${p.text}`)
        .join("\n")}\n\nSpeculative fan theory, not canon. ${typeof window !== "undefined" ? window.location.origin : "https://zyverse.in"}/anime/${animeId}`
    : "";

  async function copyTheory() {
    try {
      await navigator.clipboard.writeText(theoryShareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  async function downloadTheoryCard() {
    if (!captureRef.current || downloading) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(captureRef.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `zyniverse-theory-${animeId}.png`;
      a.click();
    } catch { /* ignore */ }
    setDownloading(false);
  }

  const activeState = cards[active];
  const activeTab = TABS.find((t) => t.id === active);

  return (
    <section className={styles.labSection}>
      <span className={styles.labGlow} aria-hidden="true" />
      <div className={styles.labHead}>
        <h2 className={styles.labTitle}>
          <span className={styles.labMark} aria-hidden="true" />
          Zyni AI Lab
        </h2>
        <span className={styles.labBadge}>AI · speculative</span>
        <div className={styles.labActions}>
          <Link href="/theories" className={styles.labLink}>
            Top theories →
          </Link>
          <button
            type="button"
            onClick={() => void load(active, true)}
            disabled={activeState.status === "loading"}
            aria-label="Add new Zyni AI card"
            title="Generate a fresh card (uses 1 AI credit)"
            className={styles.freshButton}
          >
            + New card
          </button>
        </div>
      </div>

      {/* Tab pills */}
      <div className={styles.tabRail} role="tablist" aria-label="Zyni AI Lab cards">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => openTab(tab.id)}
            className={`${styles.tab} ${active === tab.id ? styles.tabActive : ""}`}
            title={tab.blurb}
          >
            <span aria-hidden="true" className={styles.tabEmoji}>
              {tab.emoji}
            </span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.labPanel} role="tabpanel">
        {activeState.status === "loading" && (
          <div className={styles.skeletonStack}>
            <div className={`${styles.skeletonLine} ${styles.skeletonLg}`} />
            <div className={`${styles.skeletonLine} ${styles.skeletonMd}`} />
            <div className={`${styles.skeletonLine} ${styles.skeletonSm}`} />
            <p className={styles.loadingNote}>Zyni AI is thinking…</p>
          </div>
        )}

        {activeState.status === "error" && (
          <div className={styles.errorState}>
            {activeState.error === "signin" ? (
              <>
                <p className={styles.errorIcon} aria-hidden="true">🔮</p>
                <p className={styles.errorText}>
                  Sign in to let Zyni AI cook up a {activeTab?.label.toLowerCase() || "card"} for this anime.
                </p>
                <Link href="/login" className={styles.errorButton}>
                  Sign in free
                </Link>
              </>
            ) : (
              <p className={styles.errorText}>{activeState.error}</p>
            )}
          </div>
        )}

        {activeState.status === "done" && active === "theory" && theory && (
          <div>
            <div ref={captureRef} className={styles.theoryCard}>
              <div className={styles.theoryTop}>
                <span>🔮 Zyni AI Future Theory</span>
                <span className={styles.theoryDivider}>·</span>
                <span className={styles.theoryAnime}>{title}</span>
              </div>
              <h3 className={styles.theoryTitle}>{theory.headline}</h3>
              <div className={styles.confidenceTrack}>
                <div
                  className={styles.confidenceFill}
                  style={{ width: `${Math.min(100, Math.max(0, theory.confidence || 50))}%` }}
                />
              </div>
              <p className={styles.confidenceNote}>
                {theory.confidence ?? 50}% AI confidence · speculation, not canon
              </p>
              <div className={styles.predictionList}>
                {(theory.predictions || []).map((p, i) => (
                  <div key={i} className={styles.predictionCard}>
                    <p className={styles.predictionMeta}>
                      {PREDICTION_META[p.type]?.emoji || "▪"} {PREDICTION_META[p.type]?.label || p.type} — {p.title}
                    </p>
                    <p className={styles.predictionText}>{p.text}</p>
                  </div>
                ))}
              </div>
              <div className={styles.theoryFooter}>
                <span className={styles.theoryGenerated}>
                  Generated by ZyniVerse AI · fan theory · may be legendary
                </span>
                <span className={styles.theoryBrand}>✦ zyverse.in</span>
              </div>
            </div>

            {/* Vote + share bar */}
            <div className={styles.actionBar}>
              <button
                type="button"
                onClick={() => toggleVote(true)}
                className={`${styles.actionButton} ${votes?.myVote === true ? styles.actionAgreeActive : ""}`}
              >
                🙏 I think so {votes ? `· ${votes.agree}` : ""}
              </button>
              <button
                type="button"
                onClick={() => toggleVote(false)}
                className={`${styles.actionButton} ${votes?.myVote === false ? styles.actionCapActive : ""}`}
              >
                🧢 Cap {votes ? `· ${votes.refute}` : ""}
              </button>
              <button type="button" onClick={copyTheory} className={styles.actionButton}>
                {copied ? "✓ Copied" : "Copy text"}
              </button>
              <button
                type="button"
                onClick={downloadTheoryCard}
                disabled={downloading}
                className={`${styles.actionButton} ${styles.actionSave}`}
              >
                {downloading ? "Rendering…" : "Save card 📸"}
              </button>
            </div>
          </div>
        )}

        {activeState.status === "done" && active === "taste" && (
          <TasteView card={cards.taste.data as TasteCard} title={title} />
        )}
        {activeState.status === "done" && active === "fancast" && (
          <div className={styles.viewStack}>
            <span className={styles.viewIcon} aria-hidden="true">🎬</span>
            <p className={`${styles.viewLead} ${styles.hookLead}`}>
              {(cards.fancast.data as FancastCard)?.hook}
            </p>
            <div className={styles.castList}>
              {((cards.fancast.data as FancastCard)?.casting || []).map((c, i) => (
                <div key={i} className={styles.castRow}>
                  <span className={styles.castNumber}>#{i + 1}</span>
                  <div className={styles.castBody}>
                    <p className={styles.castLine}>
                      {c.role} <span className={styles.castArrow}>→</span> <span className={styles.castActor}>{c.actor}</span>
                    </p>
                    <p className={styles.castReason}>{c.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeState.status === "done" && active === "s2predict" && (
          <div className={styles.viewStack}>
            <div>
              <span className={styles.viewKicker}>🚀 Predicted continuation</span>
              <h3 className={styles.viewTitle}>{(cards.s2predict.data as S2Card)?.headline}</h3>
            </div>
            <p className={styles.viewLead}>{(cards.s2predict.data as S2Card)?.story}</p>
            <div className={styles.chipRow}>
              {((cards.s2predict.data as S2Card)?.arcs || []).map((a, i) => (
                <span key={i} className={styles.infoChip}>{a}</span>
              ))}
            </div>
            <div className={styles.stakesBox}>
              <span className={styles.stakesLabel}>Stakes:</span>{" "}
              <span>{(cards.s2predict.data as S2Card)?.stakes}</span>
            </div>
            {(cards.s2predict.data as S2Card)?.new_chars?.length > 0 && (
              <p className={styles.newFaces}>
                <span className={styles.newFacesStrong}>Possible new faces:</span>{" "}
                {((cards.s2predict.data as S2Card).new_chars || []).join(", ")}
              </p>
            )}
            <p className={styles.teaseBox}>
              {`Season tease: `}{(cards.s2predict.data as S2Card)?.reveal}
            </p>
          </div>
        )}
        {activeState.status === "done" && active === "dreamteam" && (
          <div className={styles.viewStack}>
            <span className={styles.viewKicker}>⚔️ Dream squad</span>
            <p className={styles.viewLead}>{(cards.dreamteam.data as DreamTeamCard)?.mission}</p>
            <div className={styles.teamGrid}>
              {((cards.dreamteam.data as DreamTeamCard)?.team || []).map((m, i) => (
                <div key={i} className={styles.teamCard}>
                  <p className={styles.teamMember}>{m.member}</p>
                  <p className={styles.teamRole}>{m.role}</p>
                  <p className={styles.teamPower}>{m.power}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TasteView({ card, title }: { card: TasteCard; title: string }) {
  if (!card) return null;
  const score = Math.min(100, Math.max(0, card.score || 0));
  const barColor = score >= 75 ? "var(--color-cyan)" : score >= 45 ? "#f59e0b" : "var(--color-magenta)";
  const verdict = card.verdict || "Watch now";
  const verdictColor = VERDICT_COLOR[verdict.toLowerCase().split(" ")[0]] || "var(--color-cyan)";
  return (
    <div className={styles.tasteCard}>
      <div className={styles.tasteHead}>
        <div
          className={styles.scoreRing}
          style={{
            background: `conic-gradient(${barColor} ${score * 3.6}deg, color-mix(in srgb, var(--color-line) 78%, transparent) 0deg)`,
          }}
        >
          <div className={styles.scoreInner}>
            <span className={styles.scoreValue} style={{ color: barColor }}>{score}%</span>
          </div>
        </div>
        <div>
          <p className={styles.tasteQuestion}>
            Will you like {title}?
          </p>
          <span
            className={styles.verdict}
            style={{
              backgroundColor: `color-mix(in srgb, ${verdictColor} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${verdictColor} 44%, transparent)`,
              color: verdictColor,
            }}
          >
            {verdict}
          </span>
        </div>
      </div>
      <p className={styles.viewLead}>{card.brief}</p>
      <div className={styles.reasonList}>
        {(card.reasons || []).map((r, i) => (
          <div key={i} className={styles.reasonRow}>
            <span className={styles.reasonBullet} aria-hidden="true">▸</span>
            <p className={styles.reasonText}>{r}</p>
          </div>
        ))}
      </div>
      <p className={styles.tasteNote}>
        Scored against your favourite genres, moods &amp; tracked shows · Zyni AI
      </p>
    </div>
  );
}
