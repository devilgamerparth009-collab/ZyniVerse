"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useSession } from "next-auth/react";
import type { DoujinshiEntry } from "@/lib/mangadex-api";

interface Props {
  entry: DoujinshiEntry;
  onTrack?: (id: string, status: string) => void;
  trackedStatus?: string | null;
  index?: number;
}

const GRADIENT_PAIRS = [
  ["#7c3aed", "#2563eb"],
  ["#db2777", "#7c3aed"],
  ["#0891b2", "#059669"],
  ["#9333ea", "#c026d3"],
  ["#2563eb", "#0891b2"],
  ["#a21caf", "#e11d48"],
  ["#0d9488", "#0369a1"],
  ["#6366f1", "#a855f7"],
];

function CoverPlaceholder({ entry }: { entry: DoujinshiEntry }) {
  const index = entry.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const [c1, c2] = GRADIENT_PAIRS[index % GRADIENT_PAIRS.length];
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-5 text-center"
      style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}
    >
      <div className="rounded-full bg-white/10 p-3 backdrop-blur-sm">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="opacity-80">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V4.5A2.5 2.5 0 016.5 2H20v15H6.5A2.5 2.5 0 004 19.5z" />
        </svg>
      </div>
      <div>
        <p className="text-xs font-bold text-white leading-tight line-clamp-3 drop-shadow-lg">{entry.title}</p>
        {entry.circle && <p className="mt-1 text-[10px] text-white/70">{entry.circle}</p>}
      </div>
      <span className="rounded-full border border-white/20 px-3 py-0.5 text-[9px] font-mono text-white/60">
        Read Online
      </span>
    </div>
  );
}

export default function DoujinshiCard({ entry, onTrack, trackedStatus, index = 0 }: Props) {
  const { data: session } = useSession();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const px = (e.clientX - cx) / (rect.width / 2);
    const py = (e.clientY - cy) / (rect.height / 2);
    el.style.transform = `perspective(800px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg) scale(1.02)`;
    const spot = spotRef.current;
    if (spot) {
      spot.style.background = `radial-gradient(300px circle at ${e.clientX - rect.left}px ${e.clientY - rect.top}px, rgba(255,0,255,0.22), transparent 65%)`;
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)";
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={reduce ? undefined : { duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={reduce ? undefined : handlePointerMove}
      onPointerLeave={reduce ? undefined : handlePointerLeave}
      className="djcard-wrap group h-full"
      style={{ transition: "transform 0.2s ease-out" }}
    >
      <div className="djcard-shell">
        <span className="djcard-aura" aria-hidden="true" />
        <div ref={spotRef} className="djcard-spot" aria-hidden="true" />

        {/* Cover */}
        <div className="djcard-cover">
          {entry.image && !imageFailed ? (
            <Image
              src={entry.image}
              alt={entry.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 20vw"
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <CoverPlaceholder entry={entry} />
          )}
          <span className="djcard-cover-shade" aria-hidden="true" />
          <span className="djcard-cover-line" aria-hidden="true" />
        </div>

        <div className="djcard-body">
          {/* Title */}
          <Link href={`/doujinshi/${entry.id}`} className="djcard-title-link">
            <h3 className="djcard-title">{entry.title}</h3>
            <span className="djcard-title-rule" aria-hidden="true" />
          </Link>

          {/* Circle & Artist */}
          <div className="djcard-meta">
            {entry.circle && (
              <span className="djcard-meta-pill">
                <span className="djcard-meta-dot" aria-hidden="true" />
                {entry.circle}
              </span>
            )}
            {entry.artist && (
              <span className="djcard-meta-pill">
                <span className="djcard-meta-dot" aria-hidden="true" />
                {entry.artist}
              </span>
            )}
          </div>

          {/* Parody & Language badges */}
          <div className="djcard-badges">
            {entry.parody && entry.parody !== "Original" && (
              <span className="djcard-badge djcard-badge-parody">{entry.parody}</span>
            )}
            <span className="djcard-badge djcard-badge-lang">{entry.language}</span>
            {entry.isTranslated && (
              <span className="djcard-badge djcard-badge-translated">Translated</span>
            )}
          </div>

          {/* Tags */}
          <div className="djcard-tags">
            {entry.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="djcard-tag">#{tag}</span>
            ))}
          </div>

          {/* Pages & External link */}
          <div className="djcard-foot">
            {entry.pages ? (
              <span className="djcard-pages">{entry.pages} pages</span>
            ) : (
              <span />
            )}

            <div className="djcard-actions">
              {/* Read Online button */}
              {entry.externalUrl && (
                <a
                  href={entry.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="djcard-read"
                >
                  <span>Read ↗</span>
                </a>
              )}

              {/* Track button (signed in) / sign-in prompt (anonymous) */}
              {onTrack &&
                (session ? (
                  <button
                    onClick={() => onTrack(entry.id, trackedStatus ? "" : "favorite")}
                    aria-pressed={Boolean(trackedStatus)}
                    className="djcard-track"
                  >
                    {trackedStatus ? "Tracked" : "Track"}
                  </button>
                ) : (
                  <Link
                    href={`/login?next=${encodeURIComponent(`/doujinshi/${entry.id}`)}`}
                    className="djcard-signin"
                  >
                    Sign in
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
