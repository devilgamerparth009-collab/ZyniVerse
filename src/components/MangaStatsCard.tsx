"use client";

import { useEffect, useState, type CSSProperties } from "react";

interface MangaStats {
  mangadex: {
    average: number;
    bayesian: number;
    follows: number;
  } | null;
  mal: {
    magazine: string;
    publisher: string;
    serialization: string;
  } | null;
}

interface Props {
  mediaId: number;
  malId?: number | null;
  dexId?: string | null;
  title?: string;
}

function formatCount(value?: number | null) {
  return value && value > 0 ? value.toLocaleString("en-US") : "—";
}

export default function MangaStatsCard({ mediaId, malId, dexId, title }: Props) {
  const [data, setData] = useState<MangaStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dexId) params.set("dexId", dexId);
    if (malId) params.set("malId", String(malId));
    if (title) params.set("title", title);
    const query = params.toString();

    fetch(`/api/manga/${mediaId}/chapter-ratings${query ? `?${query}` : ""}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d: MangaStats) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
  }, [mediaId, malId, dexId, title]);

  if (loading) {
    return (
      <div className="mdt-card mdt-stats-card">
        <div className="mdt-skeleton animate-pulse space-y-3">
          <div className="h-4 w-1/2 rounded bg-[var(--color-line)]" />
          <div className="space-y-2">
            <div className="h-3 w-3/4 rounded bg-[var(--color-line)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--color-line)]" />
          </div>
        </div>
      </div>
    );
  }

  const mangadex = data?.mangadex;
  const mal = data?.mal;
  const hasMangadex = Boolean(mangadex && mangadex.average > 0);
  const hasMal = Boolean(mal && (mal.magazine || mal.publisher || mal.serialization));
  const dexPct = hasMangadex
    ? Math.max(0, Math.min(100, (mangadex!.average / 10) * 100))
    : 0;
  const gaugeStyle = { "--mdt-ring": `${dexPct}%` } as CSSProperties;
  const dexHref = dexId
    ? `https://mangadex.org/title/${dexId}`
    : "https://mangadex.org";
  const malHref = malId ? `https://myanimelist.net/manga/${malId}` : "https://myanimelist.net";

  return (
    <div className="mdt-card mdt-stats-card">
      <div className="mdt-card-head">
        <h3 className="font-display text-sm font-bold">Community Data</h3>
        <span className="mdt-card-badge">public sources</span>
      </div>

      {hasMangadex ? (
        <div className="mdt-community-rating">
          <div className="mdt-community-top">
            <span>MangaDex rating</span>
            <span className="mdt-community-source">rating</span>
          </div>
          <div
            className="mdt-community-gauge"
            style={gaugeStyle}
            role="img"
            aria-label={`MangaDex rating ${mangadex!.average.toFixed(2)} out of 10`}
          >
            <span className="mdt-community-gauge-inner">
              <strong>{mangadex!.average.toFixed(2)}</strong>
              <small>/ 10</small>
            </span>
          </div>
          <div className="mdt-community-track" aria-hidden>
            <span style={{ width: `${dexPct}%` }} />
          </div>
          <div className="mdt-community-meta">
            <span>Bayesian {mangadex!.bayesian.toFixed(2)}</span>
            <span>{formatCount(mangadex!.follows)} follows</span>
          </div>
        </div>
      ) : null}

      {hasMal ? (
        <div className="mdt-community-rows">
          {mal!.magazine ? (
            <div className="mdt-community-row"><span>Magazine</span><strong>{mal!.magazine}</strong></div>
          ) : null}
          {mal!.publisher ? (
            <div className="mdt-community-row"><span>Publisher</span><strong>{mal!.publisher}</strong></div>
          ) : null}
          {mal!.serialization && mal!.serialization !== mal!.publisher ? (
            <div className="mdt-community-row"><span>Serialization</span><strong>{mal!.serialization}</strong></div>
          ) : null}
        </div>
      ) : null}

      {!hasMangadex && !hasMal ? (
        <p className="mdt-community-empty">
          Community stats are unavailable right now. Source links stay live.
        </p>
      ) : null}

      <div className="mdt-community-links">
        <a href={dexHref} target="_blank" rel="noopener noreferrer" className="mdt-community-link">
          MangaDex <span aria-hidden>↗</span>
        </a>
        <a href={malHref} target="_blank" rel="noopener noreferrer" className="mdt-community-link">
          MyAnimeList <span aria-hidden>↗</span>
        </a>
      </div>
    </div>
  );
}
