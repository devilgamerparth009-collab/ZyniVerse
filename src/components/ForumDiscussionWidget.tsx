"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import boxStyles from "./detailBoxes.module.css";

interface ForumDiscussionWidgetProps {
  animeId: number;
  animeTitle: string;
  animeImage?: string;
  className?: string;
}

interface ForumThreadSummary {
  id: string;
  title: string;
}

export default function ForumDiscussionWidget({ animeId, animeTitle, animeImage, className = "" }: ForumDiscussionWidgetProps) {
  const [threads, setThreads] = useState<ForumThreadSummary[]>([]);

  useEffect(() => {
    fetch(`/api/forum/threads?animeId=${animeId}&limit=5`)
      .then(r => r.json())
      .then(d => setThreads(d.threads || []))
      .catch(() => {});
  }, [animeId]);

  return (
    <div className={className}>
      <h3 className={`${boxStyles.boxTitle} font-display text-sm font-bold mb-3 flex items-center gap-2`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-cyan)]">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        Discussion
      </h3>

      {threads.length === 0 ? (
        <div className={boxStyles.emptyState}>No discussions yet.</div>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <Link key={t.id} href={`/forum/thread/${t.id}`}
              className={`${boxStyles.threadLink} truncate`}
            >
              {t.title}
            </Link>
          ))}
        </div>
      )}

      <div className={`${boxStyles.pillRow} mt-3`}>
        <Link href={`/forum/anime/${animeId}`}
          className={`${boxStyles.miniLink} flex-1`}
        >View All Threads</Link>
        <Link href={`/forum/create?animeId=${animeId}&animeTitle=${encodeURIComponent(animeTitle)}&animeImage=${encodeURIComponent(animeImage || "")}`}
          className={`${boxStyles.miniLink} ${boxStyles.miniLinkPrimary} flex-1`}
        >+ New Thread</Link>
      </div>
    </div>
  );
}
