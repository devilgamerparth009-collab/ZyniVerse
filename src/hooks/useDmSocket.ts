"use client";

import { useEffect, useRef } from "react";
import { getSocket, type DmMessage, type DmReactionEvent, type DmTypingEvent, type DmSeenEvent, type DmDeleteEvent } from "@/lib/socket";

export interface DmHandlers {
  onMessage?: (msg: DmMessage) => void;
  onReaction?: (ev: DmReactionEvent) => void;
  onTyping?: (ev: DmTypingEvent) => void;
  onSeen?: (ev: DmSeenEvent) => void;
  onDelete?: (ev: DmDeleteEvent) => void;
}

type DmHandlerArg = DmHandlers | ((msg: DmMessage) => void);

function normalize(arg: DmHandlerArg): DmHandlers {
  if (typeof arg === "function") return { onMessage: arg };
  return arg;
}

export function useDmSocket(userId: string | undefined, handlers: DmHandlerArg) {
  const handlersRef = useRef<DmHandlers>({});

  useEffect(() => {
    handlersRef.current = normalize(handlers);
  });

  useEffect(() => {
    if (!userId) return;

    // socket.io only exists when a standalone server is configured (Railway et
    // al). Without NEXT_PUBLIC_WS_URL the fallback in `lib/socket` would dial the
    // current origin's `/api/socketio`, which does not exist on Vercel and would
    // reconnect forever. Supabase Realtime (useDmRealtime) is the transport in
    // that case, so skip socket.io entirely.
    if (!process.env.NEXT_PUBLIC_WS_URL) return;

    const socket = getSocket();

    const onConnect = () => {
      socket.emit("dm-join", { userId });
    };
    const onMessage = (msg: DmMessage) => handlersRef.current.onMessage?.(msg);
    const onReaction = (ev: DmReactionEvent) => handlersRef.current.onReaction?.(ev);
    const onTyping = (ev: DmTypingEvent) => handlersRef.current.onTyping?.(ev);
    const onSeen = (ev: DmSeenEvent) => handlersRef.current.onSeen?.(ev);
    const onDelete = (ev: DmDeleteEvent) => handlersRef.current.onDelete?.(ev);

    socket.on("connect", onConnect);
    socket.on("dm-message", onMessage);
    socket.on("dm-reaction", onReaction);
    socket.on("dm-typing", onTyping);
    socket.on("dm-seen", onSeen);
    socket.on("dm-delete", onDelete);
    if (socket.connected) onConnect();
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("dm-message", onMessage);
      socket.off("dm-reaction", onReaction);
      socket.off("dm-typing", onTyping);
      socket.off("dm-seen", onSeen);
      socket.off("dm-delete", onDelete);
    };
  }, [userId]);
}
