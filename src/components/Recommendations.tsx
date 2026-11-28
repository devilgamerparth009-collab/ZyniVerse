"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchJson } from "@/lib/safe-json";
import styles from "./Recommendations.module.css";

export interface Recommendation {
  id: number;
  title: string;
  score: number;
  reason: string;
  image: string;
  format: string;
  episodes: number;
  genres: string[];
  matchTags: string[];
}

interface Props {
  type?: "trending" | "similar" | "personalized" | "genre";
  title?: string;
  anilistId?: number;
  genres?: string[];
  exclude?: number[];
}

function scoreTone(score: number): "high" | "mid" | "low" | "weak" {
  if (score >= 80) return "high";
  if (score >= 60) return "mid";
  if (score >= 40) return "low";
  return "weak";
}

export default function Recommendations({
  type = "trending",
  title = "Recommended for You",
  anilistId,
  genres,
  exclude,
}: Props) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const genresKey = genres?.join(",") ?? "";
  const excludeKey = exclude?.join(",") ?? "";

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ type });
    if (anilistId) params.set("id", String(anilistId));
    if (genresKey) params.set("genre", genresKey);
    if (excludeKey) params.set("exclude", excludeKey);

    fetchJson<{ recommendations?: Recommendation[] }>(`/api/recommendations?${params.toString()}`)
      .then((data) => {
        if (!cancelled) {
          setRecs(Array.isArray(data?.recommendations) ? data.recommendations : []);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error && e.message ? e.message : "Failed to fetch recommendations");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [type, anilistId, genresKey, excludeKey, retryKey]);

  const retry = () => setRetryKey((k) => k + 1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [recs]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    el.scrollBy({ left: dir === "left" ? -el.clientWidth * 0.65 : el.clientWidth * 0.65, behavior });
  };

  if (loading) {
    return (
      <section className={styles.section} aria-busy="true">
        <div className={styles.hpkPanel}>
          <span className={styles.aurora} aria-hidden />
          <div className={styles.inner}>
            <header className={styles.head}>
              <div className={styles.headCopy}>
                <h2 className={styles.headTitle}>{title}</h2>
              </div>
            </header>
            <div className={styles.skeletonRail} aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.skeletonCard}>
                  <div className={styles.skeletonPoster} />
                  <div className={styles.skeletonLine} />
                  <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.section}>
        <div className={styles.hpkPanel}>
          <span className={styles.aurora} aria-hidden />
          <div className={styles.inner}>
            <div className={styles.errorPanel}>
              <p className={styles.errorTitle}>Failed to load recommendations</p>
              <p className={styles.errorDetail}>{error}</p>
              <button type="button" onClick={retry} className={styles.retry}>
                Try again
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (recs.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.hpkPanel}>
        <span className={styles.aurora} aria-hidden />
        <span className={styles.spark} aria-hidden />
        <span className={`${styles.spark} ${styles.sparkAlt}`} aria-hidden />
        <div className={styles.inner}>
          <header className={styles.head}>
            <div className={styles.headCopy}>
              <h2 className={styles.headTitle}>{title}</h2>
            </div>
            <div className={styles.controls}>
              <button
                type="button"
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                aria-label="Scroll recommendations left"
                className={styles.control}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                aria-label="Scroll recommendations right"
                className={styles.control}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </header>

          <div className={styles.viewport}>
            <div ref={scrollRef} className={styles.rail}>
              {recs.map((rec, idx) => (
                <Link
                  key={rec.id}
                  href={`/anime/${rec.id}`}
                  className={styles.card}
                  style={{ "--card-index": idx } as CSSProperties}
                >
                  <div className={styles.poster}>
                    <span className={styles.pick} aria-hidden>
                      PICK {String(idx + 1).padStart(2, "0")}
                    </span>
                    <Image
                      src={rec.image}
                      alt={rec.title}
                      fill
                      className={styles.image}
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 190px"
                    />
                    <span className={styles.score} data-tone={scoreTone(rec.score)} aria-label={`Match score ${rec.score}`}>
                      {rec.score}
                    </span>
                    <div className={styles.overlay}>
                      <div className={styles.overlayMeta}>
                        {rec.format ? <span className={styles.metaChip}>{rec.format}</span> : null}
                        {rec.episodes ? <span className={styles.metaChip}>{rec.episodes} ep</span> : null}
                      </div>
                      <span className={styles.cta}>
                        View
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </span>
                    </div>
                    <span className={styles.sheen} aria-hidden />
                  </div>

                  <div className={styles.info}>
                    <h3 className={styles.title}>{rec.title}</h3>
                    <p className={styles.reason}>{rec.reason}</p>
                    <div className={styles.tags}>
                      {rec.genres.slice(0, 2).map((g) => (
                        <span key={g} className={styles.tag}>
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
