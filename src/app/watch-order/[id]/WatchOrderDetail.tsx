"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type CSSProperties } from "react";
import styles from "../watch-order-detail.module.css";

interface Entry {
  title: string;
  info: string;
  anilistId?: number;
}

interface Props {
  slug: string;
  methods: string[];
  entries: Record<string, Entry[]>;
  tip?: string;
}

// Entries carry display strings like "24 episodes (2011)". Splitting them
// locally keeps the cards informative without any extra AniList calls.
function splitInfo(info: string) {
  const year = info.match(/\((\d{4})\)/)?.[1] ?? null;
  const countMatch = info.match(/\b(\d+)\s+(episodes|shorts|eps)\b/i);
  const count = countMatch
    ? `${countMatch[1]} ${countMatch[2].toUpperCase()}`
    : null;
  const detail =
    info
      .replace(/\s*\(\d{4}\)\s*/g, " ")
      .replace(/\b\d+\s+(episodes|shorts|eps)\b/i, " ")
      .replace(/^\s*[—–-]\s*/, "")
      .replace(/\s{2,}/g, " ")
      .trim() || null;

  return { year, count, detail };
}

export default function WatchOrderDetail({ methods, entries, tip }: Props) {
  const [activeMethod, setActiveMethod] = useState(methods[0] || "Release Order");
  const currentEntries = entries[activeMethod] || [];

  return (
    <>
      {/* Method Tabs */}
      {methods.length > 1 && (
        <div className={styles.tabs}>
          {methods.map((m) => (
            <button
              key={m}
              onClick={() => setActiveMethod(m)}
              className={`${styles.tab} ${activeMethod === m ? styles.tabActive : ""}`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className={styles.timeline}>
        {currentEntries.map((entry, i) => {
          const isLast = i === currentEntries.length - 1;
          const info = entry.info.toLowerCase();
          const isMovie = info.includes("movie");
          const isOVA = info.includes("ova") || info.includes("special");
          const isSpinoff = info.includes("spinoff") || info.includes("comedy");

          let accentColor = "var(--color-cyan)";
          let tagLabel = "";
          if (isMovie) {
            accentColor = "var(--color-magenta)";
            tagLabel = "Movie";
          } else if (isOVA) {
            accentColor = "var(--color-violet)";
            tagLabel = entry.info.match(/OVA|Special/i)?.[0] || "OVA";
          } else if (isSpinoff) {
            accentColor = "var(--color-amber)";
            tagLabel = "Spinoff";
          }

          if (!tagLabel) tagLabel = "TV Series";

          const { year, count, detail } = splitInfo(entry.info);
          const meta = [
            count,
            detail && detail.toLowerCase() !== tagLabel.toLowerCase() ? detail : null,
            year,
          ].filter((value): value is string => Boolean(value));

          const stepVars = {
            "--step-accent": accentColor,
            "--step-index": i,
          } as CSSProperties;
          const entryNumber = String(i + 1).padStart(2, "0");

          return (
            <div key={`${activeMethod}-${i}`} className={styles.step} style={stepVars}>
              <div className={styles.nodeWrap}>
                <div className={styles.node}>{entryNumber}</div>
                {!isLast && <div className={styles.rail} />}
              </div>

              <div className={styles.card}>
                {/* AniList image endpoint serves 1200x630 banners, so each
                    entry gets a full-width landscape frame instead of a
                    cropped portrait poster. No extra API calls needed. */}
                <div className={styles.cardMedia}>
                  {entry.anilistId && (
                    <Image
                      src={`https://img.anili.st/media/${entry.anilistId}`}
                      alt={entry.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 640px"
                      className="object-cover"
                      loading="lazy"
                    />
                  )}
                  <span className={styles.mediaBadge}>ENTRY {entryNumber}</span>
                  {tagLabel && <span className={styles.mediaTag}>{tagLabel}</span>}
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.body}>
                    <div className={styles.cardTop}>
                      <span className={styles.kicker}>STEP {i + 1} OF {currentEntries.length}</span>
                    </div>

                    <h4 className={styles.stepTitle}>{entry.title}</h4>

                    <div className={styles.metaRow}>
                      {meta.map((value) => (
                        <span key={value} className={styles.meta}>{value}</span>
                      ))}
                    </div>

                    {entry.anilistId && (
                      <Link href={`/anime/${entry.anilistId}`} className={styles.action}>
                        View Details
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pro Tip */}
      {tip && (
        <div className={styles.tip}>
          <div className={styles.tipInner}>
            <div className={styles.tipIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan)" strokeWidth="2">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.5 4.5-3 6-1 1-2 2.5-2 4h-4c0-1.5-1-3-2-4-1.5-1.5-3-3.5-3-6a7 7 0 0 1 7-7z" />
                <path d="M9 21h6" />
                <path d="M9 18h6" />
              </svg>
            </div>
            <div>
              <p className={styles.tipTitle}>Pro Tip</p>
              <p className={styles.tipText}>{tip}</p>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ backgroundColor: "var(--color-cyan)" }} /> TV Series
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ backgroundColor: "var(--color-magenta)" }} /> Movie
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ backgroundColor: "var(--color-violet)" }} /> OVA / Special
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ backgroundColor: "var(--color-amber)" }} /> Spinoff
        </span>
      </div>
    </>
  );
}
