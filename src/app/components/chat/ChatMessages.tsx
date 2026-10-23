import { useAuth } from "@/shared/contexts/AuthContext";
import { MessageCircle, Play } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ImageWithFallback, VideoWithFallback } from "@/app/components/chrome-chat/ImageWithFallback";
import { hapticTap } from "@/shared/lib/native";
import { useState, useEffect, useRef } from "react";
import { signedUrlsFor } from "@/shared/lib/storageSign";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
}

interface Props {
  messages: Message[];
  emptyMessage?: string;
  onViewMedia: (media: { url: string; type: string }) => void;
}

// Texto que guarda Chat cuando el mensaje solo lleva archivo: no se muestra bajo la imagen.
const MEDIA_PLACEHOLDERS = new Set(["📷 Foto", "📹 Video"]);

const ChatMessages = ({ messages, onViewMedia, emptyMessage = "Escribe aquí tus dudas sobre el plan o comparte fotos y vídeos con tu entrenador." }: Props) => {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [signed, setSigned] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const scroller = scrollRef.current?.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const urls = messages.map((m) => m.media_url).filter(Boolean) as string[];
    if (urls.length === 0) return;
    let cancelled = false;
    signedUrlsFor("progress-photos", urls).then((m) => {
      if (!cancelled) setSigned((prev) => new Map([...prev, ...m]));
    });
    return () => {
      cancelled = true;
    };
  }, [messages]);

  const resolve = (u?: string | null) => (u ? signed.get(u) || "" : "");

  return (
    <div role="log" aria-label="Mensajes de la conversación" aria-live="polite" className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 py-4">
      {messages.length === 0 && (
        <EmptyState icon={MessageCircle} title="Sin mensajes todavía" description={emptyMessage} className="my-auto" />
      )}
      {messages.map((msg) => {
        const isMine = msg.sender_id === user?.id;
        return (
          <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
            <div
              className={`min-w-0 max-w-[78%] break-words rounded-[20px] px-3.5 py-2 type-body ${
                isMine
                  ? "bg-primary/15 text-foreground rounded-br-[6px]"
                  : "bg-secondary text-foreground rounded-bl-[6px]"
              }`}
            >
              {msg.media_url && msg.media_type === "image" && (
                <button type="button" aria-label="Ver foto adjunta"
                  onClick={() => { void hapticTap(); onViewMedia({ url: resolve(msg.media_url), type: "image" }); }}
                  className="block mb-2 rounded-xl overflow-hidden transition-opacity active:opacity-80"
                >
                  <ImageWithFallback src={resolve(msg.media_url)} alt="Foto" className="max-h-48 max-w-full rounded-lg object-cover" fallbackClassName="h-36 w-44" />
                </button>
              )}
              {msg.media_url && msg.media_type === "video" && (
                <button type="button" aria-label="Ver vídeo adjunto"
                  onClick={() => { void hapticTap(); onViewMedia({ url: resolve(msg.media_url), type: "video" }); }}
                  className="block mb-2 rounded-xl overflow-hidden relative active:opacity-80"
                >
                  <VideoWithFallback src={resolve(msg.media_url)} className="max-h-48 max-w-full rounded-lg object-cover" fallbackClassName="h-36 w-44" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="h-10 w-10 text-white" />
                  </div>
                </button>
              )}
              {(!msg.media_url || !MEDIA_PLACEHOLDERS.has(msg.content)) && (
                <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{msg.content}</span>
              )}
              <div className="mt-0.5 text-right type-caption2 text-muted-foreground">
                {new Date(msg.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={scrollRef} />
    </div>
  );
};

export default ChatMessages;
