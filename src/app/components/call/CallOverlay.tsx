import { useEffect, useRef } from "react";
import { hapticTap } from "@/shared/lib/native";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import type { CallState } from "@/shared/hooks/useVideoCall";

interface Props {
  state: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
  peerName: string;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
}

const CallOverlay = ({
  state,
  localStream,
  remoteStream,
  micOn,
  camOn,
  peerName,
  onAccept,
  onDecline,
  onHangup,
  onToggleMic,
  onToggleCam,
}: Props) => {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  const visible = state !== "idle";
  const statusText =
    state === "incoming"
      ? "Videollamada entrante"
      : state === "calling"
        ? "Llamando…"
        : state === "connected"
          ? remoteStream
            ? "En llamada"
            : "Conectando…"
          : "Llamada finalizada";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex flex-col bg-background"
          style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
        >
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={remoteRef}
              autoPlay
              playsInline
              className="h-full w-full bg-background object-cover"
            />

            {(!remoteStream || state !== "connected") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[22%] bg-card">
                  <Video className="h-8 w-8 text-primary" strokeWidth={1.75} />
                </div>
                <p className="mt-2 type-title1 text-foreground">{peerName}</p>
                <p className="type-body text-muted-foreground">{statusText}</p>
              </div>
            )}

            {localStream && (
              <video
                ref={localRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-4 right-4 h-40 w-28 rounded-2xl bg-secondary object-cover sm:h-52 sm:w-36"
              />
            )}
          </div>

          <div className="flex items-center justify-center gap-6 px-6 pb-4 pt-6">
            {state === "incoming" ? (
              <>
                <button
                  type="button"
                  onClick={() => { void hapticTap(); onDecline(); }}
                  aria-label="Rechazar llamada"
                  className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center transition-transform active:scale-95"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => { void hapticTap(); onAccept(); }}
                  aria-label="Responder llamada"
                  className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-transform active:scale-95"
                >
                  <Video className="w-6 h-6" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { void hapticTap(); onToggleMic(); }}
                  aria-label={micOn ? "Silenciar micrófono" : "Activar micrófono"}
                  className="w-14 h-14 rounded-full bg-secondary text-foreground flex items-center justify-center transition-transform active:scale-95"
                >
                  {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-muted-foreground" />}
                </button>
                <button
                  type="button"
                  onClick={() => { void hapticTap(); onHangup(); }}
                  aria-label="Colgar"
                  className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center transition-transform active:scale-95"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => { void hapticTap(); onToggleCam(); }}
                  aria-label={camOn ? "Apagar cámara" : "Encender cámara"}
                  className="w-14 h-14 rounded-full bg-secondary text-foreground flex items-center justify-center transition-transform active:scale-95"
                >
                  {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-muted-foreground" />}
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CallOverlay;
