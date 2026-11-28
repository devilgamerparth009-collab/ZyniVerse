"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { VoiceLine } from "@/lib/voice-lines";
import styles from "./QuoteOfTheDay.module.css";

export default function QuoteOfTheDay() {
  const [line, setLine] = useState<VoiceLine | null>(null);

  useEffect(() => {
    fetch("/api/voice-lines/daily")
      .then((r) => r.json())
      .then((d) => setLine(d.line))
      .catch(() => {});
  }, []);

  if (!line) {
    return (
      <section className={styles.section}>
        <div className={styles.skeleton}>
          <div className={`h-3 w-32 ${styles.skeletonBar}`} />
          <div className={`mt-4 h-6 w-3/4 ${styles.skeletonBar}`} />
          <div className={`mt-4 h-4 w-40 ${styles.skeletonBar}`} />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <article className={styles.card}>
        <span className={styles.topLine} aria-hidden />
        <span className={`${styles.spark} ${styles.sparkA}`} aria-hidden />
        <span className={`${styles.spark} ${styles.sparkB}`} aria-hidden />
        <p className={styles.eyebrow}>Quote of the Day</p>
        <Link href={`/voice-lines/${line.id}`} className={styles.quoteLink}>
          <p className={styles.quote}>{line.line}</p>
        </Link>
        <div className={styles.attribution}>
          <span className={styles.character}>{line.character}</span>
          <span className={styles.dot} aria-hidden />
          <span className={styles.anime}>{line.animeTitle}</span>
        </div>
        <div className={styles.linkRow}>
          <Link href="/voice-lines" className={styles.linkPill}>
            View all quotes <span aria-hidden className={styles.arrow}>→</span>
          </Link>
        </div>
      </article>
    </section>
  );
}
