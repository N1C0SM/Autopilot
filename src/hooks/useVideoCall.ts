import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { RealtimeChannel } from "@supabase/supabase-js";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
];

export type CallState = "idle" | "calling" | "incoming" | "connected" | "ended";

type SignalType = "offer" | "answer" | "ice" | "hangup" | "decline";

interface Signal {
  type: SignalType;
  from: string;
  data?: unknown;
}

/**
 * Videollamada 1:1 dentro de la app (WebRTC + señalización por Realtime).
 * El canal es `call-{conversationUserId}`: el cliente y su entrenador/admin.
 */
export function useVideoCall(conversationUserId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<CallState>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);

  const send = useCallback(
    (type: SignalType, data?: unknown) => {
      if (!channelRef.current || !user) return;
      channelRef.current.send({
        type: "broadcast",
        event: "signal",
        payload: { type, from: user.id, data } satisfies Signal,
      });
    },
    [user]
  );

  const cleanup = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    pendingOffer.current = null;
    pendingIce.current = [];
    setMicOn(true);
    setCamOn(true);
  }, []);

  const endLocal = useCallback(
    (next: CallState = "ended") => {
      cleanup();
      setState(next);
      if (next === "ended") setTimeout(() => setState("idle"), 1200);
    },
    [cleanup]
  );

  const getMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true,
    });
    localRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const createPc = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate) send("ice", e.candidate.toJSON());
    };
    pc.ontrack = (e) => setRemoteStream(e.streams[0]);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setState("connected");
      if (pc.connectionState === "failed" || pc.connectionState === "closed") endLocal();
    };
    pcRef.current = pc;
    return pc;
  }, [send, endLocal]);

  const drainIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of pendingIce.current) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* candidato obsoleto */
      }
    }
    pendingIce.current = [];
  }, []);

  /** Inicia la llamada (entrenador). */
  const startCall = useCallback(async () => {
    setError(null);
    try {
      const stream = await getMedia();
      const pc = createPc();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setState("calling");
      send("offer", offer);
    } catch (e) {
      cleanup();
      setState("idle");
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Necesitas permitir cámara y micrófono para llamar."
          : "No se pudo iniciar la llamada."
      );
    }
  }, [getMedia, createPc, send, cleanup]);

  /** Acepta una llamada entrante (cliente). */
  const accept = useCallback(async () => {
    if (!pendingOffer.current) return;
    setError(null);
    try {
      const stream = await getMedia();
      const pc = createPc();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(pendingOffer.current);
      await drainIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send("answer", answer);
      setState("connected");
    } catch (e) {
      cleanup();
      setState("idle");
      send("decline");
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Necesitas permitir cámara y micrófono para responder."
          : "No se pudo conectar la llamada."
      );
    }
  }, [getMedia, createPc, drainIce, send, cleanup]);

  const decline = useCallback(() => {
    send("decline");
    endLocal("idle");
  }, [send, endLocal]);

  const hangup = useCallback(() => {
    send("hangup");
    endLocal();
  }, [send, endLocal]);

  const toggleMic = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  const toggleCam = useCallback(() => {
    const track = localRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }, []);

  useEffect(() => {
    if (!conversationUserId || !user) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const subscribe = async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase.channel(`call-${conversationUserId}`, {
        config: { broadcast: { self: false }, private: true },
      });
      channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
        const sig = payload as Signal;
        if (!sig || sig.from === user.id) return;
        const pc = pcRef.current;
        switch (sig.type) {
          case "offer":
            if (pc) return; // ya hay una llamada en curso
            pendingOffer.current = sig.data as RTCSessionDescriptionInit;
            setState("incoming");
            break;
          case "answer":
            if (!pc) return;
            await pc.setRemoteDescription(sig.data as RTCSessionDescriptionInit);
            await drainIce();
            break;
          case "ice": {
            const cand = sig.data as RTCIceCandidateInit;
            if (pc?.remoteDescription) {
              try {
                await pc.addIceCandidate(cand);
              } catch {
                /* ignorar */
              }
            } else {
              pendingIce.current.push(cand);
            }
            break;
          }
          case "decline":
            setError("No han contestado la llamada.");
            endLocal("idle");
            break;
          case "hangup":
            endLocal();
            break;
        }
      });
      channel.subscribe();
      channelRef.current = channel;
    };

    subscribe();

    return () => {
      cancelled = true;
      cleanup();
      setState("idle");
      if (channel) supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationUserId, user, drainIce, endLocal, cleanup]);

  return {
    state,
    localStream,
    remoteStream,
    micOn,
    camOn,
    error,
    clearError: () => setError(null),
    startCall,
    accept,
    decline,
    hangup,
    toggleMic,
    toggleCam,
  };
}
