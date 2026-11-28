"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import type { CartoonEntry } from "@/lib/toons-data";
import styles from "./toons.module.css";

const FALLBACK_COLORS: Record<string, [string, string]> = {
  India: ["#ff6b35", "#1a1a2e"],
  Japan: ["#e50914", "#1a1a2e"],
  France: ["#7b2ff7", "#1a1a2e"],
  USA: ["#00b4d8", "#1a1a2e"],
};

function initials(title: string) {
  return title
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

interface ToonArtworkProps {
  toon: CartoonEntry;
  sizes: string;
  priority?: boolean;
  className?: string;
}

/** Shared cover/fallback renderer so browse and detail never show a broken image. */
export default function ToonArtwork({
  toon,
  sizes,
  priority = false,
  className = "",
}: ToonArtworkProps) {
  const [failed, setFailed] = useState(false);
  const [start, end] = FALLBACK_COLORS[toon.country] ?? FALLBACK_COLORS.USA;
  const showImage = Boolean(toon.image) && !failed;

  return (
    <div
      className={`${styles.artFrame} ${className}`}
      style={
        {
          "--fallback-a": start,
          "--fallback-b": end,
        } as CSSProperties
      }
    >
      {showImage ? (
        <Image
          src={toon.image}
          alt={toon.displayTitle}
          fill
          sizes={sizes}
          referrerPolicy="no-referrer"
          className={`${styles.artImage} object-cover`}
          onError={() => setFailed(true)}
          {...(priority ? { priority: true } : { loading: "lazy" as const })}
        />
      ) : (
        <div className={styles.fallback} role="img" aria-label={`${toon.displayTitle} artwork placeholder`}>
          <div className={styles.fallbackMark}>
            <span className={styles.fallbackInitials}>{initials(toon.displayTitle)}</span>
            <span className={styles.fallbackLabel}>{toon.network}</span>
          </div>
        </div>
      )}
      <span className={styles.artSheen} aria-hidden="true" />
    </div>
  );
}
