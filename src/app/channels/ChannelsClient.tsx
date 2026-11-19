"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import SocialPageHeader from "@/components/SocialPageHeader";
import { SocialEmpty, SocialError, SocialLoading } from "@/components/SocialStates";
import type { ChannelSummary } from "@/lib/social-types";
import { logError } from "@/lib/logger";

export default function ChannelsClient() {
  const { data: session } = useSession();
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/channels");
      if (!res.ok) throw new Error("Could not load channels");
      const data = await res.json();
      setChannels(data.channels ?? []);
    } catch (e) {
      logError(e);
      setError("We couldn't load channels right now. Please try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadChannels();
  }, [loadChannels]);

  async function toggleSubscribe(channel: ChannelSummary) {
    if (busySlug) return;
    setBusySlug(channel.slug);
    setActionError(null);
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channel.slug)}/subscribe`, {
        method: channel.isSubscribed ? "DELETE" : "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setChannels((prev) =>
          prev.map((c) =>
            c.slug === channel.slug
              ? {
                  ...c,
                  isSubscribed: data.subscribed === true,
                  subscriberCount: typeof data.subscriberCount === "number" ? data.subscriberCount : c.subscriberCount,
                }
              : c
          )
        );
      } else {
        setActionError(data.error ?? "Could not update your subscription.");
      }
    } catch (e) {
      logError(e);
      setActionError("Could not update your subscription. Please try again.");
    }
    setBusySlug(null);
  }

  async function createChannel(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      setFormError("Channel name must be between 2 and 60 characters.");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || undefined,
          iconUrl: iconUrl.trim() || undefined,
          coverUrl: coverUrl.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.channel) {
        setChannels((prev) => [data.channel as ChannelSummary, ...prev]);
        setName("");
        setDescription("");
        setIconUrl("");
        setCoverUrl("");
        setShowCreate(false);
      } else {
        setFormError(data.error ?? "Could not create the channel. Please try again.");
      }
    } catch (e) {
      logError(e);
      setFormError("Could not create the channel. Please try again.");
    }
    setCreating(false);
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <SocialPageHeader
          eyebrow="Broadcasts"
          title="Channels"
          description="Follow channels for updates, announcements, and posts from the people behind them."
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 11a9 9 0 0116 0M7 14a5 5 0 0110 0M12 18h.01M2 8a11 11 0 0120 0" />
            </svg>
          }
        />

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-mute)]">
            {loading ? "Loading channels..." : `${channels.length} channel${channels.length === 1 ? "" : "s"}`}
          </p>
          {session?.user?.id && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-full neon-rgb-border px-5 py-2 text-xs font-bold text-[var(--color-cyan)] transition-colors hover:bg-[var(--color-cyan)]/10"
            >
              {showCreate ? "Cancel" : "Create a channel"}
            </button>
          )}
        </div>

        {showCreate && session?.user?.id && (
          <form onSubmit={createChannel} className="mb-6 space-y-3 rounded-xl neon-rgb-border bg-[var(--color-panel)]/60 p-4 backdrop-blur-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  placeholder="My channel"
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-3 py-2 text-sm outline-none focus:border-[var(--color-cyan)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">Description</span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this channel about?"
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-3 py-2 text-sm outline-none focus:border-[var(--color-cyan)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">Icon URL</span>
                <input
                  type="url"
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-3 py-2 text-sm outline-none focus:border-[var(--color-cyan)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">Cover URL</span>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-3 py-2 text-sm outline-none focus:border-[var(--color-cyan)]"
                />
              </label>
            </div>
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="rounded-full bg-[var(--color-cyan)] px-5 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create channel"}
            </button>
          </form>
        )}

        {actionError && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-300">
            {actionError}
          </div>
        )}

        {loading ? (
          <SocialLoading count={4} height="h-32" />
        ) : error ? (
          <SocialError message={error} onRetry={loadChannels} />
        ) : channels.length === 0 ? (
          <SocialEmpty title="No channels yet." description="Be the first to start one." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {channels.map((channel, i) => (
              <motion.div
                key={channel.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden rounded-2xl neon-rgb-border bg-[var(--color-panel)]/60 backdrop-blur-sm"
              >
                {channel.coverUrl ? (
                  <div
                    className="h-20 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${channel.coverUrl})` }}
                  />
                ) : (
                  <div className="h-20 w-full bg-gradient-to-br from-[var(--color-violet)]/25 via-transparent to-[var(--color-magenta)]/15" />
                )}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[var(--color-magenta)] to-[var(--color-violet)] text-lg font-bold text-black">
                      {channel.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={channel.iconUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        channel.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/channels/${encodeURIComponent(channel.slug)}`} className="truncate font-display text-sm font-bold text-[var(--color-ink)] transition-colors hover:text-[var(--color-cyan)]">
                          {channel.name}
                        </Link>
                        {channel.isOfficial && (
                          <span className="flex items-center gap-1 rounded-full bg-[var(--color-cyan)]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-cyan)]">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>
                            Official
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-[var(--color-mute)]">by {channel.owner.username}</p>
                    </div>
                  </div>

                  {channel.description && (
                    <p className="mt-3 line-clamp-2 text-xs text-[var(--color-mute)]">{channel.description}</p>
                  )}
                  {channel.latestPost && (
                    <p className="mt-2 line-clamp-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[11px] text-[var(--color-mute)]">
                      {channel.latestPost.content}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-mute)]">
                      {channel.subscriberCount} subscriber{channel.subscriberCount === 1 ? "" : "s"} · {channel.postCount} post{channel.postCount === 1 ? "" : "s"}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <Link
                        href={`/channels/${encodeURIComponent(channel.slug)}`}
                        className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-ink)] transition-colors hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]"
                      >
                        View
                      </Link>
                      {session?.user?.id ? (
                        <button
                          onClick={() => toggleSubscribe(channel)}
                          disabled={busySlug === channel.slug}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-all disabled:opacity-50 ${
                            channel.isSubscribed
                              ? "border border-[var(--color-line)] text-[var(--color-mute)] hover:border-red-400 hover:text-red-400"
                              : "bg-[var(--color-cyan)] text-black hover:opacity-90"
                          }`}
                        >
                          {busySlug === channel.slug ? "..." : channel.isSubscribed ? "Unsubscribe" : "Subscribe"}
                        </button>
                      ) : (
                        <Link href="/login" className="rounded-full bg-[var(--color-cyan)] px-3 py-1.5 text-[11px] font-bold text-black">
                          Sign in
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
