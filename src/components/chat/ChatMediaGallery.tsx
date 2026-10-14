import { Play, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { signedUrlsFor } from "@/lib/storageSign";
import { EmptyState } from "@/components/ui/empty-state";

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

const ChatMediaGallery = ({ messages, onViewMedia }: Props) => {
  const mediaMessages = messages.filter(m => m.media_url);
  const [signed, setSigned] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const urls = mediaMessages.map((m) => m.media_url!).filter(Boolean);
    if (!urls.length) return;
    let cancelled = false;
    signedUrlsFor("progress-photos", urls).then((m) => {
      if (!cancelled) setSigned((prev) => new Map([...prev, ...m]));
    });
    return () => { cancelled = true; };
  }, [messages]);

  const resolve = (u?: string | null) => (u ? signed.get(u) || "" : "");

  if (mediaMessages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <EmptyState icon={ImageIcon} title="Aún no hay fotos ni vídeos" description="Las fotos y vídeos del chat aparecerán aquí." />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid grid-cols-3 gap-0.5">
        {mediaMessages.map((msg) => (
          <button
            key={msg.id}
            type="button"
            aria-label={msg.media_type === "video" ? "Ver vídeo" : "Ver foto"}
            onClick={() => onViewMedia({ url: resolve(msg.media_url), type: msg.media_type || "image" })}
            className="relative aspect-square overflow-hidden bg-secondary transition-opacity active:opacity-80"
          >
            {msg.media_type === "video" ? (
              <>
                <video src={resolve(msg.media_url)} className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="w-6 h-6 text-white" />
                </div>
              </>
            ) : (
              <img loading="lazy" decoding="async" src={resolve(msg.media_url)} alt="" className="w-full h-full object-cover" />
            )}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
              <span className="type-caption2 text-white">
                {new Date(msg.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChatMediaGallery;
