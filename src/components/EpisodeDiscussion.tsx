"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { logError } from "@/lib/logger";
import boxStyles from "./detailBoxes.module.css";

interface CommentUser {
  id: string;
  username: string;
  avatar: string | null;
}

interface EpisodeComment {
  id: string;
  content: string;
  createdAt: string;
  user: CommentUser;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function EpisodeDiscussion({ mediaId, className = "" }: { mediaId: number; className?: string }) {
  const { data: session } = useSession();
  const [episode, setEpisode] = useState(1);
  const [comments, setComments] = useState<EpisodeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (ep: number) => {
    try {
      const res = await fetch(`/api/anime/${mediaId}/episode-discussions?episode=${ep}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setComments(data.comments || []);
      setError(null);
    } catch (e) {
      logError(e);
      setError("Could not load discussions.");
    }
  }, [mediaId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      await load(episode);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [episode, load]);

  async function submit() {
    if (!draft.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/anime/${mediaId}/episode-discussions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode, content: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to post");
      }
      setDraft("");
      load(episode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to post";
      setError(msg);
      logError(e);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className={className}>
      <div className={`${boxStyles.sectionHead} flex-wrap`}>
        <h3 className={`font-display text-sm font-bold flex items-center gap-2 ${boxStyles.boxTitle}`}>
          <span className={boxStyles.headingMark} />
          Episode Discussion
        </h3>
        <div className={boxStyles.epNav}>
          <button
            onClick={() => setEpisode((e) => Math.max(1, e - 1))}
            disabled={episode <= 1}
            className={boxStyles.iconButton}
          >
            ←
          </button>
          <div className="flex items-center gap-1">
            <span className={boxStyles.eyebrow}>Ep</span>
            <input
              type="number"
              min={1}
              value={episode}
              onChange={(e) => setEpisode(Math.max(1, Number(e.target.value) || 1))}
              className={boxStyles.epInput}
            />
          </div>
          <button
            onClick={() => setEpisode((e) => e + 1)}
            className={boxStyles.iconButton}
          >
            →
          </button>
        </div>
      </div>

      {session?.user ? (
        <div className="mb-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Share your thoughts on episode ${episode}...`}
            rows={3}
            maxLength={2000}
            className={`${boxStyles.field} min-h-[4.5rem] resize-none`}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className={boxStyles.tinyMuted}>{draft.length}/2000</span>
            <button
              onClick={submit}
              disabled={posting || !draft.trim()}
              className={boxStyles.primaryButton}
            >
              {posting ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </div>
      ) : (
        <div className={`${boxStyles.noteCard} ${boxStyles.mutedText} mb-4`}>
          <Link href="/login" className={boxStyles.textLink}>Sign in</Link> to join the
          discussion.
        </div>
      )}

      {error && <div className={`${boxStyles.errorText} mb-3`}>{error}</div>}

      {loading ? (
        <div className={`${boxStyles.emptyState} text-center`}>Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className={`${boxStyles.emptyState} text-center`}>
          No one has discussed episode {episode} yet. Be the first!
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className={boxStyles.commentCard}>
              <div className="flex items-center gap-2">
                {c.user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.user.avatar} alt={c.user.username} className={boxStyles.commentAvatar} />
                ) : (
                  <div className={boxStyles.commentFallback}>
                    {c.user.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <Link href={`/profile?u=${c.user.username}`} className="text-xs font-semibold text-white hover:text-[var(--color-magenta)] transition-colors">
                  {c.user.username}
                </Link>
                <span className={boxStyles.tinyMuted}>{timeAgo(c.createdAt)}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-[var(--color-mute)]">
                {c.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
