"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PartyUser } from "@/lib/socket";
import { usePartySignal } from "@/lib/party-signal";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

interface VoiceParticipant {
  user: PartyUser;
  socketId: string;
  isSpeaking: boolean;
  audioStream?: MediaStream;
}

/**
 * Voice chat over WebRTC. Only the signalling transport changed: it now goes
 * through `usePartySignal` (Supabase Realtime on Vercel, socket.io when a
 * standalone server is configured). The media path is still peer-to-peer.
 */
export function useVoiceChat({
  partyId,
  user,
  isMember,
  hostId,
}: {
  partyId: string;
  user: PartyUser | null;
  isMember: boolean;
  hostId?: string | null;
}) {
  const [voiceActive, setVoiceActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const speakingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const analyserRef = useRef<Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>>(new Map());
  const speakingCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userId = user?.id ?? null;
  // Kept up to date in an effect so the latest user is available to callbacks
  // without writing to a ref during render (which breaks React Compiler/refs rules).
  const userRef = useRef<PartyUser | null>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Stable for the lifetime of the room, so effects below do not re-subscribe
  // on every render (playback ticks re-render this component often).
  const signal = usePartySignal({
    partyId,
    userId,
    hostId: hostId ?? null,
    username: user?.username,
    avatar: user?.avatar ?? null,
    scope: "voice",
  });

  // Cleanup function
  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();

    audioElementsRef.current.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    audioElementsRef.current.clear();

    analyserRef.current.forEach(({ source }) => {
      try { source.disconnect(); } catch { /* ignore */ }
    });
    analyserRef.current.clear();

    speakingTimersRef.current.forEach((t) => clearTimeout(t));
    speakingTimersRef.current.clear();

    if (speakingCheckRef.current) {
      clearInterval(speakingCheckRef.current);
      speakingCheckRef.current = null;
    }
  }, []);

  // Create a peer connection for a remote user
  const createPeerConnection = useCallback(
    (remoteSocketId: string, remoteUser: PartyUser) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          signal.emit("voice-ice-candidate", {
            partyId,
            targetId: remoteSocketId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (!stream) return;

        let audioEl = audioElementsRef.current.get(remoteSocketId);
        if (!audioEl) {
          audioEl = document.createElement("audio");
          audioEl.autoplay = true;
          audioEl.style.display = "none";
          document.body.appendChild(audioEl);
          audioElementsRef.current.set(remoteSocketId, audioEl);
        }
        audioEl.srcObject = stream;

        try {
          const audioCtx = new AudioContext();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current.set(remoteSocketId, { analyser, source });
        } catch { /* ignore */ }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          pc.close();
          peersRef.current.delete(remoteSocketId);
          audioElementsRef.current.get(remoteSocketId)?.remove();
          audioElementsRef.current.delete(remoteSocketId);
          analyserRef.current.delete(remoteSocketId);
          setParticipants((prev) => prev.filter((p) => p.socketId !== remoteSocketId));
        }
      };

      peersRef.current.set(remoteSocketId, pc);
      setParticipants((prev) => {
        const exists = prev.some((p) => p.socketId === remoteSocketId);
        if (exists) return prev;
        return [...prev, { user: remoteUser, socketId: remoteSocketId, isSpeaking: false }];
      });

      return pc;
    },
    [partyId, signal]
  );

  // Signalling handlers
  useEffect(() => {
    if (!userId || !isMember) return;

    const handleVoiceUserJoined = async ({ user: remoteUser, socketId: remoteSocketId }: { user: PartyUser; socketId: string }) => {
      if (remoteSocketId === signal.id) return;
      if (!voiceActive) return;

      // Existing user creates the offer to the new user.
      const pc = createPeerConnection(remoteSocketId, remoteUser);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      signal.emit("voice-offer", {
        partyId,
        targetId: remoteSocketId,
        offer: pc.localDescription!.toJSON(),
        fromUser: userRef.current,
      });
    };

    const handleVoiceUserLeft = ({ socketId: remoteSocketId }: { user: PartyUser; socketId: string }) => {
      const pc = peersRef.current.get(remoteSocketId);
      if (pc) {
        pc.close();
        peersRef.current.delete(remoteSocketId);
      }
      audioElementsRef.current.get(remoteSocketId)?.remove();
      audioElementsRef.current.delete(remoteSocketId);
      analyserRef.current.delete(remoteSocketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== remoteSocketId));
    };

    const handleVoiceOffer = async ({ offer, fromUser: remoteUser, fromSocketId: remoteSocketId }: { offer: RTCSessionDescriptionInit; fromUser: PartyUser; fromSocketId: string }) => {
      if (!voiceActive) return;
      if (!remoteSocketId || remoteSocketId === signal.id) return;

      const pc = createPeerConnection(remoteSocketId, remoteUser);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      signal.emit("voice-answer", {
        partyId,
        targetId: remoteSocketId,
        answer: pc.localDescription!.toJSON(),
      });
    };

    const handleVoiceAnswer = async ({ answer, fromSocketId: remoteSocketId }: { answer: RTCSessionDescriptionInit; fromSocketId: string }) => {
      const pc = peersRef.current.get(remoteSocketId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleVoiceIceCandidate = async ({ candidate, fromSocketId: remoteSocketId }: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
      const pc = peersRef.current.get(remoteSocketId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch { /* ignore */ }
      }
    };

    const handleVoiceSpeaking = ({ socketId: remoteSocketId, isSpeaking }: { user: PartyUser; isSpeaking: boolean; socketId: string }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === remoteSocketId ? { ...p, isSpeaking } : p))
      );
      setSpeakingMap((prev) => ({ ...prev, [remoteSocketId]: isSpeaking }));
    };

    signal.on("voice-user-joined", handleVoiceUserJoined);
    signal.on("voice-user-left", handleVoiceUserLeft);
    signal.on("voice-offer", handleVoiceOffer);
    signal.on("voice-answer", handleVoiceAnswer);
    signal.on("voice-ice-candidate", handleVoiceIceCandidate);
    signal.on("voice-speaking", handleVoiceSpeaking);

    return () => {
      signal.off("voice-user-joined", handleVoiceUserJoined);
      signal.off("voice-user-left", handleVoiceUserLeft);
      signal.off("voice-offer", handleVoiceOffer);
      signal.off("voice-answer", handleVoiceAnswer);
      signal.off("voice-ice-candidate", handleVoiceIceCandidate);
      signal.off("voice-speaking", handleVoiceSpeaking);
    };
  }, [userId, isMember, voiceActive, partyId, createPeerConnection, signal]);

  // Speaking detection - check audio levels periodically
  useEffect(() => {
    if (!voiceActive || muted) {
      if (speakingCheckRef.current) {
        clearInterval(speakingCheckRef.current);
        speakingCheckRef.current = null;
      }
      return;
    }

    const dataArray = new Uint8Array(128);
    let lastBroadcast = 0;

    speakingCheckRef.current = setInterval(() => {
      analyserRef.current.forEach(({ analyser }, socketId) => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const isSpeaking = avg > 20;

        setSpeakingMap((prev) => {
          if (prev[socketId] !== isSpeaking) {
            return { ...prev, [socketId]: isSpeaking };
          }
          return prev;
        });
      });

      // Local mic level -> broadcast. Throttled: the UI can update at 150 ms,
      // but one signalling message per 400 ms is plenty for a speaking dot.
      if (localStreamRef.current && !muted) {
        const now = Date.now();
        if (now - lastBroadcast < 400) return;
        const localAnalyser = analyserRef.current.get("local");
        if (localAnalyser) {
          localAnalyser.analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          lastBroadcast = now;

          signal.emit("voice-speaking", {
            partyId,
            user: userRef.current,
            isSpeaking: avg > 20,
          });
        }
      }
    }, 150);

    return () => {
      if (speakingCheckRef.current) {
        clearInterval(speakingCheckRef.current);
        speakingCheckRef.current = null;
      }
    };
  }, [voiceActive, muted, partyId, signal]);

  // Start voice chat
  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });

      localStreamRef.current = stream;
      setVoiceActive(true);

      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current.set("local", { analyser, source });
      } catch { /* ignore */ }

      signal.emit("voice-join", { partyId, user: userRef.current });
    } catch {
      console.error("Could not access microphone");
    }
  }, [partyId, signal]);

  // Stop voice chat
  const stopVoice = useCallback(() => {
    signal.emit("voice-leave", { partyId, user: userRef.current });
    cleanup();
    setVoiceActive(false);
    setMuted(false);
    setParticipants([]);
    setSpeakingMap({});
  }, [partyId, signal, cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const newMuted = !muted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted;
    });
    setMuted(newMuted);
  }, [muted]);

  // Cleanup on unmount
  const voiceActiveRef = useRef(false);
  useEffect(() => {
    voiceActiveRef.current = voiceActive;
  }, [voiceActive]);

  useEffect(() => {
    return () => {
      cleanup();
      if (voiceActiveRef.current) {
        signal.emit("voice-leave", { partyId, user: userRef.current });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    voiceActive,
    muted,
    participants,
    speakingMap,
    startVoice,
    stopVoice,
    toggleMute,
  };
}
