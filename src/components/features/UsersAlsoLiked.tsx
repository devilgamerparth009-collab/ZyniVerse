"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface RecItem {
  mediaId: number;
  count: number;
  avgScore: number;
  title?: string;
  coverImage?: string;
}

interface Props {
  mediaId: number;
  type?: "ANIME" | "MANGA";
}

export default function UsersAlsoLiked({ mediaId, type = "ANIME" }: Props) {
  const [recs, setRecs] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users-also-liked/${mediaId}?type=${type}`)
      .then((r) => r.json())
      .then((d) => {
        setRecs(d.recommendations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mediaId, type]);

  if (loading) {
    return <div className="mdt-ual-skeleton mdt-card animate-pulse" />;
  }
  if (recs.length === 0) return null;

  const section = type === "MANGA" ? "manga" : "anime";

  return (
    <div className="mdt-card mdt-ual">
      <div className="mdt-card-head">
        <h3 className="font-display text-sm font-bold">Users Also Liked</h3>
        <span className="mdt-card-badge">real overlap</span>
      </div>
      <div className="mdt-ual-list">
        {recs.slice(0, 8).map((r) => (
          <Link key={r.mediaId} href={`/${section}/${r.mediaId}`} className="mdt-ual-row">
            {r.coverImage ? (
              <span className="mdt-ual-cover">
                <Image src={r.coverImage} alt="" width={28} height={40} className="mdt-ual-img" />
              </span>
            ) : (
              <span className="mdt-ual-id" aria-hidden>#{r.mediaId}</span>
            )}
            <span className="mdt-ual-body">
              <span className="mdt-ual-title">{r.title || `${section} #${r.mediaId}`}</span>
              <span className="mdt-ual-meta">{r.count} users · Avg {(r.avgScore / 10).toFixed(1)}</span>
            </span>
            <span className="mdt-ual-count">{r.count > 99 ? "99+" : r.count}</span>
          </Link>
        ))}
      </div>
      <p className="mdt-ual-note">Based on completed {section} lists on ZyniVerse</p>
    </div>
  );
}
