import { Play, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { signedUrlsFor } from "@/shared/lib/storageSign";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ImageWithFallback, VideoWithFallback } from "@/app/components/chrome-chat/ImageWithFallback";
import { hapticTap } from "@/shared/lib/native";

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
            onClick={() => { void hapticTap(); onViewMedia({ url: resolve(msg.media_url), type: msg.media_type || "image" }); }}
            className="relative aspect-square overflow-hidden bg-secondary transition-opacity active:opacity-80"
          >
            {msg.media_type === "video" ? (
              <>
                <VideoWithFallback src={resolve(msg.media_url)} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-6 w-6 text-white" />
                </div>
              </>
            ) : (
              <ImageWithFallback src={resolve(msg.media_url)} alt="" className="h-full w-full object-cover" />
            )}
            <span className="absolute bottom-1 left-1 rounded-full bg-black/50 px-1.5 py-0.5 type-caption2 text-white">
              {new Date(msg.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChatMediaGallery;
