import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, Image, Video, X, Play, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ChatMessages from "@/components/chat/ChatMessages";
import ChatMediaGallery from "@/components/chat/ChatMediaGallery";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
}

interface Props {
  conversationUserId: string;
  isAdmin?: boolean;
}

const Chat = ({ conversationUserId, isAdmin = false }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string; type: "image" | "video" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewMedia, setViewMedia] = useState<{ url: string; type: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "media">("chat");
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ label: string; text: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_user_id", conversationUserId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
    };
    load();

    const channel = supabase
      .channel(`chat-${conversationUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_user_id=eq.${conversationUserId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationUserId]);

  const uploadMedia = async (file: File): Promise<{ url: string; type: "image" | "video" }> => {
    const ext = file.name.split(".").pop() || "jpg";
    const mediaType = file.type.startsWith("video") ? "video" : "image";
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error("No autenticado");
    // El primer segmento debe ser el uid del que sube (RLS de storage)
    const path = `${uid}/chat/${conversationUserId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("progress-photos").upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from("progress-photos").getPublicUrl(path);
    return { url: urlData.publicUrl, type: mediaType };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video");
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB video, 10MB foto
    if (file.size > maxSize) {
      toast.error(isVideo ? "El vídeo supera los 50MB" : "La foto supera los 10MB");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const type = file.type.startsWith("video") ? "video" : "image";
    const url = URL.createObjectURL(file);
    setPreviewFile({ file, url, type });
    if (fileRef.current) fileRef.current.value = "";
  };

  const sendMessage = async () => {
    if ((!newMsg.trim() && !previewFile) || !user) return;
    setSending(true);
    setUploading(!!previewFile);
    try {
      let media_url: string | null = null;
      let media_type: string | null = null;
      if (previewFile) {
        const result = await uploadMedia(previewFile.file);
        media_url = result.url;
        media_type = result.type;
      }
      const { error } = await supabase.from("chat_messages").insert({
        conversation_user_id: conversationUserId,
        sender_id: user.id,
        content: newMsg.trim() || (media_type === "video" ? "📹 Video" : "📷 Foto"),
        media_url,
        media_type,
      });
      if (!error) {
        setNewMsg("");
        setPreviewFile(null);
      }
    } catch (err: any) {
      toast.error("Error al enviar: " + (err.message || ""));
    }
    setSending(false);
    setUploading(false);
  };

  const fetchAISuggestions = async () => {
    const lastUser = [...messages].reverse().find((m) => m.sender_id === conversationUserId);
    if (!lastUser) {
      toast.info("No hay mensajes del cliente todavía");
      return;
    }
    setAiSuggestLoading(true);
    setAiSuggestions([]);
    try {
      const history = messages.slice(-8).map((m) => ({
        role: m.sender_id === conversationUserId ? "user" : "assistant",
        content: m.content,
      }));
      const { data, error } = await supabase.functions.invoke("ai-chat-suggestions", {
        body: { lastUserMessage: lastUser.content, history },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiSuggestions(data?.replies || []);
    } catch (e: any) {
      toast.error(e.message || "Error con IA");
    }
    setAiSuggestLoading(false);
  };

  const mediaCount = messages.filter(m => m.media_url).length;

  return (
    <>
      <div className="bg-card rounded-2xl border border-border card-shadow flex flex-col h-[500px]">
        {/* Header with tabs */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "chat" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            {isAdmin ? "Chat" : "Chat con tu entrenador"}
          </button>
          <button
            onClick={() => setActiveTab("media")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "media" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Image className="w-4 h-4" />
            Media
            {mediaCount > 0 && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">{mediaCount}</span>
            )}
          </button>
        </div>

        {/* Content */}
        {activeTab === "chat" ? (
          <ChatMessages messages={messages} onViewMedia={setViewMedia} />
        ) : (
          <ChatMediaGallery messages={messages} onViewMedia={setViewMedia} />
        )}

        {/* Preview */}
        {previewFile && activeTab === "chat" && (
          <div className="px-3 pt-2 flex items-center gap-2">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
              {previewFile.type === "image" ? (
                <img src={previewFile.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-secondary flex items-center justify-center">
                  <Video className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <button
                onClick={() => setPreviewFile(null)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground">
              {previewFile.type === "image" ? "📷 Foto lista" : "📹 Vídeo listo"}
            </span>
          </div>
        )}

        {/* Input */}
        {activeTab === "chat" && (
          <div className="p-3 border-t border-border">
            {isAdmin && aiSuggestions.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {aiSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setNewMsg(s.text); setAiSuggestions([]); }}
                    className="w-full text-left text-xs bg-secondary hover:bg-secondary/80 rounded-lg px-3 py-2 border border-border transition-colors"
                  >
                    <div className="text-[10px] font-bold uppercase text-primary tracking-wider mb-0.5">{s.label}</div>
                    <div className="text-foreground/90">{s.text}</div>
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
              <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} className="shrink-0" disabled={uploading}>
                <Image className="w-5 h-5" />
              </Button>
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
              {isAdmin && (
                <Button type="button" variant="ghost" size="icon" onClick={fetchAISuggestions} disabled={aiSuggestLoading} className="shrink-0" title="Sugerir respuesta con IA">
                  {aiSuggestLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-primary" />}
                </Button>
              )}
              <Input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Escribe un mensaje..." className="flex-1" />
              <Button type="submit" size="icon" disabled={sending || (!newMsg.trim() && !previewFile)}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Media Viewer */}
      {viewMedia && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewMedia(null)}>
          <button onClick={() => setViewMedia(null)} className="absolute top-4 right-4 text-white/70 hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>
          <div onClick={(e) => e.stopPropagation()} className="max-w-3xl max-h-[85vh]">
            {viewMedia.type === "image" ? (
              <img src={viewMedia.url} alt="" className="max-h-[85vh] rounded-xl object-contain" />
            ) : (
              <video src={viewMedia.url} controls autoPlay className="max-h-[85vh] rounded-xl" />
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Chat;
