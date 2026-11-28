"use client";

import { useEffect, useState } from "react";

interface Discussion {
  title: string;
  url: string;
  score: number;
  comments: number;
  created: string;
}

interface Props {
  mediaId: number;
  title?: string;
  type?: "ANIME" | "MANGA";
}

export default function DiscussionLinks({ mediaId, title = "", type = "ANIME" }: Props) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ type });
    if (title) params.set("title", title);

    fetch(`/api/episodes/discussion/${mediaId}?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setDiscussions(d.discussions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mediaId, title, type]);

  const subreddit = type === "MANGA" ? "manga" : "anime";
  const searchQuery = type === "MANGA" ? `${title} manga discussion` : `${title} episode discussion`;
  const searchHref = `https://www.reddit.com/r/${subreddit}/search/?q=${encodeURIComponent(searchQuery.trim())}&restrict_sr=1&sort=new`;

  if (loading) {
    return <div className="mdt-disc-skeleton mdt-card animate-pulse" />;
  }

  return (
    <div className="mdt-card mdt-disc">
      <div className="mdt-card-head mdt-disc-head">
        <h3 className="mdt-disc-heading font-display font-bold">Community Discussions</h3>
        <span className="mdt-card-badge mdt-disc-source">Reddit</span>
      </div>

      {discussions.length > 0 ? (
        <div className="mdt-disc-list">
          {discussions.map((d, i) => (
            <a key={`${d.url}-${i}`} href={d.url} target="_blank" rel="noopener noreferrer" className="mdt-disc-row">
              <span className="mdt-disc-pulse" aria-hidden />
              <span className="mdt-disc-title">{d.title}</span>
              <span className="mdt-disc-meta">
                <span>↑{d.score ?? 0}</span>
                <span>{d.comments ?? 0}c</span>
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="mdt-disc-empty-state">
          <span className="mdt-disc-empty-orbit" aria-hidden>
            <span className="mdt-disc-empty-core">r/</span>
          </span>
          <div className="mdt-disc-empty-copy">
            <strong className="mdt-disc-empty-title">No live threads right now.</strong>
            <p className="mdt-disc-empty-note">Open Reddit search to join the conversation.</p>
          </div>
        </div>
      )}

      <a href={searchHref} target="_blank" rel="noopener noreferrer" className="mdt-disc-search">
        <span className="mdt-disc-search-label">Search r/{subreddit}</span>
        <span className="mdt-disc-search-arrow" aria-hidden> ↗</span>
      </a>
    </div>
  );
}
