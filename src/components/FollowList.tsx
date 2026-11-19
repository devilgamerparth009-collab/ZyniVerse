"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import SocialPageHeader from "@/components/SocialPageHeader";
import { SocialEmpty, SocialError, SocialLoading } from "@/components/SocialStates";
import type { PublicUser } from "@/lib/social-types";
import { logError } from "@/lib/logger";

interface FollowListProps {
  userId: string;
  mode: "followers" | "following";
}

export default function FollowList({ userId, mode }: FollowListProps) {
  const isFollowers = mode === "followers";
  const endpoint = `/api/users/${encodeURIComponent(userId)}/${mode}`;
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, followRes] = await Promise.all([
        fetch(`${endpoint}?limit=50`),
        fetch("/api/follow").catch(() => null),
      ]);
      if (!listRes.ok) throw new Error("Could not load list");
      const data = await listRes.json();
      setUsers(data.users ?? []);
      setNextCursor(data.nextCursor ?? null);
      if (followRes?.ok) {
        const followData = await followRes.json().catch(() => ({}));
        setFollowingIds(new Set<string>(followData.following ?? []));
      }
    } catch (e) {
      logError(e);
      setError("We couldn't load this list right now. Please try again.");
    }
    setLoading(false);
  }, [endpoint]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const res = await fetch(`${endpoint}?limit=50&cursor=${encodeURIComponent(nextCursor)}`);
      if (!res.ok) throw new Error("Could not load more");
      const data = await res.json();
      setUsers((prev) => [...prev, ...(data.users ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch (e) {
      logError(e);
      setMoreError("Couldn't load more people. Please try again.");
    }
    setLoadingMore(false);
  }

  async function toggleFollow(id: string) {
    if (busyIds.has(id)) return;
    const isFollowing = followingIds.has(id);
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/follow", {
        method: isFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (isFollowing ? data.following === false : data.following === true)) {
        setFollowingIds((prev) => {
          const next = new Set(prev);
          if (isFollowing) next.delete(id);
          else next.add(id);
          return next;
        });
      }
    } catch (e) {
      logError(e);
    }
    setBusyIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href={`/profile/${encodeURIComponent(userId)}`} className="mb-4 inline-block text-xs font-semibold text-[var(--color-mute)] transition-colors hover:text-[var(--color-cyan)]">
          ← Back to profile
        </Link>
        <SocialPageHeader
          eyebrow="Connections"
          title={isFollowers ? "Followers" : "Following"}
          description={
            isFollowers
              ? "People who follow this profile. Follow them back to keep up with their posts."
              : "People this profile follows. Follow anyone you want to see in your feed."
          }
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          }
        />

        {loading ? (
          <SocialLoading count={5} />
        ) : error ? (
          <SocialError message={error} onRetry={load} />
        ) : users.length === 0 ? (
          <SocialEmpty
            title={isFollowers ? "No followers yet." : "Not following anyone yet."}
            description="This list will fill up as people connect."
          />
        ) : (
          <>
            <div className="space-y-3">
              {users.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-3 rounded-xl neon-rgb-border bg-[var(--color-panel)]/60 px-4 py-3 backdrop-blur-sm"
                >
                  <Link href={`/profile/${encodeURIComponent(u.id)}`} className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--color-violet)] to-[var(--color-magenta)] text-sm font-bold text-black">
                    {u.avatar ? <Image src={u.avatar} alt="" width={40} height={40} className="object-cover" /> : u.username.charAt(0).toUpperCase()}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/profile/${encodeURIComponent(u.id)}`} className="block truncate text-sm font-semibold text-[var(--color-ink)] transition-colors hover:text-[var(--color-cyan)]">
                      {u.username}
                    </Link>
                    {u.bio && <p className="truncate text-[11px] text-[var(--color-mute)]">{u.bio}</p>}
                  </div>
                  <button
                    onClick={() => toggleFollow(u.id)}
                    disabled={busyIds.has(u.id)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all disabled:opacity-50 ${
                      followingIds.has(u.id)
                        ? "border border-[var(--color-line)] text-[var(--color-mute)] hover:border-red-400 hover:text-red-400"
                        : "bg-[var(--color-cyan)] text-black hover:opacity-90"
                    }`}
                  >
                    {busyIds.has(u.id) ? "..." : followingIds.has(u.id) ? "Unfollow" : isFollowers ? "Follow back" : "Follow"}
                  </button>
                </motion.div>
              ))}
            </div>

            {moreError && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-300">
                <span>{moreError}</span>
                <button onClick={loadMore} className="font-bold text-[var(--color-cyan)] hover:underline">Try again</button>
              </div>
            )}
            {nextCursor && (
              <div className="mt-5 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-full neon-rgb-border px-6 py-2 text-xs font-bold text-[var(--color-cyan)] transition-colors hover:bg-[var(--color-cyan)]/10 disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
