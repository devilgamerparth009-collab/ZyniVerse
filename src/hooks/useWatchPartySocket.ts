"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSocket, type PartyUser, type ChatMessage, type Reaction, type SyncState } from "@/lib/socket";
import { getSupabase } from "@/lib/supabase";

interface UseWatchPartySocketOptions {
  partyId: string;
  user: PartyUser | null;
  isHost: boolean;
  /**
   * Needed by the Supabase transport to reject host-only events (play/pause/
   * seek/episode/video) that did not come from the real host. On socket.io the
   * server enforces this; on Realtime the receivers verify it client-side.
   */
  hostId?: string | null;
  onSyncState?: (state: SyncState) => void;
  onNewMessage?: (msg: ChatMessage) => void;
  onNewReaction?: (reaction: Reaction) => void;
  onMemberJoined?: (data: { user: PartyUser; members: string[] }) => void;
  onMemberLeft?: (data: { user: PartyUser; members: string[] }) => void;
  onEpisodeChange?: (data: { episode: number }) => void;
  onVideoUpdated?: (data: { videoUrl: string; videoType: string }) => void;
  onPlay?: (data: { playbackPos: number; timestamp: number }) => void;
  onPause?: (data: { playbackPos: number; timestamp: number }) => void;
  onSeek?: (data: { playbackPos: number; timestamp: number }) => void;
  onScreenShareStarted?: () => void;
  onScreenShareStopped?: () => void;
}

/**
 * Transport is picked once, at module load:
 *
 *   1. socket.io — only when a standalone server (e.g. Railway) is configured
 *      through NEXT_PUBLIC_WS_URL. Unchanged behaviour.
 *   2. Supabase Realtime Broadcast — the default, because it works on Vercel:
 *      the browser holds the websocket to Supabase and no serverless function
 *      is involved. Playback, chat, reactions, episode and video-source events
 *      all travel over the party channel.
 *
 * Both transports emit and consume the same event names, so WatchPartyRoom does
 * not need to know which one is live.
 */
const USE_SUPABASE =
  !process.env.NEXT_PUBLIC_WS_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function useWatchPartySocket(options: UseWatchPartySocketOptions) {
  const { partyId, user, isHost } = options;
  const userId = user?.id ?? null;

  const [connected, setConnected] = useState(false);
  const [socketAvailable, setSocketAvailable] = useState(false);
  const callbacksRef = useRef(options);
  const userRef = useRef<PartyUser | null>(user);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    callbacksRef.current = options;
    userRef.current = user;
  });

  useEffect(() => {
    if (!userId || !partyId) return;

    if (USE_SUPABASE) {
      let channel: RealtimeChannel | null = null;

      try {
        const supabase = getSupabase();
        channel = supabase.channel(`party:${partyId}`, {
          config: { broadcast: { self: false } },
        });

        const payloadOf = <T,>(msg: { [key: string]: unknown }): T =>
          (msg.payload ?? {}) as T;

        // Host-only events are applied only when they really came from the host.
        // `from` is the sender's user id, added by the emit helpers below.
        const fromHost = (p: { from?: unknown }) => {
          const expected = callbacksRef.current.hostId;
          if (!expected) return true; // party not loaded yet
          return p?.from === expected;
        };

        channel
          .on("broadcast", { event: "sync-state" }, (msg) => {
            const p = payloadOf<SyncState & { from?: string }>(msg);
            if (!fromHost(p)) return;
            callbacksRef.current.onSyncState?.(p);
          })
          .on("broadcast", { event: "play" }, (msg) => {
            const p = payloadOf<{ playbackPos: number; timestamp: number; from?: string }>(msg);
            if (!fromHost(p)) return;
            callbacksRef.current.onPlay?.(p);
          })
          .on("broadcast", { event: "pause" }, (msg) => {
            const p = payloadOf<{ playbackPos: number; timestamp: number; from?: string }>(msg);
            if (!fromHost(p)) return;
            callbacksRef.current.onPause?.(p);
          })
          .on("broadcast", { event: "seek" }, (msg) => {
            const p = payloadOf<{ playbackPos: number; timestamp: number; from?: string }>(msg);
            if (!fromHost(p)) return;
            callbacksRef.current.onSeek?.(p);
          })
          .on("broadcast", { event: "episode-change" }, (msg) => {
            const p = payloadOf<{ episode: number; from?: string }>(msg);
            if (!fromHost(p)) return;
            callbacksRef.current.onEpisodeChange?.(p);
          })
          .on("broadcast", { event: "video-updated" }, (msg) => {
            const p = payloadOf<{ videoUrl: string; videoType: string; from?: string }>(msg);
            if (!fromHost(p)) return;
            callbacksRef.current.onVideoUpdated?.(p);
          })
          .on("broadcast", { event: "new-message" }, (msg) => {
            callbacksRef.current.onNewMessage?.(payloadOf<ChatMessage>(msg));
          })
          .on("broadcast", { event: "new-reaction" }, (msg) => {
            callbacksRef.current.onNewReaction?.(payloadOf<Reaction>(msg));
          })
          .on("broadcast", { event: "member-joined" }, (msg) => {
            callbacksRef.current.onMemberJoined?.(
              payloadOf<{ user: PartyUser; members: string[] }>(msg),
            );
          })
          .on("broadcast", { event: "member-left" }, (msg) => {
            callbacksRef.current.onMemberLeft?.(
              payloadOf<{ user: PartyUser; members: string[] }>(msg),
            );
          })
          .on("broadcast", { event: "screen-share-started-viewers" }, () => {
            callbacksRef.current.onScreenShareStarted?.();
          })
          .on("broadcast", { event: "screen-share-stopped-viewers" }, () => {
            callbacksRef.current.onScreenShareStopped?.();
          })
          .subscribe((status) => {
            setConnected(status === "SUBSCRIBED");
          });

        channelRef.current = channel;
      } catch {
        // Realtime unavailable — the 10s polling fallback in WatchPartyRoom
        // keeps playback roughly in sync.
        setConnected(false);
        return;
      }

      return () => {
        channelRef.current = null;
        setConnected(false);
        if (!channel) return;
        try {
          getSupabase().removeChannel(channel);
        } catch {
          // ignore teardown errors
        }
      };
    }

    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      setSocketAvailable(true);
      socket.emit("join-party", { partyId, user: userRef.current, isHost });
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onConnectError = () => {
      setSocketAvailable(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    socket.on("sync-state", (state: SyncState) => callbacksRef.current.onSyncState?.(state));
    socket.on("new-message", (msg: ChatMessage) => callbacksRef.current.onNewMessage?.(msg));
    socket.on("new-reaction", (r: Reaction) => callbacksRef.current.onNewReaction?.(r));
    socket.on("member-joined", (d: { user: PartyUser; members: string[] }) => callbacksRef.current.onMemberJoined?.(d));
    socket.on("member-left", (d: { user: PartyUser; members: string[] }) => callbacksRef.current.onMemberLeft?.(d));
    socket.on("episode-change", (d: { episode: number }) => callbacksRef.current.onEpisodeChange?.(d));
    socket.on("video-updated", (d: { videoUrl: string; videoType: string }) => callbacksRef.current.onVideoUpdated?.(d));
    socket.on("play", (d: { playbackPos: number; timestamp: number }) => callbacksRef.current.onPlay?.(d));
    socket.on("pause", (d: { playbackPos: number; timestamp: number }) => callbacksRef.current.onPause?.(d));
    socket.on("seek", (d: { playbackPos: number; timestamp: number }) => callbacksRef.current.onSeek?.(d));
    socket.on("screen-share-started-viewers", () => callbacksRef.current.onScreenShareStarted?.());
    socket.on("screen-share-stopped-viewers", () => callbacksRef.current.onScreenShareStopped?.());

    socket.connect();

    return () => {
      socket.emit("leave-party", { partyId });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("sync-state");
      socket.off("new-message");
      socket.off("new-reaction");
      socket.off("member-joined");
      socket.off("member-left");
      socket.off("episode-change");
      socket.off("video-updated");
      socket.off("play");
      socket.off("pause");
      socket.off("seek");
      socket.off("screen-share-started-viewers");
      socket.off("screen-share-stopped-viewers");
      socket.disconnect();
    };
    // `user` is an inline object in WatchPartyRoom, so depend on its id instead
    // of the object identity — otherwise every render tore the transport down
    // and reconnected.
  }, [partyId, userId, isHost]);

  const publish = useCallback((event: string, payload: Record<string, unknown>) => {
    const channel = channelRef.current;
    if (!channel) return;
    try {
      channel.send({ type: "broadcast", event, payload }).catch(() => {});
    } catch {
      // channel already closed
    }
  }, []);

  const emitHostSync = useCallback((isPlaying: boolean, playbackPos: number, episode: number) => {
    if (!isHost) return;
    if (USE_SUPABASE) {
      publish("sync-state", { isPlaying, playbackPos, episode, timestamp: Date.now(), from: userId });
      return;
    }
    if (!socketAvailable) return;
    getSocket().emit("host-sync", { partyId, isPlaying, playbackPos, episode });
  }, [partyId, isHost, socketAvailable, publish, userId]);

  const emitHostPlay = useCallback((playbackPos: number) => {
    if (!isHost) return;
    if (USE_SUPABASE) {
      publish("play", { playbackPos, timestamp: Date.now(), from: userId });
      return;
    }
    if (!socketAvailable) return;
    getSocket().emit("host-play", { partyId, playbackPos });
  }, [partyId, isHost, socketAvailable, publish, userId]);

  const emitHostPause = useCallback((playbackPos: number) => {
    if (!isHost) return;
    if (USE_SUPABASE) {
      publish("pause", { playbackPos, timestamp: Date.now(), from: userId });
      return;
    }
    if (!socketAvailable) return;
    getSocket().emit("host-pause", { partyId, playbackPos });
  }, [partyId, isHost, socketAvailable, publish, userId]);

  const emitHostSeek = useCallback((playbackPos: number) => {
    if (!isHost) return;
    if (USE_SUPABASE) {
      publish("seek", { playbackPos, timestamp: Date.now(), from: userId });
      return;
    }
    if (!socketAvailable) return;
    getSocket().emit("host-seek", { partyId, playbackPos });
  }, [partyId, isHost, socketAvailable, publish, userId]);

  const emitHostEpisode = useCallback((episode: number) => {
    if (!isHost) return;
    if (USE_SUPABASE) {
      publish("episode-change", { episode, from: userId });
      return;
    }
    if (!socketAvailable) return;
    getSocket().emit("host-episode", { partyId, episode });
  }, [partyId, isHost, socketAvailable, publish, userId]);

  const emitChatMessage = useCallback((message: string) => {
    if (!userId) return;
    if (USE_SUPABASE) {
      const clean = message.slice(0, 500);
      if (!clean) return;
      publish("new-message", {
        id: `${Date.now()}-${userId}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        username: userRef.current?.username || "User",
        message: clean,
        type: "CHAT",
        createdAt: new Date().toISOString(),
      });
      return;
    }
    if (!socketAvailable) return;
    getSocket().emit("chat-message", { partyId, user: userRef.current, message });
  }, [partyId, socketAvailable, publish, userId]);

  const emitReaction = useCallback((emoji: string) => {
    if (!userId) return;
    if (USE_SUPABASE) {
      const clean = emoji.slice(0, 32);
      if (!clean) return;
      publish("new-reaction", {
        userId,
        username: userRef.current?.username || "User",
        emoji: clean,
      });
      return;
    }
    if (!socketAvailable) return;
    getSocket().emit("reaction", { partyId, user: userRef.current, emoji });
  }, [partyId, socketAvailable, publish, userId]);

  const emitVideoSource = useCallback((videoUrl: string, videoType: string) => {
    if (!isHost) return;
    if (USE_SUPABASE) {
      publish("video-updated", { videoUrl, videoType, from: userId });
      return;
    }
    if (!socketAvailable) return;
    getSocket().emit("video-source", { partyId, videoUrl, videoType });
  }, [partyId, isHost, socketAvailable, publish, userId]);

  return {
    connected,
    socketAvailable,
    socket: socketAvailable ? getSocket() : null,
    emitHostSync,
    emitHostPlay,
    emitHostPause,
    emitHostSeek,
    emitHostEpisode,
    emitChatMessage,
    emitReaction,
    emitVideoSource,
  };
}
