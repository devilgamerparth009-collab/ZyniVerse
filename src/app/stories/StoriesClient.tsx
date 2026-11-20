"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import SocialPageHeader from "@/components/SocialPageHeader";
import { SocialEmpty, SocialError, SocialLoading } from "@/components/SocialStates";
import type { StoryItem } from "@/lib/social-types";
import { logError } from "@/lib/logger";

const STORY_DURATION_MS = 5000;

type StoryChannelOption = { id: string; slug: string; name: string; iconUrl: string | null };

type StoryGroup = {
  key: string;
  label: string;
  avatar: string | null;
  channelSlug: string | null;
  stories: StoryItem[];
  viewed: boolean;
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function StoriesClient() {
  const { data: session } = useSession();
  const myId = session?.user?.id;
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [channelId, setChannelId] = useState("");
  const [ownedChannels, setOwnedChannels] = useState<StoryChannelOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stories?limit=60");
      if (!res.ok) throw new Error("Could not load stories");
      const data = await res.json();
      const list: StoryItem[] = data.stories ?? [];
      setStories(list);
      setViewedIds(new Set(list.filter((s) => s.viewed).map((s) => s.id)));
    } catch (e) {
      logError(e);
      setError("We couldn't load stories right now. Please try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStories();
  }, [loadStories]);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetch("/api/channels")
      .then((r) => (r.ok ? r.json() : Promise.resolve({ channels: [] })))
      .then((data) => {
        if (cancelled) return;
        const mine: StoryChannelOption[] = (data.channels ?? [])
          .filter((c: { owner?: { id?: string }; slug: string; name: string; iconUrl: string | null; id: string }) => c.owner?.id === myId)
          .map((c: { id: string; slug: string; name: string; iconUrl: string | null }) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
            iconUrl: c.iconUrl,
          }));
        setOwnedChannels(mine);
      })
      .catch((e) => logError(e));
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const groups = useMemo<StoryGroup[]>(() => {
    const map = new Map<string, StoryGroup>();
    for (const story of stories) {
      const key = story.channel?.id ?? story.user.id;
      const existing = map.get(key);
      if (existing) {
        existing.stories.push(story);
        if (!story.viewed && !viewedIds.has(story.id)) existing.viewed = false;
      } else {
        map.set(key, {
          key,
          label: story.channel?.name ?? story.user.username,
          avatar: story.channel?.iconUrl ?? story.user.avatar,
          channelSlug: story.channel?.slug ?? null,
          stories: [story],
          viewed: story.viewed || viewedIds.has(story.id),
        });
      }
    }
    return Array.from(map.values());
  }, [stories, viewedIds]);

  const activeStory = viewerIndex !== null ? stories[viewerIndex] ?? null : null;

  useEffect(() => {
    if (viewerIndex === null) return;
    const story = stories[viewerIndex];
    if (!story || viewedIds.has(story.id)) return;
    let cancelled = false;
    fetch(`/api/stories/${encodeURIComponent(story.id)}/view`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : Promise.resolve({})))
      .then((data) => {
        if (cancelled) return;
        setViewedIds((prev) => new Set(prev).add(story.id));
        if (typeof data?.viewCount === "number") {
          setStories((prev) => prev.map((s) => (s.id === story.id ? { ...s, viewCount: data.viewCount } : s)));
        }
      })
      .catch((e) => logError(e));
    return () => {
      cancelled = true;
    };
  }, [viewerIndex, stories, viewedIds]);

  useEffect(() => {
    if (viewerIndex === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(0);
    const start = Date.now();
    const timer = setInterval(() => {
      const next = Math.min(100, ((Date.now() - start) / STORY_DURATION_MS) * 100);
      setProgress(next);
      if (next >= 100) {
        clearInterval(timer);
        setViewerIndex((current) => {
          if (current === null) return null;
          return current + 1 < stories.length ? current + 1 : null;
        });
      }
    }, 50);
    return () => clearInterval(timer);
  }, [viewerIndex, stories.length]);

  useEffect(() => {
    if (viewerIndex === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setViewerIndex(null);
      if (e.key === "ArrowRight") {
        setViewerIndex((current) => (current === null ? null : Math.min(current + 1, stories.length - 1)));
      }
      if (e.key === "ArrowLeft") {
        setViewerIndex((current) => (current === null ? null : Math.max(current - 1, 0)));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerIndex, stories.length]);

  function openGroup(group: StoryGroup) {
    const first = group.stories.find((s) => !s.viewed && !viewedIds.has(s.id)) ?? group.stories[0];
    const index = stories.findIndex((s) => s.id === first.id);
    if (index >= 0) setViewerIndex(index);
  }

  async function createStory(e: React.FormEvent) {
    e.preventDefault();
    if (!mediaUrl.trim()) {
      setFormError("Add a media URL first.");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl: mediaUrl.trim(),
          mediaType,
          caption: caption.trim() || undefined,
          channelId: channelId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.story) {
        setStories((prev) => [data.story as StoryItem, ...prev]);
        setMediaUrl("");
        setCaption("");
        setChannelId("");
        setMediaType("image");
        setShowCreate(false);
      } else {
        setFormError(data.error ?? "Could not share your story. Please try again.");
      }
    } catch (e) {
      logError(e);
      setFormError("Could not share your story. Please try again.");
    }
    setCreating(false);
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <SocialPageHeader
          eyebrow="Moments"
          title="Stories"
          description="Short updates from people and channels. Stories disappear after a day."
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          }
        />

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-mute)]">
            {loading ? "Loading stories..." : `${stories.length} active story${stories.length === 1 ? "" : "ies"}`}
          </p>
          {myId && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-full neon-rgb-border px-5 py-2 text-xs font-bold text-[var(--color-cyan)] transition-colors hover:bg-[var(--color-cyan)]/10"
            >
              {showCreate ? "Cancel" : "Add a story"}
            </button>
          )}
        </div>

        {showCreate && myId && (
          <form onSubmit={createStory} className="mb-6 space-y-3 rounded-xl neon-rgb-border bg-[var(--color-panel)]/60 p-4 backdrop-blur-sm">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">Media URL</span>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-3 py-2 text-sm outline-none focus:border-[var(--color-cyan)]"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">Media type</span>
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value === "video" ? "video" : "image")}
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-3 py-2 text-sm outline-none focus:border-[var(--color-cyan)]"
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">Channel (optional)</span>
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-3 py-2 text-sm outline-none focus:border-[var(--color-cyan)]"
                >
                  <option value="">My profile</option>
                  {ownedChannels.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">Caption</span>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={240}
                placeholder="Say something short..."
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-3 py-2 text-sm outline-none focus:border-[var(--color-cyan)]"
              />
            </label>
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="rounded-full bg-[var(--color-cyan)] px-5 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Sharing..." : "Share story"}
            </button>
          </form>
        )}

        {loading ? (
          <SocialLoading count={3} height="h-24" />
        ) : error ? (
          <SocialError message={error} onRetry={loadStories} />
        ) : stories.length === 0 ? (
          <SocialEmpty
            title="No stories yet."
            description={myId ? "Add one above and it will be here for the next 24 hours." : "Check back soon — stories disappear after a day."}
          />
        ) : (
          <>
            <div className="mb-4 flex gap-4 overflow-x-auto pb-2">
              {groups.map((group, i) => (
                <motion.button
                  key={group.key}
                  onClick={() => openGroup(group)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                >
                  <span className={`flex h-16 w-16 items-center justify-center rounded-full p-0.5 ${
                    group.viewed
                      ? "bg-[var(--color-line)]"
                      : "bg-gradient-to-tr from-[var(--color-magenta)] via-[var(--color-violet)] to-[var(--color-cyan)]"
                  }`}>
                    <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-[var(--color-panel)] bg-[var(--color-surface)] text-lg font-bold text-[var(--color-ink)]">
                      {group.avatar ? (
                        <Image src={group.avatar} alt="" width={60} height={60} className="h-full w-full object-cover" />
                      ) : (
                        group.label.charAt(0).toUpperCase()
                      )}
                    </span>
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-[var(--color-mute)]">{group.label}</span>
                </motion.button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {stories.map((story, i) => (
                <motion.button
                  key={story.id}
                  onClick={() => setViewerIndex(i)}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3), ease: [0.22, 1, 0.36, 1] }}
                  className="group overflow-hidden rounded-xl neon-rgb-border bg-[var(--color-panel)]/60 text-left backdrop-blur-sm"
                >
                  <div className="relative h-40 w-full overflow-hidden bg-[var(--color-void)]">
                    {story.mediaType === "image" ? (
                      <Image src={story.mediaUrl} alt={story.caption ?? "Story"} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 640px) 100vw, 400px" unoptimized />
                    ) : (
                      <video src={story.mediaUrl} muted playsInline className="h-full w-full object-cover" />
                    )}
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {story.channel ? story.channel.name : story.user.username}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-xs text-[var(--color-ink)]">{story.caption || "No caption"}</p>
                    <p className="mt-1 text-[10px] text-[var(--color-mute)]">
                      {timeAgo(story.createdAt)} · {story.viewCount} view{story.viewCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>

      {activeStory && viewerIndex !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Story viewer">
          <div className="absolute left-0 right-0 top-0 z-10 h-1 bg-white/20">
            <motion.div
              className="h-full bg-[var(--color-cyan)]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.05, ease: "linear" }}
            />
          </div>

          <div className="absolute left-4 right-4 top-5 z-10 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--color-violet)] to-[var(--color-magenta)] text-xs font-bold text-black">
              {(activeStory.channel?.iconUrl ?? activeStory.user.avatar) ? (
                <Image src={activeStory.channel?.iconUrl ?? activeStory.user.avatar ?? ""} alt="" width={36} height={36} className="h-full w-full object-cover" />
              ) : (
                (activeStory.channel?.name ?? activeStory.user.username).charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{activeStory.channel?.name ?? activeStory.user.username}</p>
              <p className="text-[10px] text-white/60">{timeAgo(activeStory.createdAt)}</p>
            </div>
            <button onClick={() => setViewerIndex(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20" aria-label="Close story">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {viewerIndex > 0 && (
            <button
              onClick={() => setViewerIndex(viewerIndex - 1)}
              className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Previous story"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}
          {viewerIndex < stories.length - 1 && (
            <button
              onClick={() => setViewerIndex(viewerIndex + 1)}
              className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Next story"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}

          <div className="flex h-full w-full max-w-md flex-col items-center justify-center px-10 pb-16 pt-20">
            {activeStory.mediaType === "image" ? (
              <Image
                src={activeStory.mediaUrl}
                alt={activeStory.caption ?? "Story"}
                width={600}
                height={800}
                className="max-h-[65vh] w-auto rounded-xl object-contain"
                unoptimized
              />
            ) : (
              <video src={activeStory.mediaUrl} controls autoPlay playsInline className="max-h-[65vh] w-auto rounded-xl" />
            )}
            {activeStory.caption && (
              <p className="mt-4 text-center text-sm text-white">{activeStory.caption}</p>
            )}
            {!activeStory.channel && (
              <Link href={`/profile/${encodeURIComponent(activeStory.user.id)}`} className="mt-3 text-xs font-semibold text-[var(--color-cyan)] hover:underline">
                View {activeStory.user.username}&apos;s profile
              </Link>
            )}
            {activeStory.channel && (
              <Link href={`/channels/${encodeURIComponent(activeStory.channel.slug)}`} className="mt-3 text-xs font-semibold text-[var(--color-cyan)] hover:underline">
                View {activeStory.channel.name} channel
              </Link>
            )}
          </div>
        </div>
      )}
    </PageTransition>
  );
}
