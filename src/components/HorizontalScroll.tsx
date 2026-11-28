"use client";

import { useRef, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { bestTitle } from "@/lib/anilist";
import styles from "./HorizontalScroll.module.css";

const RANK_COLORS = ["#ffd166", "#d8e0ea", "#e6a06a"];
const CARD_WIDTH = 200;

interface RailItem {
  id: number;
  type?: string;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    medium?: string | null;
    color?: string | null;
  } | null;
  title: { english?: string | null; romaji?: string | null; native?: string | null };
  averageScore?: number | null;
  episodes?: number | null;
  chapters?: number | null;
}

function coverOf(item: RailItem) {
  return (
    item.coverImage?.extraLarge ||
    item.coverImage?.large ||
    item.coverImage?.medium ||
    ""
  );
}

function metaOf(item: RailItem) {
  if (item.episodes) return `${item.episodes} ep`;
  if (item.chapters) return `${item.chapters} ch`;
  return null;
}

export default function HorizontalScroll({
  items,
  title = "Trending Now",
  eyebrow,
  viewAllHref,
  subtitle,
  autoPlaySpeed,
}: {
  items: RailItem[];
  title?: string;
  eyebrow?: string;
  viewAllHref?: string;
  subtitle?: string;
  autoPlaySpeed?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useReducedMotion() ?? false;

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
  }, []);

  useEffect(() => {
    return () => { if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current); };
  }, []);

  useEffect(() => {
    if (reduce || isPaused || items.length === 0 || autoPlaySpeed === 0) return;
    intervalRef.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const step = CARD_WIDTH + 16;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: step, behavior: "smooth" });
      }
    }, autoPlaySpeed ?? 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused, items.length, autoPlaySpeed, reduce]);

  const pauseTemporarily = () => {
    setIsPaused(true);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 8000);
  };

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    pauseTemporarily();
    el.scrollBy({
      left: dir === "left" ? -el.clientWidth * 0.75 : el.clientWidth * 0.75,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  if (items.length === 0) return null;

  return (
    <section className={styles.section} aria-label={title}>
      <span className={styles.glowA} aria-hidden />
      <span className={styles.glowB} aria-hidden />

      <div className={styles.head}>
        <div className={styles.headText}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} className={styles.viewAll}>
            View all <span aria-hidden className={styles.viewAllArrow}>→</span>
          </Link>
        )}
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={pauseTemporarily}
          onFocusCapture={() => setIsPaused(true)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsPaused(false);
          }}
          className={`snap-x snap-proximity ${styles.rail}`}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item, i) => {
            const cover = coverOf(item);
            const meta = metaOf(item);
            return (
              <Link
                key={item.id}
                href={item.type === "MANGA" ? `/manga/${item.id}` : `/anime/${item.id}`}
                className={styles.card}
                style={
                  {
                    width: CARD_WIDTH,
                    "--card-accent": item.coverImage?.color || "#ff2d78",
                    "--rank-color": RANK_COLORS[i] || item.coverImage?.color || "#ff2d78",
                    "--card-index": i,
                  } as CSSProperties
                }
              >
                <div className={styles.poster}>
                  <span className={`${styles.rank} ${i < 3 ? styles.rankTop : ""}`}>
                    #{String(i + 1).padStart(2, "0")}
                  </span>
                  {cover && (
                    <Image
                      src={cover}
                      alt={bestTitle(item.title)}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  )}
                  <span className={styles.flame} aria-hidden>🔥</span>
                  <div className={styles.overlay}>
                    <p className={styles.cardTitle}>{bestTitle(item.title)}</p>
                    {(item.averageScore || meta) && (
                      <div className={styles.meta}>
                        {item.averageScore ? (
                          <span className={`${styles.metaPill} ${styles.score}`}>
                            ★ {(item.averageScore / 10).toFixed(1)}
                          </span>
                        ) : null}
                        {meta ? <span className={styles.metaPill}>{meta}</span> : null}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {canScrollLeft && (
          <button onClick={() => scroll("left")} aria-label="Previous items"
            className={`absolute left-1 top-[calc(50%-20px)] z-20 hidden sm:grid ${styles.nav}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        )}
        {canScrollRight && (
          <button onClick={() => scroll("right")} aria-label="Next items"
            className={`absolute right-1 top-[calc(50%-20px)] z-20 hidden sm:grid ${styles.nav}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}
      </div>
    </section>
  );
}
