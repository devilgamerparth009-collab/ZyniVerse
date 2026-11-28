"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { logError } from "@/lib/logger";
import styles from "./reviews.module.css";

interface Review {
  id: string;
  userId: string;
  mediaId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { username: string };
}

export default function ReviewsSection({ mediaId }: { mediaId: number }) {
  const { data: session } = useSession();
  const reduce = useReducedMotion();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/reviews?mediaId=${mediaId}`)
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mediaId]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, rating, comment }),
      });
      if (res.ok) {
        setComment("");
        const updated = await fetch(`/api/reviews?mediaId=${mediaId}`).then((r) => r.json());
        setReviews(updated.reviews || []);
      }
    } catch (e) { logError(e); }
    setSubmitting(false);
  }

  if (loading) return null;

  return (
    <section className={styles.reviewSection}>
      <h2 className={styles.sectionTitle}>
        Reviews ({reviews.length})
      </h2>

      {/* Review Form */}
      {session ? (
        <form onSubmit={submitReview} className={styles.reviewForm}>
          <div className={styles.formRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`${styles.scoreButton} ${n <= rating ? styles.scoreButtonActive : ""}`}
              >
                {n}
              </button>
            ))}
            <span className={styles.scoreSuffix}>/10</span>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={styles.textarea}
            rows={2}
            placeholder="Write a review (optional)"
          />
          <div className={styles.formActions}>
            <button type="submit" disabled={submitting} className={styles.submitButton}>
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.signinHint}>
          <a href="/login" className={styles.signinLink}>Sign in</a> to leave a review.
        </p>
      )}

      {/* Reviews List */}
      <div className={styles.reviewList}>
        <AnimatePresence>
          {reviews.map((r) => (
            <motion.div
              key={r.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={styles.reviewCard}
            >
              <div className={styles.reviewHead}>
                <span className={styles.reviewUser}>{r.user.username}</span>
                <span className={styles.reviewScore}>{r.rating}/10</span>
              </div>
              {r.comment && <p className={styles.reviewComment}>{r.comment}</p>}
              <p className={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString()}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        {reviews.length === 0 && (
          <div className={styles.emptyState}>
            <span className={styles.emptyGlyph} aria-hidden="true" />
            <p className={styles.emptyText}>No reviews yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}
