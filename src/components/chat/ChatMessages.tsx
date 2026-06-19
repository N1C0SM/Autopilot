import { useAuth } from "@/contexts/AuthContext";
import { Play, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { signedUrlsFor } from "@/lib/storageSign";

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
  onViewMedia: (media: { url: string; type: string }) => void;
}

const ChatMessages = ({ messages, onViewMedia }: Props) => {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [signed, setSigned] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
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
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-10">
          ¡Hola! Escribe aquí si tienes alguna duda sobre tu plan. También puedes enviar fotos y vídeos de tu progreso 💪📸
        </div>
      )}
      {messages.map((msg) => {
        const isMine = msg.sender_id === user?.id;
        return (
          <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                isMine
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-secondary text-foreground rounded-bl-md"
              }`}
            >
              {msg.media_url && msg.media_type === "image" && (
                <button
                  onClick={() => onViewMedia({ url: resolve(msg.media_url), type: "image" })}
                  className="block mb-2 rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                >
                  <img src={resolve(msg.media_url)} alt="Foto" className="max-w-full max-h-48 rounded-lg object-cover" />
                </button>
              )}
              {msg.media_url && msg.media_type === "video" && (
                <button
                  onClick={() => onViewMedia({ url: resolve(msg.media_url), type: "video" })}
                  className="block mb-2 rounded-lg overflow-hidden relative group"
                >
                  <video src={resolve(msg.media_url)} className="max-w-full max-h-48 rounded-lg object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                    <Play className="w-10 h-10 text-white" />
                  </div>
                </button>
              )}
              {(!msg.media_url || (msg.content !== "📷 Foto" && msg.content !== "📹 Video")) && (
                <span>{msg.content}</span>
              )}
              <div className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
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
