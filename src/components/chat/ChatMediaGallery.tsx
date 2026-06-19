import { Play, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">Aún no hay fotos ni vídeos</p>
          <p className="text-xs text-muted-foreground mt-1">Las fotos y vídeos del chat aparecerán aquí</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="grid grid-cols-3 gap-2">
        {mediaMessages.map((msg) => (
          <button
            key={msg.id}
            onClick={() => onViewMedia({ url: resolve(msg.media_url), type: msg.media_type || "image" })}
            className="relative aspect-square rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity group"
          >
            {msg.media_type === "video" ? (
              <>
                <video src={resolve(msg.media_url)} className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                  <Play className="w-6 h-6 text-white" />
                </div>
              </>
            ) : (
              <img src={resolve(msg.media_url)} alt="" className="w-full h-full object-cover" />
            )}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
              <span className="text-[9px] text-white">
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
