"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getSocket } from "./socket";
import { getSupabase } from "./supabase";

/**
 * WebRTC signalling for voice chat and screen sharing.
 *
 * The original implementation used the socket.io server in `server.ts`, which
 * cannot run on Vercel. This module keeps the exact same event vocabulary but
 * carries the signalling messages over a Supabase Realtime broadcast channel, so
 * the peer-to-peer media path (WebRTC) is unchanged and only the "switchboard"
 * moved.
 *
 * `server.ts` did a few routing tricks that the browser must now do itself:
 *
 *   emit                       -> delivered to
 *   voice-join                 -> everyone else as `voice-user-joined`
 *   voice-leave                -> everyone else as `voice-user-left`
 *   voice-offer  {targetId}    -> that peer only, as `voice-offer`
 *   voice-answer {targetId}    -> that peer only, as `voice-answer`
 *   voice-ice-candidate        -> that peer only
 *   voice-speaking             -> everyone else
 *   webrtc-viewer-ready        -> the host, as `webrtc-viewer-join`
 *   webrtc-offer {targetId}    -> that viewer, as `webrtc-offer-viewer`
 *   webrtc-viewer-answer       -> the host, as `webrtc-viewer-answer`
 *   webrtc-ice-candidate       -> host<->viewer, event name depends on sender
 *   screen-share-started/stopped -> everyone else, as `*-viewers`
 *
 * The peer id is the user id (socket.io used a per-connection id). One tab per
 * user in a party is the normal case; a second tab would share the identity.
 */

export interface SignalOptions {
  partyId: string;
  userId: string | null;
  /** Needed to recognise the host and to route host-only signalling. */
  hostId?: string | null;
  username?: string;
  avatar?: string | null;
  /**
   * Namespace for the broadcast channel. Voice chat and screen sharing never
   * exchange events, but they run in the same browser tab, and Supabase
   * Realtime only allows one live channel per topic per client — a second join
   * on the same topic silently never completes. Giving each feature its own
   * scope keeps both alive.
   */
  scope?: "voice" | "screen";
}

/** The subset of socket.io's client that the media components rely on. */
export interface PartySignal {
  readonly id: string;
  readonly connected: boolean;
  emit(event: string, data?: unknown): void;
  on<T>(event: string, handler: (payload: T) => void): void;
  off<T>(event: string, handler: (payload: T) => void): void;
  update?(options: SignalOptions): void;
  dispose?(): void;
}

const CHANNEL_EVENT = "sig";

/**
 * `client` exists so tests can drive several independent "browsers" (each with
 * its own Realtime socket) in one process. Production callers omit it.
 */
export function createSupabaseSignal(
  initial: SignalOptions,
  client?: SupabaseClient,
): PartySignal {
  let options = { ...initial };
  const handlers = new Map<string, Set<(payload: unknown) => void>>();
  const outbox: { event: string; data?: unknown }[] = [];
  let channel: RealtimeChannel | null = null;
  let connected = false;
  let disposed = false;

  const isHost = () => !!options.hostId && options.userId === options.hostId;

  function emitLocal(event: string, payload?: unknown) {
    const set = handlers.get(event);
    if (!set) return;
    // Copy first: a listener may unsubscribe itself while we iterate.
    for (const handler of Array.from(set)) {
      try {
        handler(payload);
      } catch {
        // A broken listener must never stop the other listeners.
      }
    }
  }

  function deliver(event: string, data: unknown, from: string) {
    if (!from || from === options.userId) return;
    const { partyId } = options;
    const fromHost = !!options.hostId && from === options.hostId;
    const payload = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    const target = payload.targetId;

    switch (event) {
      case "voice-join":
        emitLocal("voice-user-joined", { user: payload.user, socketId: from });
        break;
      case "voice-leave":
        emitLocal("voice-user-left", { user: payload.user, socketId: from });
        break;
      case "voice-offer":
        if (target !== options.userId) break;
        emitLocal("voice-offer", {
          offer: payload.offer,
          fromUser: payload.fromUser,
          fromSocketId: from,
          partyId,
        });
        break;
      case "voice-answer":
        if (target !== options.userId) break;
        emitLocal("voice-answer", { answer: payload.answer, fromSocketId: from, partyId });
        break;
      case "voice-ice-candidate":
        if (target !== options.userId) break;
        emitLocal("voice-ice-candidate", {
          candidate: payload.candidate,
          fromSocketId: from,
          partyId,
        });
        break;
      case "voice-speaking":
        emitLocal("voice-speaking", {
          user: payload.user,
          isSpeaking: !!payload.isSpeaking,
          socketId: from,
        });
        break;
      case "webrtc-viewer-ready":
        if (!isHost()) break;
        emitLocal("webrtc-viewer-join", { viewerId: from, partyId });
        break;
      case "webrtc-offer":
        if (target !== options.userId) break;
        emitLocal("webrtc-offer-viewer", { offer: payload.offer, partyId, hostId: from });
        break;
      case "webrtc-viewer-answer":
        if (!isHost()) break;
        emitLocal("webrtc-viewer-answer", { viewerId: from, answer: payload.answer, partyId });
        break;
      case "webrtc-ice-candidate":
        if (target !== options.userId) break;
        emitLocal(
          fromHost ? "webrtc-ice-candidate-viewer" : "webrtc-ice-candidate-host",
          { candidate: payload.candidate, partyId, senderId: from },
        );
        break;
      case "screen-share-started":
        if (!fromHost) break;
        emitLocal("screen-share-started-viewers", { partyId });
        break;
      case "screen-share-stopped":
        if (!fromHost) break;
        emitLocal("screen-share-stopped-viewers", { partyId });
        break;
      default:
        break;
    }
  }

  function sendNow(event: string, data?: unknown) {
    if (!channel) return;
    channel
      .send({
        type: "broadcast",
        event: CHANNEL_EVENT,
        payload: { ev: event, data: data ?? {}, from: options.userId },
      })
      .catch(() => {
        // Realtime hiccup: WebRTC will simply retry on the next negotiation.
      });
  }

  function ensureChannel() {
    if (channel || disposed || !options.userId) return;
    const supabase = client ?? getSupabase();
    const topic = `signal:${options.partyId}:${options.scope ?? "voice"}`;
    channel = supabase.channel(topic, {
      config: { broadcast: { self: false } },
    });
    channel.on("broadcast", { event: CHANNEL_EVENT }, (msg: { payload?: unknown }) => {
      const payload = msg?.payload;
      if (!payload || typeof payload !== "object") return;
      const envelope = payload as { ev?: unknown; data?: unknown; from?: unknown };
      if (typeof envelope.ev !== "string" || typeof envelope.from !== "string") return;
      deliver(envelope.ev, envelope.data, envelope.from);
    });
    channel.subscribe((status) => {
      connected = status === "SUBSCRIBED";
      if (!connected) return;
      // Anything emitted before the channel was ready goes out now.
      const pending = outbox.splice(0);
      for (const message of pending) sendNow(message.event, message.data);
    });
  }

  // Events that describe durable state; only the newest one matters while the
  // channel is still connecting.
  const STATEFUL = new Set(["voice-join", "voice-leave", "screen-share-started", "screen-share-stopped"]);

  return {
    get id() {
      return options.userId ?? "";
    },
    get connected() {
      return connected;
    },
    emit(event, data) {
      if (disposed || !options.userId) return;
      ensureChannel();
      if (connected) {
        sendNow(event, data);
        return;
      }
      if (STATEFUL.has(event)) {
        const previous = outbox.findIndex((message) => message.event === event);
        if (previous >= 0) outbox.splice(previous, 1);
      }
      outbox.push({ event, data });
    },
    on<T>(event: string, handler: (payload: T) => void) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler as (payload: unknown) => void);
      ensureChannel();
    },
    off<T>(event: string, handler: (payload: T) => void) {
      handlers.get(event)?.delete(handler as (payload: unknown) => void);
    },
    update(next) {
      options = { ...options, ...next };
    },
    dispose() {
      disposed = true;
      handlers.clear();
      outbox.length = 0;
      const closing = channel;
      channel = null;
      connected = false;
      if (!closing) return;
      try {
        (client ?? getSupabase()).removeChannel(closing);
      } catch {
        // Channel already gone.
      }
    },
  };
}

/**
 * Supabase signalling is used whenever no standalone socket.io server is
 * configured — i.e. the normal Vercel deployment.
 */
const USE_SUPABASE_SIGNAL =
  !process.env.NEXT_PUBLIC_WS_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Returns the signalling transport for a party: the real socket.io client when
 * one is configured, otherwise the Supabase shim. Both expose the same shape, so
 * callers never need to know which one is live.
 */
function createSignal(options: SignalOptions): PartySignal {
  return USE_SUPABASE_SIGNAL
    ? createSupabaseSignal(options)
    : (getSocket() as unknown as PartySignal);
}

export function usePartySignal(options: SignalOptions): PartySignal {
  const key = `${options.partyId}:${options.userId ?? ""}:${options.scope ?? "voice"}`;
  const [entry, setEntry] = useState(() => ({ key, signal: createSignal(options) }));

  // Adjust state during render when the room key changes, so the returned
  // transport is always in sync with the current party. Disposal stays out of
  // render (a render may be discarded) and happens in the effect below.
  if (entry.key !== key) {
    setEntry({ key, signal: createSignal(options) });
  }

  const signal = entry.signal;

  // hostId / username can arrive after the first render (party fetch, session).
  useEffect(() => {
    signal.update?.(options);
  });

  useEffect(() => {
    return () => {
      // Deferred a tick so StrictMode's setup → cleanup → setup probe does not
      // dispose a transport that is still in use.
      void Promise.resolve().then(() => {
        signal.dispose?.();
      });
    };
  }, [signal]);

  return signal;
}
