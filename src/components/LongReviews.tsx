"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { applyUserVotes, fetchViewerState } from "@/lib/client/viewer-state";
import styles from "./reviews.module.css";

interface ReviewUser {
  id: string;
  username: string;
  avatar: string | null;
}

interface LongReviewData {
  id: string;
  userId: string;
  mediaId: number;
  mediaTitle: string;
  mediaImage: string | null;
  title: string;
  content: string;
  rating: number | null;
  upvotes: number;
  userVote: number | null;
  createdAt: string;
  user: ReviewUser;
}

interface Props {
  mediaId: number;
  mediaTitle: string;
  mediaImage: string | null;
}

const SCORE_COLORS: Record<number, string> = {
  10: "#10b981",
  9: "#10b981",
  8: "var(--color-cyan)",
  7: "var(--color-cyan)",
  6: "#f59e0b",
  5: "#f59e0b",
  4: "var(--color-magenta)",
  3: "var(--color-magenta)",
  2: "#ef4444",
  1: "#ef4444",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <h3 key={i} className={styles.longBodyHeading}>{line.slice(4)}</h3>;
    if (line.startsWith("## ")) return <h2 key={i} className={styles.longBodyHeading}>{line.slice(3)}</h2>;
    if (line.startsWith("# ")) return <h1 key={i} className={styles.longBodyHeading}>{line.slice(2)}</h1>;
    if (line.startsWith("- ")) return <li key={i} className={styles.longListItem}>{line.slice(2)}</li>;
    if (line.startsWith("> ")) return <blockquote key={i} className={styles.longBodyQuote}>{line.slice(2)}</blockquote>;
    if (line.trim() === "") return <div key={i} className={styles.longBodySpacer} />;
    return <p key={i} className={styles.longBodyParagraph}>{line}</p>;
  });
}

export default function LongReviews({ mediaId, mediaTitle, mediaImage }: Props) {
  const { data: session, status } = useSession();
  const reduce = useReducedMotion();
  const [reviews, setReviews] = useState<LongReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<"top" | "recent">("top");
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formRating, setFormRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fetchError, setFetchError] = useState("");

  const fetchReviews = useCallback(async (p: number, s: string, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    if (!append) setFetchError("");

    try {
      const res = await fetch(`/api/reviews/long?mediaId=${mediaId}&page=${p}&limit=10&sort=${s}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (!append) setFetchError(d.error || "Failed to load reviews");
        return;
      }
      const data = await res.json();
      const list: LongReviewData[] = data.reviews || [];

      if (status === "authenticated") {
        // The visitor's own review vote is fetched separately, so the review
        // list stays identical for everyone and can come from the CDN.
        const states = await fetchViewerState("reviewVotes", list.map((r) => r.id));
        applyUserVotes(list, states);
      }

      if (append) {
        setReviews((prev) => [...prev, ...list]);
      } else {
        setReviews(list);
      }
      setHasMore(data.pagination?.page < data.pagination?.totalPages);
    } catch {
      if (!append) setFetchError("Failed to load reviews");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [mediaId, status]);

  useEffect(() => {
    if (status === "loading") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    fetchReviews(1, sort, false);
  }, [sort, fetchReviews, status]);

  useEffect(() => {
    if (page > 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchReviews(page, sort, true);
    }
  }, [page, sort, fetchReviews]);

  async function handleVote(reviewId: string, value: 1 | -1) {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`/api/reviews/long/${reviewId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (res.ok) {
        const data = await res.json();
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId
              ? { ...r, upvotes: data.upvotes, userVote: data.userVote }
              : r
          )
        );
      }
    } catch {
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews/long", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId,
          mediaTitle,
          mediaImage,
          title: formTitle,
          content: formContent,
          rating: formRating,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create review");
        return;
      }
      const data = await res.json();
      setReviews((prev) => [data.review, ...prev]);
      setFormTitle("");
      setFormContent("");
      setFormRating(null);
      setShowForm(false);
    } catch {
      setError("Failed to create review");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={`${styles.reviewSection} ${styles.longSection}`}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          Long Reviews ({reviews.length})
        </h2>
        <div className={styles.sectionTools}>
          <div className={styles.sortTabs}>
            {(["top", "recent"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`${styles.sortTab} ${sort === s ? styles.sortTabActive : ""}`}
              >
                {s === "top" ? "Top" : "Recent"}
              </button>
            ))}
          </div>
          {session?.user?.id && (
            <button
              onClick={() => setShowForm(!showForm)}
              className={styles.writeButton}
            >
              Write Review
            </button>
          )}
        </div>
      </div>

      {!session?.user?.id && (
        <p className={styles.signinHint}>
          <a href="/login" className={styles.signinLink}>Sign in</a> to write a long review.
        </p>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className={styles.longForm}
          >
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Review title..."
              required
              minLength={3}
              maxLength={200}
              className={styles.input}
            />
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Write your review... (markdown supported)"
              required
              minLength={10}
              maxLength={5000}
              rows={8}
              className={`${styles.textarea} ${styles.longTextarea}`}
            />
            <div className={styles.formRow}>
              <span className={styles.formLabel}>Rating:</span>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFormRating(formRating === n ? null : n)}
                  className={`${styles.scoreButton} ${formRating === n ? styles.scoreButtonActive : ""}`}
                  style={formRating === n ? { backgroundColor: SCORE_COLORS[n] || "var(--color-magenta)" } : undefined}
                >
                  {n}
                </button>
              ))}
              {formRating && (
                <span className={styles.scoreSuffix}>/10</span>
              )}
            </div>
            {error && <p className={styles.formError}>{error}</p>}
            <div className={styles.formActions}>
              <button
                type="submit"
                disabled={submitting}
                className={styles.submitButton}
              >
                {submitting ? "Publishing..." : "Publish Review"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {fetchError && (
        <div className={styles.fetchError}>
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className={styles.skeletonList}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
              <div className={`${styles.skeletonLine} ${styles.skeletonText}`} />
              <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.reviewList}>
          {reviews.map((review) => (
            <motion.div
              key={review.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={styles.longCard}
            >
              <div className={styles.longHead}>
                <div className={styles.longHeadMain}>
                  <Link
                    href={`/reviews/${review.id}`}
                    className={styles.longTitle}
                  >
                    {review.title}
                  </Link>
                  <div className={styles.longMeta}>
                    <Link
                      href={`/profile/${review.user.id}`}
                      className={styles.profileLink}
                    >
                      {review.user.avatar ? (
                        <span className={styles.avatar}>
                          <Image src={review.user.avatar} alt="" fill sizes="16px" className={styles.avatarImage} />
                        </span>
                      ) : (
                        <span className={styles.avatarFallback} />
                      )}
                      <span className={styles.metaText}>{review.user.username}</span>
                    </Link>
                    <span className={styles.metaText}>·</span>
                    <span className={styles.metaText}>{formatDate(review.createdAt)}</span>
                  </div>
                </div>
                {review.rating != null && (
                  <div
                    className={styles.scoreBadge}
                    style={{ backgroundColor: SCORE_COLORS[review.rating] || "var(--color-magenta)" }}
                  >
                    {review.rating}
                  </div>
                )}
              </div>

              <div className={styles.longBody}>
                {renderMarkdown(review.content)}
              </div>

              <div className={styles.voteRow}>
                <div className={styles.voteGroup}>
                  <button
                    onClick={() => handleVote(review.id, 1)}
                    disabled={!session?.user?.id}
                    className={`${styles.voteButton} ${review.userVote === 1 ? styles.voteButtonUp : ""}`}
                  >
                    <svg className="w-4 h-4" fill={review.userVote === 1 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <span className={styles.voteCount}>
                    {review.upvotes}
                  </span>
                  <button
                    onClick={() => handleVote(review.id, -1)}
                    disabled={!session?.user?.id}
                    className={`${styles.voteButton} ${review.userVote === -1 ? styles.voteButtonDown : ""}`}
                  >
                    <svg className="w-4 h-4" fill={review.userVote === -1 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <Link
                  href={`/reviews/${review.id}`}
                  className={styles.fullReviewLink}
                >
                  Read full review →
                </Link>
              </div>
            </motion.div>
          ))}

          {reviews.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyGlyph} aria-hidden="true" />
              <p className={styles.emptyText}>No long reviews yet. Be the first to write one!</p>
            </div>
          )}

          {hasMore && (
            <div className={styles.loadMoreWrap}>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loadingMore}
                className={styles.loadMoreButton}
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
