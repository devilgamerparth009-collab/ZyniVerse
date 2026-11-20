"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { SocialEmpty, SocialError, SocialLoading } from "@/components/SocialStates";
import type { ChannelPostView, ChannelSummary } from "@/lib/social-types";
import { logError } from "@/lib/logger";

const REACTION_EMOJIS = ["❤️", "👍", "😂", "🔥", "😮", "😢"];

function sortPosts(list: ChannelPostView[]): ChannelPostView[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function ChannelClient({ slug }: { slug: string }) {
  const { data: session } = useSession();
  const myId = session?.user?.id;
  const encodedSlug = encodeURIComponent(slug);
  const [channel, setChannel] = useState<ChannelSummary | null>(null);
  const [posts, setPosts] = useState<ChannelPostView[]>([]);
  const [loadingChannel, setLoadingChannel] = useState(true);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pickerPostId, setPickerPostId] = useState<string | null>(null);

  const fetchChannel = useCallback(async (): Promise<ChannelSummary | null> => {
    const res = await fetch(`/api/channels/${encodedSlug}`);
    if (!res.ok) throw new Error("Could not load channel");
    const data = await res.json();
    return data.channel ?? null;
  }, [encodedSlug]);

  const fetchPosts = useCallback(async (): Promise<{
    posts: ChannelPostView[];
    nextCursor: string | null;
  }> => {
    const res = await fetch(`/api/channels/${encodedSlug}/posts?limit=30`);
    if (!res.ok) throw new Error("Could not load posts");
    const data = await res.json();
    return {
      posts: sortPosts(data.posts ?? []),
      nextCursor: data.nextCursor ?? null,
    };
  }, [encodedSlug]);

  const applyChannel = useCallback((value: ChannelSummary | null) => {
    setChannel(value);
    setLoadingChannel(false);
  }, []);

  const applyChannelError = useCallback((e: unknown) => {
    logError(e);
    setChannelError("We couldn't load this channel. Please try again.");
    setLoadingChannel(false);
  }, []);

  const applyPosts = useCallback(
    (value: { posts: ChannelPostView[]; nextCursor: string | null }) => {
      setPosts(value.posts);
      setNextCursor(value.nextCursor);
      setLoadingPosts(false);
    },
    []
  );

  const applyPostsError = useCallback((e: unknown) => {
    logError(e);
    setPostsError("We couldn't load posts right now. Please try again.");
    setLoadingPosts(false);
  }, []);

  const loadChannel = useCallback(() => {
    setLoadingChannel(true);
    setChannelError(null);
    void fetchChannel().then(applyChannel, applyChannelError);
  }, [fetchChannel, applyChannel, applyChannelError]);

  const loadPosts = useCallback(() => {
    setLoadingPosts(true);
    setPostsError(null);
    void fetchPosts().then(applyPosts, applyPostsError);
  }, [fetchPosts, applyPosts, applyPostsError]);

  useEffect(() => {
    // Reset the loading flags for a new channel in a microtask rather than
    // synchronously in the effect body. The fetched data still updates state
    // from promise callbacks, so there is no cascading render on mount.
    void Promise.resolve().then(() => {
      setLoadingChannel(true);
      setChannelError(null);
      setLoadingPosts(true);
      setPostsError(null);
    });
    void fetchChannel().then(applyChannel, applyChannelError);
    void fetchPosts().then(applyPosts, applyPostsError);
  }, [fetchChannel, fetchPosts, applyChannel, applyChannelError, applyPosts, applyPostsError]);

  async function loadMorePosts() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const res = await fetch(`/api/channels/${encodedSlug}/posts?limit=30&cursor=${encodeURIComponent(nextCursor)}`);
      if (!res.ok) throw new Error("Could not load more posts");
      const data = await res.json();
      setPosts((prev) => sortPosts([...prev, ...(data.posts ?? [])]));
      setNextCursor(data.nextCursor ?? null);
    } catch (e) {
      logError(e);
      setMoreError("Couldn't load more posts. Please try again.");
    }
    setLoadingMore(false);
  }

  async function toggleSubscribe() {
    if (!channel || subscribing) return;
    setSubscribing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/channels/${encodedSlug}/subscribe`, {
        method: channel.isSubscribed ? "DELETE" : "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setChannel((prev) =>
          prev
            ? {
                ...prev,
                isSubscribed: data.subscribed === true,
                subscriberCount: typeof data.subscriberCount === "number" ? data.subscriberCount : prev.subscriberCount,
              }
            : prev
        );
      } else {
        setActionError(data.error ?? "Could not update your subscription.");
      }
    } catch (e) {
      logError(e);
      setActionError("Could not update your subscription. Please try again.");
    }
    setSubscribing(false);
  }

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (content.trim().length < 1 || content.trim().length > 2000) {
      setComposerError("Write a post between 1 and 2000 characters.");
      return;
    }
    setPosting(true);
    setComposerError(null);
    try {
      const res = await fetch(`/api/channels/${encodedSlug}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          imageUrl: imageUrl.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
          linkLabel: linkLabel.trim() || undefined,
          pinned,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.post) {
        setPosts((prev) => sortPosts([data.post as ChannelPostView, ...prev]));
        setContent("");
        setImageUrl("");
        setLinkUrl("");
        setLinkLabel("");
        setPinned(false);
        setChannel((prev) => (prev ? { ...prev, postCount: prev.postCount + 1 } : prev));
      } else {
        setComposerError(data.error ?? "Could not publish your post. Please try again.");
      }
    } catch (e) {
      logError(e);
      setComposerError("Could not publish your post. Please try again.");
    }
    setPosting(false);
  }

  async function reactToPost(post: ChannelPostView, emoji: string) {
    setBusyPostId(post.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/channels/${encodedSlug}/posts/${encodeURIComponent(post.id)}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  reactions: data.reactions ?? {},
                  myReactions: Array.isArray(data.myReactions) ? data.myReactions : [],
                }
              : p
          )
        );
      } else {
        setActionError(data.error ?? "Could not add your reaction.");
      }
    } catch (e) {
      logError(e);
      setActionError("Could not add your reaction. Please try again.");
    }
    setBusyPostId(null);
  }

  async function togglePin(post: ChannelPostView) {
    setBusyPostId(post.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/channels/${encodedSlug}/posts/${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !post.pinned }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const nextPinned = typeof data?.post?.pinned === "boolean" ? data.post.pinned : !post.pinned;
        setPosts((prev) => sortPosts(prev.map((p) => (p.id === post.id ? { ...p, pinned: nextPinned } : p))));
      } else {
        setActionError(data.error ?? "Could not change the pinned post.");
      }
    } catch (e) {
      logError(e);
      setActionError("Could not change the pinned post. Please try again.");
    }
    setBusyPostId(null);
  }

  async function deletePost(post: ChannelPostView) {
    if (confirmDeleteId !== post.id) {
      setConfirmDeleteId(post.id);
      setTimeout(() => setConfirmDeleteId((cur) => (cur === post.id ? null : cur)), 3000);
      return;
    }
    setBusyPostId(post.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/channels/${encodedSlug}/posts/${encodeURIComponent(post.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        setChannel((prev) => (prev ? { ...prev, postCount: Math.max(0, prev.postCount - 1) } : prev));
      } else {
        setActionError(data.error ?? "Could not delete this post.");
      }
    } catch (e) {
      logError(e);
      setActionError("Could not delete this post. Please try again.");
    }
    setBusyPostId(null);
    setConfirmDeleteId(null);
  }

  const isOwner = !!myId && channel?.owner.id === myId;

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/channels" className="mb-4 inline-block text-xs font-semibold text-[var(--color-mute)] transition-colors hover:text-[var(--color-cyan)]">
          ← All channels
        </Link>

        {loadingChannel ? (
          <SocialLoading count={3} height="h-20" />
        ) : channelError ? (
          <SocialError message={channelError} onRetry={loadChannel} />
        ) : !channel ? (
          <SocialEmpty title="Channel not found." description="It may have been removed." />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl neon-rgb-border bg-[var(--color-panel)]/60 backdrop-blur-sm"
          >
            {channel.coverUrl ? (
              <div className="h-28 w-full bg-cover bg-center" style={{ backgroundImage: `url(${channel.coverUrl})` }} />
            ) : (
              <div className="h-28 w-full bg-gradient-to-br from-[var(--color-violet)]/30 via-transparent to-[var(--color-magenta)]/20" />
            )}
            <div className="px-5 pb-5">
              <div className="-mt-8 flex flex-wrap items-end gap-3">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-[var(--color-panel)] bg-gradient-to-br from-[var(--color-magenta)] to-[var(--color-violet)] text-xl font-bold text-black">
                  {channel.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={channel.iconUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    channel.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-bold text-[var(--color-ink)]">{channel.name}</h1>
                    {channel.isOfficial && (
                      <span className="flex items-center gap-1 rounded-full bg-[var(--color-cyan)]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-cyan)]">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>
                        Official
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--color-mute)]">
                    by {channel.owner.username} · {channel.subscriberCount} subscriber{channel.subscriberCount === 1 ? "" : "s"} · {channel.postCount} post{channel.postCount === 1 ? "" : "s"}
                  </p>
                </div>
                {myId && (
                  <button
                    onClick={toggleSubscribe}
                    disabled={subscribing}
                    className={`mb-1 rounded-full px-5 py-2 text-xs font-bold transition-all disabled:opacity-50 ${
                      channel.isSubscribed
                        ? "border border-[var(--color-line)] text-[var(--color-mute)] hover:border-red-400 hover:text-red-400"
                        : "bg-[var(--color-cyan)] text-black hover:opacity-90"
                    }`}
                  >
                    {subscribing ? "..." : channel.isSubscribed ? "Unsubscribe" : "Subscribe"}
                  </button>
                )}
              </div>
              {channel.description && <p className="mt-4 text-sm text-[var(--color-mute)]">{channel.description}</p>}
            </div>
          </motion.div>
        )}

        {actionError && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-300">
            {actionError}
          </div>
        )}

        {isOwner && (
          <form onSubmit={submitPost} className="mt-6 space-y-3 rounded-xl neon-rgb-border bg-[var(--color-panel)]/60 p-4 backdrop-blur-sm">
            <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--color-cyan)]">New post</h2>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Share an update with your subscribers..."
              className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-3 py-2 text-sm outline-none focus:border-[var(--color-cyan)]"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL (optional)"
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-3 py-2 text-xs outline-none focus:border-[var(--color-cyan)]"
              />
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Link URL (optional)"
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-3 py-2 text-xs outline-none focus:border-[var(--color-cyan)]"
              />
              <input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="Link label (optional)"
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-3 py-2 text-xs outline-none focus:border-[var(--color-cyan)]"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--color-mute)]">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-[var(--color-cyan)]" />
              Pin this post to the top
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={posting}
                className="rounded-full bg-[var(--color-cyan)] px-5 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {posting ? "Publishing..." : "Publish post"}
              </button>
              <span className="text-[10px] text-[var(--color-mute)]">{content.length}/2000</span>
            </div>
            {composerError && <p className="text-xs text-red-400">{composerError}</p>}
          </form>
        )}

        <div className="mb-3 mt-8 flex items-center justify-between">
          <h2 className="font-mono text-sm uppercase tracking-wider text-[var(--color-cyan)]">Posts</h2>
          <button onClick={loadPosts} className="text-[11px] text-[var(--color-mute)] transition-colors hover:text-[var(--color-cyan)]">
            Refresh
          </button>
        </div>

        {loadingPosts ? (
          <SocialLoading count={3} height="h-28" />
        ) : postsError ? (
          <SocialError message={postsError} onRetry={loadPosts} />
        ) : posts.length === 0 ? (
          <SocialEmpty title="No posts yet." description={isOwner ? "Use the composer above to publish the first one." : "Check back soon for updates."} />
        ) : (
          <div className="space-y-3">
            {posts.map((post, i) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
                className="rounded-xl neon-rgb-border bg-[var(--color-panel)]/60 p-4 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-violet)] to-[var(--color-magenta)] text-xs font-bold text-black">
                    {post.author.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-[var(--color-ink)]">{post.author.username}</span>
                    <span className="ml-2 text-[10px] text-[var(--color-mute)]">{timeAgo(post.createdAt)}</span>
                  </div>
                  {post.pinned && (
                    <span className="rounded-full bg-[var(--color-cyan)]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-cyan)]">
                      Pinned
                    </span>
                  )}
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink)]">{post.content}</p>
                {post.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.imageUrl} alt="" className="mt-3 max-h-80 w-full rounded-lg object-cover" />
                )}
                {post.linkUrl && (
                  <a
                    href={post.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block rounded-lg border border-[var(--color-line)] px-3 py-2 text-xs font-semibold text-[var(--color-cyan)] transition-colors hover:border-[var(--color-cyan)]"
                  >
                    {post.linkLabel || "Open link"} ↗
                  </a>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-line)]/50 pt-3">
                  {Object.entries(post.reactions)
                    .filter(([, count]) => count > 0)
                    .map(([emoji, count]) => (
                      <button
                        key={emoji}
                        onClick={() => reactToPost(post, emoji)}
                        disabled={busyPostId === post.id}
                        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                          post.myReactions.includes(emoji)
                            ? "border-[var(--color-cyan)] bg-[var(--color-cyan)]/10"
                            : "border-[var(--color-line)] hover:border-[var(--color-cyan)]"
                        }`}
                      >
                        <span>{emoji}</span>
                        <span className="text-[10px] text-[var(--color-mute)]">{count}</span>
                      </button>
                    ))}
                  <div className="relative">
                    <button
                      onClick={() => setPickerPostId(pickerPostId === post.id ? null : post.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-[var(--color-line)] text-sm text-[var(--color-mute)] transition-colors hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]"
                      aria-label="Add reaction"
                    >
                      +
                    </button>
                    {pickerPostId === post.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setPickerPostId(null)} />
                        <div className="absolute bottom-full left-0 z-20 mb-2 flex gap-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-2 shadow-xl">
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => {
                                reactToPost(post, emoji);
                                setPickerPostId(null);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-white/5"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {post.canManage && (
                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        onClick={() => togglePin(post)}
                        disabled={busyPostId === post.id}
                        className="rounded-full px-2.5 py-1 text-[10px] font-bold text-[var(--color-mute)] transition-colors hover:text-[var(--color-cyan)] disabled:opacity-50"
                      >
                        {post.pinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        onClick={() => deletePost(post)}
                        disabled={busyPostId === post.id}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors disabled:opacity-50 ${
                          confirmDeleteId === post.id ? "text-red-400" : "text-[var(--color-mute)] hover:text-red-400"
                        }`}
                      >
                        {confirmDeleteId === post.id ? "Confirm?" : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              </motion.article>
            ))}

            {moreError && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-300">
                <span>{moreError}</span>
                <button onClick={loadMorePosts} className="font-bold text-[var(--color-cyan)] hover:underline">Try again</button>
              </div>
            )}
            {nextCursor && (
              <div className="text-center">
                <button
                  onClick={loadMorePosts}
                  disabled={loadingMore}
                  className="rounded-full neon-rgb-border px-6 py-2 text-xs font-bold text-[var(--color-cyan)] transition-colors hover:bg-[var(--color-cyan)]/10 disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "Load more posts"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
