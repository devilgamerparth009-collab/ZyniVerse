"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface HistoryItem {
  chapter: number;
  title: string | null;
  readAt: string;
  entry: {
    mediaId: number;
    title: string;
    coverImage: string | null;
    subType: string;
    mangaDexId: string | null;
  };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function MangaReadingHistory({ mediaId }: { mediaId: number }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/manga/history?limit=15")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setHistory((d.history || []) as HistoryItem[]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;

  return (
    <div className="mdt-card mdt-history">
      <div className="mdt-card-head">
        <h3 className="font-display text-sm font-bold">
          <span className="mdt-history-mark" aria-hidden />
          Reading History
        </h3>
        <span className="mdt-card-badge">{history.length} saved</span>
      </div>
      {history.length === 0 ? (
        <div className="mdt-history-empty">
          <span className="mdt-history-empty-track" aria-hidden>
            <span className="mdt-history-empty-dot" />
            <span className="mdt-history-empty-dot" />
            <span className="mdt-history-empty-dot" />
          </span>
          <p>No chapters read yet. Track your reading to build a history.</p>
        </div>
      ) : (
        <ol className="mdt-history-list">
          {history.map((h) => {
            const readerHref = h.entry.mangaDexId
              ? `/manga/read/${h.entry.mangaDexId}?mediaId=${h.entry.mediaId}&chapter=${h.chapter}&title=${encodeURIComponent(h.entry.title)}`
              : null;
            const href = readerHref || `/manga/${h.entry.mediaId}`;
            return (
            <li key={`${h.entry.mediaId}-${h.chapter}`}>
              <Link
                href={href}
                className={`mdt-history-row ${h.entry.mediaId === mediaId ? "is-current" : ""}`}
              >
                <span className="mdt-history-cover">
                  {h.entry.coverImage && (
                    <Image src={h.entry.coverImage} alt="" fill className="mdt-history-img" sizes="32px" unoptimized />
                  )}
                </span>
                <span className="mdt-history-body">
                  <span className="mdt-history-title">{h.entry.title}</span>
                  <span className="mdt-history-meta">
                    {h.entry.subType === "manga" ? "Manga" : h.entry.subType.replace("_", " ")} • Ch. {h.chapter}
                    {h.title ? ` — ${h.title}` : ""}
                  </span>
                </span>
                <span className="mdt-history-time">{timeAgo(h.readAt)}</span>
              </Link>
            </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
