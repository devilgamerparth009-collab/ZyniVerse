"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { fetchJson } from "@/lib/safe-json";

interface Activity {
  id: string;
  userId: string;
  type: string;
  mediaId: number | null;
  mediaTitle: string | null;
  mediaImage: string | null;
  message: string | null;
  createdAt: string;
  user: { id: string; username: string; avatar: string | null };
}

interface UserGroup {
  user: Activity["user"];
  activities: Activity[];
  latestTime: string;
}

interface ActivityResponse {
  activities?: Activity[];
  total?: number;
  fallback?: boolean;
  scope?: "following" | "global";
  reason?: "no_follows" | "not_signed_in";
}

const TYPE_ICONS: Record<string, string> = {
  COMPLETED: "✅", WATCHING: "▶️", CURRENT: "▶️", PLANNING: "📋",
  DROPPED: "⛔", PAUSED: "⏸️", REWATCHING: "🔄", REVIEWED: "⭐", RATED: "🎯", IMPORTED: "📥",
  watched_episode: "📌",
};

const TYPE_LABELS: Record<string, string> = {
  COMPLETED: "completed", WATCHING: "started watching", CURRENT: "is watching",
  PLANNING: "plans to watch", DROPPED: "dropped", PAUSED: "paused",
  REWATCHING: "rewatching", REVIEWED: "reviewed", RATED: "rated",
  watched_episode: "watched episode",
};

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  COMPLETED: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)", text: "#22c55e" },
  WATCHING: { bg: "rgba(41,242,224,0.12)", border: "rgba(41,242,224,0.25)", text: "#29f2e0" },
  CURRENT: { bg: "rgba(41,242,224,0.12)", border: "rgba(41,242,224,0.25)", text: "#29f2e0" },
  PLANNING: { bg: "rgba(138,92,255,0.12)", border: "rgba(138,92,255,0.25)", text: "#8a5cff" },
  DROPPED: { bg: "rgba(255,45,120,0.12)", border: "rgba(255,45,120,0.25)", text: "#ff2d78" },
  PAUSED: { bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.25)", text: "#eab308" },
  REWATCHING: { bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.25)", text: "#06b6d4" },
  REVIEWED: { bg: "rgba(255,179,0,0.12)", border: "rgba(255,179,0,0.25)", text: "#f59e0b" },
  RATED: { bg: "rgba(41,242,224,0.12)", border: "rgba(41,242,224,0.25)", text: "#29f2e0" },
  IMPORTED: { bg: "rgba(138,92,255,0.12)", border: "rgba(138,92,255,0.25)", text: "#8a5cff" },
  watched_episode: { bg: "rgba(41,242,224,0.10)", border: "rgba(41,242,224,0.22)", text: "#29f2e0" },
};

const CARD_COLORS = ["#29f2e0", "#ff2d78", "#8a5cff", "#22c55e", "#f59e0b", "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#e11d48"];

function userColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return CARD_COLORS[hash % CARD_COLORS.length];
}

const VARIANTS = ["spotlight", "timeline", "grid", "poster"] as const;

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function groupByUser(activities: Activity[]): UserGroup[] {
  const map = new Map<string, UserGroup>();
  for (const a of activities) {
    const existing = map.get(a.userId);
    if (existing) existing.activities.push(a);
    else map.set(a.userId, { user: a.user, activities: [a], latestTime: a.createdAt });
  }

  return Array.from(map.values())
    .map((group) => {
      // Oldest → newest, so the last-watched anime always sits at the bottom.
      const sorted = [...group.activities].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return {
        ...group,
        activities: sorted,
        latestTime: sorted[sorted.length - 1]?.createdAt ?? group.latestTime,
      };
    })
    .sort((a, b) => new Date(b.latestTime).getTime() - new Date(a.latestTime).getTime());
}

function ActivityItem({
  activity,
  variant,
  latest,
}: {
  activity: Activity;
  variant: string;
  latest: boolean;
}) {
  const c = TYPE_COLORS[activity.type] || { bg: "rgba(128,123,163,0.12)", border: "rgba(128,123,163,0.25)", text: "#807ba3" };
  const label = TYPE_LABELS[activity.type] || activity.type?.replace(/_/g, " ") || "activity";
  const hasThumb = !!activity.mediaImage && !!activity.mediaId;

  return (
    <div
      className={`fa-item${latest ? " fa-item--latest" : ""}`}
      style={
        {
          "--fa-type": c.text,
          "--fa-type-bg": c.bg,
          "--fa-type-border": c.border,
        } as CSSProperties
      }
    >
      <span className="fa-item-icon" aria-hidden="true">
        {TYPE_ICONS[activity.type] || "📌"}
      </span>
      <span className="fa-item-text">
        <span className="fa-item-label">
          {label}
          {latest ? <span className="fa-latest-tag">Latest</span> : null}
        </span>
        {activity.mediaTitle ? (
          <Link href={`/anime/${activity.mediaId}`} className="fa-item-media">
            {activity.mediaTitle}
          </Link>
        ) : null}
      </span>
      {hasThumb ? (
        <Link
          href={`/anime/${activity.mediaId}`}
          className="fa-item-thumb"
          aria-label={activity.mediaTitle ? `View ${activity.mediaTitle}` : "View anime"}
        >
          <Image src={activity.mediaImage!} alt="" fill className="fa-item-img" sizes="28px" />
        </Link>
      ) : null}
      <span className={`fa-item-variant fa-item-variant--${variant}`} aria-hidden="true" />
    </div>
  );
}

function UserCard({ group, index }: { group: UserGroup; index: number }) {
  const variantIndex = index % VARIANTS.length;
  const variant = VARIANTS[variantIndex];
  // Stable per user: the same colour follows this person into future activities.
  const color = userColor(group.user.id || group.user.username);
  const shown = group.activities.slice(-3);
  const latestActivity = group.activities[group.activities.length - 1];
  const more = group.activities.length - shown.length;
  // Latest anime artwork becomes the card backdrop for every variant.
  const backdrop =
    (latestActivity?.mediaImage ? latestActivity : group.activities.find((a) => a.mediaImage)) ?? null;

  return (
    <article
      className={`fa-card fa-card--${variant}${backdrop?.mediaImage ? " fa-card--has-backdrop" : ""}`}
      style={
        {
          "--fa-accent": color,
          "--fa-i": index,
        } as CSSProperties
      }
    >
      {backdrop?.mediaImage ? (
        <span className="fa-backdrop" aria-hidden="true">
          <Image src={backdrop.mediaImage} alt="" fill className="fa-backdrop-img" sizes="300px" />
        </span>
      ) : null}
      <span className="fa-accent-line" aria-hidden="true" />

      <div className="fa-user">
        <span className="fa-avatar">
          {group.user.avatar ? (
            <Image src={group.user.avatar} alt="" width={40} height={40} className="fa-avatar-img" />
          ) : (
            <span className="fa-avatar-fallback">
              {group.user.username?.[0]?.toUpperCase() ?? "?"}
            </span>
          )}
        </span>
        <span className="fa-user-meta">
          <Link href={`/profile?user=${group.user.id}`} className="fa-username">
            {group.user.username}
          </Link>
          <span className="fa-time">{timeAgo(group.latestTime)}</span>
        </span>
        {group.activities.length > 1 ? (
          <span className="fa-count">{group.activities.length}x</span>
        ) : null}
      </div>

      <div className="fa-items">
        {shown.map((a, i) => (
          <ActivityItem key={a.id} activity={a} variant={variant} latest={i === shown.length - 1} />
        ))}
      </div>

      {more > 0 ? (
        <Link href="/activity" className="fa-more">
          +{more} more <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </article>
  );
}

export default function FriendActivityFeed() {
  const { data: session } = useSession();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"following" | "global">("global");
  const [reason, setReason] = useState<ActivityResponse["reason"] | null>(null);

  const load = useCallback(() => {
    const following = !!session?.user?.id;
    const url = following ? "/api/activity?type=following&limit=50" : "/api/activity?limit=50";

    fetchJson<ActivityResponse>(url)
      .then((data) => {
        setActivities(Array.isArray(data.activities) ? data.activities : []);
        setScope(data.scope ?? (following ? "following" : "global"));
        setReason(data.reason ?? null);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Could not load activity.");
      })
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const retry = () => {
    setLoading(true);
    setError(null);
    load();
  };

  if (loading) {
    return (
      <div className="fa-panel fa-panel--loading">
        <div className="fa-head">
          <div>
            <span className="fa-live fa-live--muted"><span className="fa-live-dot" />Live</span>
            <h3 className="fa-title">Friend Activity</h3>
          </div>
        </div>
        <div className="fa-rail" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`fa-skeleton fa-skeleton--${i + 1}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fa-panel fa-panel--error">
        <span className="fa-state-icon" aria-hidden="true">!</span>
        <h3 className="fa-title">Friend Activity</h3>
        <p className="fa-state-text">Couldn&apos;t load activity: {error}</p>
        <button onClick={retry} className="fa-retry">Try again</button>
      </div>
    );
  }

  if (activities.length === 0) {
    const emptyMessage =
      reason === "no_follows"
        ? "Follow people to see their activity here."
        : reason === "not_signed_in"
          ? "Sign in to see activity from people you follow."
          : scope === "following"
            ? "No recent activity from people you follow."
            : "No public activity yet — watching or reviewing anime will show up here.";

    return (
      <div className="fa-panel fa-panel--empty">
        <span className="fa-state-icon fa-state-icon--empty" aria-hidden="true">◎</span>
        <div className="fa-head fa-head--empty">
          <div>
            <span className="fa-live fa-live--muted"><span className="fa-live-dot" />Live</span>
            <h3 className="fa-title">Friend Activity</h3>
          </div>
        </div>
        <p className="fa-state-text">{emptyMessage}</p>
      </div>
    );
  }

  const groups = groupByUser(activities);

  return (
    <div className="fa-panel">
      <span className="fa-orb fa-orb--a" aria-hidden="true" />
      <span className="fa-orb fa-orb--b" aria-hidden="true" />
      <div className="fa-panel-inner">
        <div className="fa-head">
          <div>
            <span className="fa-live">
              <span className="fa-live-ring" aria-hidden="true" />
              <span className="fa-live-dot" aria-hidden="true" />
              Live
            </span>
            <h3 className="fa-title">Friend Activity</h3>
            <span className="fa-scope">
              {scope === "following" ? "From people you follow" : "Community activity"}
            </span>
          </div>
          <Link href="/activity" className="fa-viewall">
            View all <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="fa-rail">
          {groups.map((group, i) => <UserCard key={group.user.id} group={group} index={i} />)}
        </div>
      </div>
    </div>
  );
}
