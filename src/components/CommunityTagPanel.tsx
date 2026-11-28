"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { logError } from "@/lib/logger";
import styles from "./CommunityTagPanel.module.css";

interface CommunityTag {
  id: string;
  tag: string;
  upvotes: number;
  downvotes: number;
  score: number;
  myVote: number;
}

function TagPill({
  tag,
  onVote,
  disabled,
}: {
  tag: CommunityTag;
  onVote: (vote: number) => void;
  disabled: boolean;
}) {
  const isUp = tag.myVote === 1;
  const isDown = tag.myVote === -1;
  const scoreColor =
    tag.score > 0
      ? "var(--color-cyan)"
      : tag.score < 0
        ? "var(--color-magenta)"
        : "var(--color-mute)";
  const tone = isUp ? styles.pillUp : isDown ? styles.pillDown : "";

  return (
    <div className={`${styles.tagPill} ${tone}`}>
      <button
        onClick={() => onVote(isUp ? 0 : 1)}
        disabled={disabled}
        aria-pressed={isUp}
        title="Upvote"
        className={`${styles.tagVote} ${isUp ? styles.tagVoteUpActive : ""}`}
      >
        ▲ <span className={styles.tagVoteCount}>{tag.upvotes}</span>
      </button>
      <span className={styles.tagName}>#{tag.tag}</span>
      <button
        onClick={() => onVote(isDown ? 0 : -1)}
        disabled={disabled}
        aria-pressed={isDown}
        title="Downvote"
        className={`${styles.tagVote} ${isDown ? styles.tagVoteDownActive : ""}`}
      >
        ▼ <span className={styles.tagVoteCount}>{tag.downvotes}</span>
      </button>
      <span className={styles.tagScore} style={{ color: scoreColor }}>
        {tag.score > 0 ? `+${tag.score}` : tag.score}
      </span>
    </div>
  );
}

export default function CommunityTagPanel({ mediaId }: { mediaId: number }) {
  const { data: session } = useSession();
  const [tags, setTags] = useState<CommunityTag[]>([]);
  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch(`/api/community-tags/${mediaId}`);
      const data = await res.json();
      setTags(data.tags || []);
      setError(null);
    } catch (e) {
      logError(e);
      setError("Couldn't load tags. Try again.");
    } finally {
      setLoading(false);
    }
  }, [mediaId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/community-tags/${mediaId}`);
        const data = await res.json();
        if (cancelled) return;
        setTags(data.tags || []);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        logError(e);
        setError("Couldn't load tags. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  const handleVote = async (communityTagId: string, vote: number) => {
    if (!session?.user?.id || submitting) return;
    try {
      const res = await fetch("/api/community-tags/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityTagId, vote }),
      });
      if (!res.ok) throw new Error("Vote failed");
      await fetchTags();
    } catch (e) {
      logError(e);
      setError("Couldn't register your vote. Try again.");
    }
  };

  const handleCreate = async () => {
    const tag = newTag.trim();
    if (!tag || submitting || !session?.user?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/community-tags/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, tag, vote: 1 }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Couldn't add tag");
      }
      setNewTag("");
      await fetchTags();
    } catch (e) {
      logError(e);
      setError("Couldn't add that tag. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.skeletonRow} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.skeletonPill} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {!session?.user?.id ? (
        <div className={styles.signinBar}>
          <span aria-hidden="true" className={styles.signinIcon}>
            ✦
          </span>
          <span>Sign in to vote on tags and add your own →</span>
          <Link href="/login" className={styles.authLinkCyan}>
            Log in
          </Link>
          <span className={styles.authSlash}>/</span>
          <Link href="/register" className={styles.authLinkMagenta}>
            Register
          </Link>
        </div>
      ) : null}

      {error && <p className={styles.errorBox}>{error}</p>}

      {tags.length === 0 ? (
        <p className={styles.emptyState}>
          No community tags yet — be the first to add one!
        </p>
      ) : (
        <div className={styles.tagList}>
          {tags.map((t) => (
            <TagPill
              key={t.id}
              tag={t}
              onVote={(vote) => handleVote(t.id, vote)}
              disabled={!session?.user?.id || submitting}
            />
          ))}
        </div>
      )}

      <div className={styles.createRow}>
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Add a tag (e.g. masterpiece)…"
          disabled={!session?.user?.id}
          className={styles.tagInput}
        />
        <button
          onClick={handleCreate}
          disabled={!newTag.trim() || submitting || !session?.user?.id}
          className={styles.addButton}
        >
          {submitting ? "…" : "+ Add"}
        </button>
      </div>
    </div>
  );
}
