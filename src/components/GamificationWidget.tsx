"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

const RANKS = [
  { name: "Bronze", icon: "🥉", at: 0 },
  { name: "Silver", icon: "🪙", at: 100 },
  { name: "Gold", icon: "🥇", at: 500 },
  { name: "Platinum", icon: "💠", at: 1000 },
  { name: "Diamond", icon: "💎", at: 2500 },
  { name: "Heroic", icon: "🔥", at: 5000 },
  { name: "Grandmaster", icon: "👑", at: 10000 },
];

function getRankInfo(points: number) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.at) rank = r;
  }
  return rank;
}

interface AchievementApiResponse {
  points: number;
  level: number;
  nextLevel: { current: number; needed: number };
  achievements: { earned: boolean }[];
}

export default function GamificationWidget() {
  const { data: session } = useSession();
  const [data, setData] = useState<AchievementApiResponse | null>(null);
  const [dataUserId, setDataUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    fetch("/api/achievements")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setDataUserId(session.user?.id ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setDataUserId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  if (!session?.user?.id) {
    return (
      <Link href="/achievements" className="lvl-card lvl-card--guest">
        <span className="lvl-icon" aria-hidden="true">🎮</span>
        <span className="lvl-copy">
          <span className="lvl-kicker">Ready when you are</span>
          <span className="lvl-title">Level up your anime journey</span>
          <span className="lvl-sub">Earn XP, unlock badges &amp; climb the leaderboard</span>
        </span>
        <span className="lvl-action">
          Explore <span className="lvl-action-arrow" aria-hidden="true">→</span>
        </span>
      </Link>
    );
  }

  if (!data || dataUserId !== session.user.id) {
    return (
      <div className="lvl-card lvl-card--loading" aria-live="polite">
        <span className="lvl-icon" aria-hidden="true">🎮</span>
        <span className="lvl-copy">
          <span className="lvl-kicker">Syncing</span>
          <span className="lvl-title">Loading your XP...</span>
          <span className="lvl-sub">Earn badges by exploring anime</span>
        </span>
        <span className="lvl-spinner" aria-hidden="true" />
      </div>
    );
  }

  const rank = getRankInfo(data.points);
  const earned = data.achievements.filter((a) => a.earned).length;
  const total = data.achievements.length;
  const progress =
    data.nextLevel && data.nextLevel.needed > 0
      ? Math.min(100, Math.round((data.nextLevel.current / data.nextLevel.needed) * 100))
      : 0;

  return (
    <Link href="/achievements" className="lvl-card lvl-card--active">
      <span className="lvl-icon" aria-hidden="true">{rank.icon}</span>
      <span className="lvl-copy">
        <span className="lvl-kicker">Current rank</span>
        <span className="lvl-title">{rank.name} · Lv.{data.level}</span>
        <span className="lvl-sub">
          {earned}/{total} badges · {data.points.toLocaleString()} XP
        </span>
      </span>
      <span className="lvl-progress">
        <span className="lvl-progress-head">
          <span>
            {data.nextLevel.current.toLocaleString()} / {data.nextLevel.needed.toLocaleString()} XP
          </span>
          <strong>{progress}%</strong>
        </span>
        <span
          className="lvl-progress-track"
          role="progressbar"
          aria-label="XP progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span className="lvl-progress-fill" style={{ width: `${progress}%` }} />
        </span>
      </span>
      <span className="lvl-action">
        View all <span className="lvl-action-arrow" aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
