import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import type { CallState } from "@/hooks/useVideoCall";

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
          className="fixed inset-0 z-[70] bg-background/98 backdrop-blur-sm flex flex-col"
          style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
        >
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={remoteRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover bg-secondary"
            />

            {(!remoteStream || state !== "connected") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Video className="w-8 h-8 text-primary" />
                </div>
                <p className="text-xl font-semibold text-foreground">{peerName}</p>
                <p className="text-sm text-muted-foreground">{statusText}</p>
              </div>
            )}

            {localStream && (
              <video
                ref={localRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-4 right-4 w-28 h-40 sm:w-36 sm:h-52 object-cover rounded-2xl border border-border shadow-lg bg-secondary"
              />
            )}
          </div>

          <div className="p-6 flex items-center justify-center gap-4">
            {state === "incoming" ? (
              <>
                <button
                  onClick={onDecline}
                  aria-label="Rechazar llamada"
                  className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <button
                  onClick={onAccept}
                  aria-label="Responder llamada"
                  className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
                >
                  <Video className="w-6 h-6" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onToggleMic}
                  aria-label={micOn ? "Silenciar micrófono" : "Activar micrófono"}
                  className="w-14 h-14 rounded-full bg-secondary text-foreground border border-border flex items-center justify-center"
                >
                  {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-muted-foreground" />}
                </button>
                <button
                  onClick={onHangup}
                  aria-label="Colgar"
                  className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <button
                  onClick={onToggleCam}
                  aria-label={camOn ? "Apagar cámara" : "Encender cámara"}
                  className="w-14 h-14 rounded-full bg-secondary text-foreground border border-border flex items-center justify-center"
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
