"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { DmSeenEvent, DmTypingEvent } from "@/lib/socket";

/**
 * Supabase Realtime transport for DMs — the Vercel-friendly replacement for the
 * socket.io server in `server.ts`.
 *
 * Why this works on Vercel: the browser opens the websocket straight to
 * Supabase, so no long-lived connection ever touches a serverless function. The
 * API routes only publish a tiny pointer over plain HTTP (see
 * `broadcastToConversation` in `src/lib/chat.ts`); the message body itself is
 * always fetched through the authenticated `/api/chat/messages` route.
 *
 * Runs alongside `useDmSocket` on purpose. Only one transport is ever published
 * to at a time (the server picks socket.io when NEXT_PUBLIC_WS_URL is set,
 * Supabase otherwise), and every handler here is idempotent, so having both
 * subscribed can never double-apply an event.
 */
export interface DmRealtimeHandlers {
  /** New message, reaction change, or deletion in this conversation. */
  onActivity?: (conversationId: string) => void;
  onTyping?: (ev: DmTypingEvent) => void;
  onSeen?: (ev: DmSeenEvent) => void;
}

export function useDmRealtime(
  userId: string | undefined,
  handlers: DmRealtimeHandlers,
) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!userId) return;
    // Missing config must never break the page — MessagesClient still polls.
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return;
    }

    let channel: RealtimeChannel | null = null;

    try {
      const supabase = getSupabase();
      channel = supabase.channel(`dm:${userId}`, {
        config: { broadcast: { self: false } },
      });

      const payloadOf = <T,>(msg: { [key: string]: unknown }): T =>
        (msg.payload ?? {}) as T;

      channel
        .on("broadcast", { event: "dm-message" }, (msg) => {
          const p = payloadOf<{ conversationId?: string }>(msg);
          if (p.conversationId) handlersRef.current.onActivity?.(p.conversationId);
        })
        .on("broadcast", { event: "dm-reaction" }, (msg) => {
          const p = payloadOf<{ conversationId?: string }>(msg);
          if (p.conversationId) handlersRef.current.onActivity?.(p.conversationId);
        })
        .on("broadcast", { event: "dm-delete" }, (msg) => {
          const p = payloadOf<{ conversationId?: string }>(msg);
          if (p.conversationId) handlersRef.current.onActivity?.(p.conversationId);
        })
        .on("broadcast", { event: "dm-typing" }, (msg) => {
          const p = payloadOf<DmTypingEvent>(msg);
          if (p.conversationId) handlersRef.current.onTyping?.(p);
        })
        .on("broadcast", { event: "dm-seen" }, (msg) => {
          const p = payloadOf<DmSeenEvent>(msg);
          if (p.conversationId) handlersRef.current.onSeen?.(p);
        })
        .subscribe();
    } catch {
      // Realtime unavailable (network, blocked socket, bad config): fall back to
      // the existing polling in MessagesClient. Nothing to clean up.
      return;
    }

    return () => {
      if (!channel) return;
      try {
        getSupabase().removeChannel(channel);
      } catch {
        // ignore teardown errors
      }
    };
  }, [userId]);
}
