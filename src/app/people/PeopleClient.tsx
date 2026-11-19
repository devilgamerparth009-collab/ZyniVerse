"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import SocialPageHeader from "@/components/SocialPageHeader";
import { SocialEmpty, SocialError, SocialLoading } from "@/components/SocialStates";
import type { DiscoveredUser, PublicUser } from "@/lib/social-types";
import { logError } from "@/lib/logger";

export default function PeopleClient() {
  const { status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<DiscoveredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNonce, setSearchNonce] = useState(0);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [messageBusyId, setMessageBusyId] = useState<string | null>(null);

  const loadPeople = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users/discover?limit=24");
      if (!res.ok) throw new Error("Could not load people");
      const data = await res.json();
      const list: DiscoveredUser[] = data.users ?? [];
      setUsers(list);
      setFollowingIds(new Set(list.filter((u) => u.isFollowing).map((u) => u.id)));
    } catch (e) {
      logError(e);
      setError("We couldn't load people right now. Please try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPeople();
  }, [status, loadPeople]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        if (!cancelled) setResults(data.users ?? []);
      } catch (e) {
        logError(e);
        if (!cancelled) setSearchError("Search didn't work. Please try again.");
      }
      if (!cancelled) setSearching(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, searchNonce]);

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
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, isFollowing: !isFollowing } : u))
        );
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

  async function startMessage(id: string) {
    if (messageBusyId) return;
    setMessageBusyId(id);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.conversation) {
        router.push(`/messages?conversationId=${encodeURIComponent(data.conversation.id)}`);
      }
    } catch (e) {
      logError(e);
    }
    setMessageBusyId(null);
  }

  if (status === "loading") return null;

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <SocialPageHeader
          eyebrow="Discover"
          title="Find People"
          description="Meet other fans, see why you might click, and start a conversation."
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          }
        />

        <div className="mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people by name..."
            className="w-full rounded-xl neon-rgb-border bg-[var(--color-void)] px-4 py-3 text-sm outline-none placeholder:text-[var(--color-mute)]"
          />
          {query.trim().length >= 2 && (
            <div className="mt-2 overflow-hidden rounded-xl neon-rgb-border bg-[var(--color-panel)]/60 backdrop-blur-sm">
              {searching ? (
                <div className="p-4 text-sm text-[var(--color-mute)]">Searching...</div>
              ) : searchError ? (
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm text-[var(--color-mute)]">
                  <span>{searchError}</span>
                  <button
                    onClick={() => setSearchNonce((n) => n + 1)}
                    className="text-xs font-bold text-[var(--color-cyan)] hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : results.length === 0 ? (
                <div className="p-4 text-sm text-[var(--color-mute)]">No people found.</div>
              ) : (
                results.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 border-b border-[var(--color-line)]/50 px-4 py-3 last:border-0">
                    <Link href={`/profile/${u.id}`} className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--color-violet)] to-[var(--color-magenta)] text-xs font-bold text-black">
                      {u.avatar ? <Image src={u.avatar} alt="" width={36} height={36} className="object-cover" /> : u.username.charAt(0).toUpperCase()}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${u.id}`} className="block truncate text-sm font-semibold text-[var(--color-ink)] hover:text-[var(--color-cyan)]">
                        {u.username}
                      </Link>
                      {u.bio && <p className="truncate text-[11px] text-[var(--color-mute)]">{u.bio}</p>}
                    </div>
                    <button
                      onClick={() => toggleFollow(u.id)}
                      disabled={busyIds.has(u.id)}
                      className="rounded-full neon-rgb-border px-3 py-1.5 text-xs font-bold text-[var(--color-ink)] transition-colors hover:text-[var(--color-cyan)] disabled:opacity-50"
                    >
                      {busyIds.has(u.id) ? "..." : followingIds.has(u.id) ? "Unfollow" : "Follow"}
                    </button>
                    <button
                      onClick={() => startMessage(u.id)}
                      disabled={messageBusyId === u.id}
                      className="rounded-full bg-[var(--color-violet)] px-3 py-1.5 text-xs font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {messageBusyId === u.id ? "..." : "Message"}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-sm uppercase tracking-wider text-[var(--color-cyan)]">Suggested for you</h2>
          <span className="text-[11px] text-[var(--color-mute)]">Based on shared interests</span>
        </div>

        {loading ? (
          <SocialLoading count={5} />
        ) : error ? (
          <SocialError message={error} onRetry={loadPeople} />
        ) : users.length === 0 ? (
          <SocialEmpty
            title="No people to show yet."
            description="Check back soon — this list grows as more people join."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {users.map((u, i) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col rounded-xl neon-rgb-border bg-[var(--color-panel)]/60 p-4 backdrop-blur-sm transition-all duration-300"
              >
                <div className="flex items-start gap-3">
                  <Link href={`/profile/${u.id}`} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--color-violet)] to-[var(--color-magenta)] text-sm font-bold text-black">
                    {u.avatar ? <Image src={u.avatar} alt="" width={44} height={44} className="object-cover" /> : u.username.charAt(0).toUpperCase()}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/profile/${u.id}`} className="block truncate text-sm font-semibold text-[var(--color-ink)] hover:text-[var(--color-cyan)]">
                      {u.username}
                    </Link>
                    {u.bio && <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--color-mute)]">{u.bio}</p>}
                  </div>
                  {u.isFriend && (
                    <span className="shrink-0 rounded-full bg-[var(--color-cyan)]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-cyan)]">
                      Friend
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-0.5 text-[10px] text-[var(--color-cyan)]">
                    {u.reason}
                  </span>
                  {u.mutualFollowers > 0 && (
                    <span className="text-[10px] text-[var(--color-mute)]">
                      {u.mutualFollowers} mutual follower{u.mutualFollowers === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => toggleFollow(u.id)}
                    disabled={busyIds.has(u.id)}
                    className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 ${
                      followingIds.has(u.id)
                        ? "border border-[var(--color-line)] text-[var(--color-mute)] hover:border-red-400 hover:text-red-400"
                        : "bg-[var(--color-cyan)] text-black hover:opacity-90"
                    }`}
                  >
                    {busyIds.has(u.id) ? "..." : followingIds.has(u.id) ? "Unfollow" : "Follow"}
                  </button>
                  <button
                    onClick={() => startMessage(u.id)}
                    disabled={messageBusyId === u.id}
                    className="flex-1 rounded-full border border-[var(--color-line)] px-3 py-2 text-xs font-bold text-[var(--color-ink)] transition-colors hover:border-[var(--color-violet)] hover:text-[var(--color-violet)] disabled:opacity-50"
                  >
                    {messageBusyId === u.id ? "..." : "Message"}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
