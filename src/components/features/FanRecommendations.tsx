"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import boxStyles from "../detailBoxes.module.css";

type Rec = {
  id: string;
  fromMediaId: number;
  fromTitle: string;
  fromType: string;
  toMediaId: number;
  toTitle: string;
  toType: string;
  meaning: string;
  authorUsername: string | null;
  upvotes: number;
  downvotes: number;
  createdAt: string;
};

export default function FanRecommendations({ mediaId, mediaTitle, className = "" }: { mediaId: number; mediaTitle: string; className?: string }) {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [toTitle, setToTitle] = useState("");
  const [toId, setToId] = useState("");
  const [meaning, setMeaning] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user);

  useEffect(() => {
    let active = true;
    fetch(`/api/recommendations?fromId=${mediaId}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setRecs(d.recommendations || []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mediaId]);

  const submit = async () => {
    if (!signedIn) {
      setMsg({ type: "err", text: "Sign in to add a pick." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromMediaId: mediaId,
          fromTitle: mediaTitle,
          toMediaId: Number(toId),
          toTitle,
          meaning,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to add");
      setRecs((prev) => [d.recommendation, ...prev]);
      setShowForm(false);
      setToTitle("");
      setToId("");
      setMeaning("");
      setMsg(null);
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed to add recommendation." });
    }
    setBusy(false);
  };

  const vote = async (id: string, value: number) => {
    if (!signedIn) {
      setMsg({ type: "err", text: "Sign in to vote on picks." });
      return;
    }
    if (votes[id] === value) return;
    const res = await fetch(`/api/recommendations/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (res.ok) {
      const d = await res.json();
      setRecs((prev) => prev.map((r) => (r.id === id ? { ...r, upvotes: d.upvotes, downvotes: d.downvotes } : r)));
      setVotes((prev) => ({ ...prev, [id]: value }));
    }
  };

  return (
    <section className={`${boxStyles.fanBox} mt-8 ${className}`}>
      <div className={`${boxStyles.sectionHead} items-start`}>
        <div>
          <h2 className={`${boxStyles.boxTitle} font-display text-2xl font-bold sm:text-3xl`}>Fan Recommendations</h2>
          <p className={`${boxStyles.mutedText} mt-1`}>Hand-written picks from the community &amp; why they recommend them.</p>
          {!signedIn && (
            <p className={`${boxStyles.tinyMuted} mt-1`}>
              <Link href="/login" className={boxStyles.textLink}>Sign in</Link> to add a pick or vote.
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className={`${boxStyles.primaryButton} shrink-0`}
        >
          {showForm ? "Cancel" : "+ Add a Pick"}
        </button>
      </div>

      {msg && !showForm && <p className={`${boxStyles.errorText} mt-3`}>{msg.text}</p>}

      {showForm && (
        <div className={`${boxStyles.subCard} mt-4 grid gap-3 sm:grid-cols-1`}>
          <div className={boxStyles.mutedText}>
            Recommend a <span className="font-bold text-[var(--color-cyan)]">{mediaTitle}</span> alternative to other fans.
          </div>
          <input
            value={toTitle}
            onChange={(e) => setToTitle(e.target.value)}
            placeholder="Recommended title (e.g. A Silent Voice)"
            className={boxStyles.field}
          />
          <input
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            placeholder="Recommended AniList media ID (numbers only)"
            type="number"
            className={boxStyles.field}
          />
          <textarea
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="Why you'll like it (this is the heart of the rec)..."
            maxLength={500}
            rows={3}
            className={boxStyles.field}
          />
          <div className="flex items-center justify-end gap-3">
            <span className={boxStyles.tinyMuted}>{meaning.length}/500</span>
            <button onClick={submit} disabled={busy} className={boxStyles.primaryButton}>
              {busy ? "..." : "Post Recommendation"}
            </button>
          </div>
          {msg && <p className={boxStyles.errorText}>{msg.text}</p>}
        </div>
      )}

      {loading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-[var(--color-panel)] animate-pulse" />
          ))}
        </div>
      ) : recs.length === 0 ? (
        <div className={`${boxStyles.emptyState} mt-4`}>
          No fan picks yet. Be the first to recommend something after{" "}
          <span className="font-bold text-[var(--color-cyan)]">{mediaTitle}</span>!
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {recs.map((r) => (
            <div key={r.id} className={boxStyles.recCard}>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/anime/${r.toMediaId}`} className="min-w-0">
                  <p className="text-sm font-bold text-[var(--color-cyan)] hover:underline truncate">{r.toTitle}</p>
                </Link>
                <span className={`${boxStyles.typeChip} shrink-0`}>
                  {r.fromType === "MANGA" ? "Manga" : "Anime"}
                </span>
              </div>
              <p className={`${boxStyles.quoteText} mt-2`}>“{r.meaning}”</p>
              <div className="mt-3 flex items-center justify-between">
                <span className={boxStyles.tinyMuted}>by {r.authorUsername || "a fan"}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => vote(r.id, 1)}
                    className={`${boxStyles.voteButton} ${votes[r.id] === 1 ? boxStyles.voteButtonActive : ""}`}
                  >
                    ▲ {r.upvotes}
                  </button>
                  <button
                    onClick={() => vote(r.id, -1)}
                    className={`${boxStyles.voteButton} ${votes[r.id] === -1 ? boxStyles.voteButtonActive : ""}`}
                  >
                    ▼ {r.downvotes}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}