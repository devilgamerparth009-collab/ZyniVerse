"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface RecEntry {
  id?: number;
  malId?: number;
  title: string;
  image?: string;
  url?: string;
  reason: string;
  allReasons: string[];
  href?: string;
}

interface Props {
  mediaId: number;
  type?: "ANIME" | "MANGA";
  malId?: number;
  fallback?: RecEntry[];
  className?: string;
}

export default function RecRelationships({
  mediaId,
  type = "ANIME",
  malId,
  fallback = [],
  className = "",
}: Props) {
  const [recs, setRecs] = useState<RecEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ type });
    if (type === "MANGA" && malId) params.set("malId", String(malId));

    fetch(`/api/recs/${mediaId}?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setRecs(d.recs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mediaId, type, malId]);

  if (loading) {
    return <div className="mdt-rec-skeleton mdt-card animate-pulse" />;
  }

  const list = recs.length > 0 ? recs : fallback;
  if (list.length === 0) return null;

  return (
    <div className={`mdt-card mdt-rec${className ? ` ${className}` : ""}`}>
      <div className="mdt-card-head">
        <h3 className="font-display text-sm font-bold">Why You Might Like These</h3>
        <span className="mdt-card-badge">
          {recs.length > 0 ? "MAL community" : "AniList community"}
        </span>
      </div>
      <div className="mdt-rec-grid">
        {list.slice(0, 6).map((rec, i) => {
          const href =
            rec.href ||
            (type === "MANGA"
              ? rec.url || `https://myanimelist.net/manga/${rec.malId || ""}`
              : `/anime/${rec.malId || rec.id || ""}`);
          const external = /^https?:\/\//.test(href);
          const body = (
            <>
              {rec.image ? (
                <Image
                  src={rec.image}
                  alt={rec.title}
                  width={className ? 64 : 40}
                  height={className ? 90 : 56}
                  className="mdt-rec-img"
                  loading="lazy"
                />
              ) : (
                <span className="mdt-rec-fallback" aria-hidden>#{rec.malId || rec.id}</span>
              )}
              <span className="mdt-rec-body">
                <span className="mdt-rec-title">{rec.title}</span>
                <span className="mdt-rec-reason">{rec.reason}</span>
                {rec.allReasons.length > 1 ? (
                  <span className="mdt-rec-also">
                    Also: {rec.allReasons.slice(1).join(", ")}
                  </span>
                ) : null}
              </span>
              <span className="mdt-rec-arrow" aria-hidden>↗</span>
            </>
          );

          return external ? (
            <a key={`${href}-${i}`} href={href} target="_blank" rel="noopener noreferrer" className="mdt-rec-row">
              {body}
            </a>
          ) : (
            <Link key={href} href={href} className="mdt-rec-row">
              {body}
            </Link>
          );
        })}
      </div>
      <p className="mdt-rec-note">Real public recommendations · no invented scores</p>
    </div>
  );
}
