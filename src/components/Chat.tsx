import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, WifiOff, MessageCircle, Image, Video, X, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ChatMessages from "@/components/chat/ChatMessages";
import ChatMediaGallery from "@/components/chat/ChatMediaGallery";
import AIDisclaimer from "@/components/AIDisclaimer";
import CallOverlay from "@/components/call/CallOverlay";
import { useVideoCall } from "@/hooks/useVideoCall";
import { EmptyState } from "@/components/ui/empty-state";
import { hapticTap } from "@/lib/native";

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
  onRequestVideoCall?: () => void;
  callLabel?: string;
  audience?: "client" | "trainer" | "team";
  layout?: "panel" | "fill";
}

const Chat = ({ conversationUserId, isAdmin = false, onRequestVideoCall, callLabel = "Videollamada", audience = isAdmin ? "client" : "trainer", layout = "panel" }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const activeConversation = useRef(conversationUserId);
  const loadVersion = useRef(0);
  const sendingRef = useRef(false);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string; type: "image" | "video" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewMedia, setViewMedia] = useState<{ url: string; type: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "media">("chat");
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ label: string; text: string }[]>([]);
  const call = useVideoCall(conversationUserId);

  useEffect(() => {
    if (call.error) {
      toast.error(call.error);
      call.clearError();
    }
  }, [call.error]);

  const loadMessages = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.from("chat_messages").select("*")
        .eq("conversation_user_id", conversationUserId).order("created_at", { ascending: true });
      if (error) throw error;
      if (version !== loadVersion.current || activeConversation.current !== conversationUserId) return;
      setMessages((current) => {
        const merged = new Map((data as Message[] || []).map((message) => [message.id, message]));
        current.forEach((message) => merged.set(message.id, message));
        return [...merged.values()].sort((first, second) => first.created_at.localeCompare(second.created_at));
      });
    } catch {
      if (version === loadVersion.current && activeConversation.current === conversationUserId) {
        setLoadError("No se pudo cargar esta conversación.");
      }
    } finally {
      if (version === loadVersion.current && activeConversation.current === conversationUserId) setLoading(false);
    }
  }, [conversationUserId]);

  const invalidateLoad = useCallback(() => { loadVersion.current++; }, []);

  useEffect(() => {
    activeConversation.current = conversationUserId;
    setMessages([]);
    setNewMsg("");
    setPreviewFile(null);
    setAiSuggestions([]);
    setActiveTab("chat");
    setConnectionLost(false);
    sendingRef.current = false;
    setSending(false);
    void loadMessages();
    const channel = supabase.channel(`chat-${conversationUserId}`).on("postgres_changes", {
      event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_user_id=eq.${conversationUserId}`,
    }, (payload) => {
      if (activeConversation.current !== conversationUserId) return;
      const message = payload.new as Message;
      setMessages((current) => current.some((existing) => existing.id === message.id) ? current : [...current, message]);
    }).subscribe((status) => {
      if (activeConversation.current === conversationUserId) {
        setConnectionLost(status === "CHANNEL_ERROR" || status === "TIMED_OUT");
      }
    });
    return () => { invalidateLoad(); void supabase.removeChannel(channel); };
  }, [conversationUserId, loadMessages, invalidateLoad]);

  useEffect(() => () => { if (previewFile) URL.revokeObjectURL(previewFile.url); }, [previewFile]);
  useEffect(() => {
    if (!viewMedia) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setViewMedia(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [viewMedia]);

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
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Elige una foto o un vídeo.");
      e.target.value = "";
      return;
    }
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
    if ((!newMsg.trim() && !previewFile) || !user || sendingRef.current) return;
    const targetConversation = conversationUserId;
    sendingRef.current = true;
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
      const { data, error } = await supabase.from("chat_messages").insert({
        conversation_user_id: conversationUserId,
        sender_id: user.id,
        content: newMsg.trim() || (media_type === "video" ? "📹 Video" : "📷 Foto"),
        media_url,
        media_type,
      }).select("*").single();
      if (error) throw error;
      if (activeConversation.current === targetConversation) {
        if (data) setMessages((current) => current.some((message) => message.id === data.id) ? current : [...current, data as Message]);
        setNewMsg("");
        setPreviewFile(null);
      }
    } catch {
      toast.error("No se pudo enviar el mensaje. Tu borrador sigue aquí; inténtalo de nuevo.");
    } finally {
      if (activeConversation.current === targetConversation) {
        sendingRef.current = false;
        setSending(false);
        setUploading(false);
      }
    }
  };

  const fetchAISuggestions = async () => {
    const lastUser = [...messages].reverse().find((m) => m.sender_id === conversationUserId);
    if (!lastUser) {
      toast.info("Todavía no hay mensajes para sugerir una respuesta");
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "No se pudo sugerir una respuesta.");
    }
    setAiSuggestLoading(false);
  };

  const chatTitle = audience === "team" ? "Chat con administración" : audience === "client" ? "Chat con cliente" : "Chat con tu entrenador";
  const emptyMessage = audience === "team"
    ? "Canal privado con administración. Escribe aquí para coordinar el seguimiento de tus clientes."
    : audience === "client" ? "Empieza la conversación con tu cliente. Puedes compartir mensajes, fotos y vídeos."
      : "Escribe aquí tus dudas sobre el plan o comparte fotos y vídeos con tu entrenador.";
  const mediaCount = messages.filter(m => m.media_url).length;

  return (
    <>
      <div className={`flex min-w-0 flex-col overflow-hidden ${layout === "fill" ? "h-full min-h-0 flex-1 bg-background" : "h-[min(42rem,calc(100dvh-12rem))] min-h-[20rem] rounded-2xl border border-border bg-card"}`}>
        {/* Header with tabs */}
        <div className="flex min-w-0 shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
          <div className="flex min-w-0 flex-1 rounded-[9px] bg-secondary p-0.5 sm:flex-none">
          <button
            type="button"
            onClick={() => { void hapticTap(); setActiveTab("chat"); }}
            aria-label={chatTitle}
            aria-pressed={activeTab === "chat"}
            className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[7px] px-3 type-subhead font-semibold transition-colors active:opacity-70 sm:flex-none ${
              activeTab === "chat" ? "bg-card text-foreground" : "text-muted-foreground"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="sm:hidden">Chat</span>
            <span className="hidden sm:inline">{chatTitle}</span>
          </button>
          <button
            type="button"
            onClick={() => { void hapticTap(); setActiveTab("media"); }}
            aria-pressed={activeTab === "media"}
            className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[7px] px-3 type-subhead font-semibold transition-colors active:opacity-70 sm:flex-none ${
              activeTab === "media" ? "bg-card text-foreground" : "text-muted-foreground"
            }`}
          >
            <Image className="w-4 h-4" />
            Archivos
            {mediaCount > 0 && (
              <span className="type-caption2 tabular-nums text-muted-foreground">{mediaCount}</span>
            )}
          </button>
          </div>
          {isAdmin && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto h-11 w-11 shrink-0 gap-1.5 p-0 text-primary active:opacity-70 sm:w-auto sm:px-3"
              onClick={call.startCall}
              disabled={call.state !== "idle"}
              title="Videollamada dentro de Autopilot"
              aria-label="Iniciar videollamada"
            >
              <Video className="h-5 w-5" />
              <span className="hidden sm:inline">Videollamada</span>
            </Button>
          )}
          {!isAdmin && onRequestVideoCall && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto h-11 w-11 shrink-0 gap-1.5 p-0 text-primary active:opacity-70 sm:w-auto sm:px-3"
              onClick={onRequestVideoCall}
              aria-label={callLabel}
              title={callLabel}
            >
              <Video className="h-5 w-5" />
              <span className="hidden sm:inline">{callLabel}</span>
            </Button>
          )}
        </div>


        {/* Content */}
        {!isAdmin && audience === "trainer" && (
          <div className="shrink-0 px-3 pt-2">
            <AIDisclaimer variant="compact" />
          </div>
        )}
        {connectionLost && !loadError && <div role="status" className="flex shrink-0 items-center gap-3 px-4 py-1"><WifiOff className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0 flex-1 type-footnote text-muted-foreground">La conexión en directo se interrumpió.</span><button type="button" className="min-h-11 shrink-0 type-subhead font-semibold text-primary active:opacity-60" onClick={() => void loadMessages()}>Actualizar</button></div>}
        {loading ? <div role="status" className="flex min-h-0 flex-1 items-center justify-center gap-2 type-subhead text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Cargando conversación…</div>
          : loadError ? <div role="alert" className="flex min-h-0 flex-1 items-center justify-center"><EmptyState icon={RefreshCw} title={loadError} description="Revisa la conexión y vuelve a intentarlo." action={<button type="button" className="min-h-11 px-4 type-headline text-primary active:opacity-60" onClick={() => void loadMessages()}>Reintentar</button>} /></div>
          : activeTab === "chat" ? <ChatMessages messages={messages} onViewMedia={setViewMedia} emptyMessage={emptyMessage} />
          : <ChatMediaGallery messages={messages} onViewMedia={setViewMedia} />}

        {/* Preview */}
        {previewFile && (
          <div className="flex shrink-0 items-center gap-3 px-4 py-2">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-secondary">
              {previewFile.type === "image" ? (
                <img loading="lazy" decoding="async" src={previewFile.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Video className="w-6 h-6 text-muted-foreground" />
                </div>
              )}

            </div>
            <span className="min-w-0 flex-1 type-subhead text-muted-foreground">{previewFile.type === "image" ? "Foto lista" : "Vídeo listo"}</span>
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => setPreviewFile(null)} aria-label="Quitar archivo adjunto"><X className="w-4 h-4" /></Button>
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 border-t border-border/60 px-2 pt-2 sm:px-3" style={{ paddingBottom: layout === "fill" ? "max(0.5rem, var(--safe-bottom, 0px))" : "0.5rem" }}>
            {isAdmin && aiSuggestions.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {aiSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setNewMsg(s.text); setAiSuggestions([]); }}
                    className="min-h-11 w-full break-words rounded-xl bg-secondary px-3 py-2 text-left transition-opacity active:opacity-70"
                  >
                    <div className="type-footnote font-semibold text-muted-foreground">{s.label}</div>
                    <div className="type-subhead text-foreground">{s.text}</div>
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); void hapticTap(); sendMessage(); }} className="flex min-w-0 items-end gap-1">
              <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} className="h-11 w-11 shrink-0 text-muted-foreground active:opacity-60" aria-label="Adjuntar foto o vídeo" disabled={sending || uploading || loading || !!loadError}>
                <Image className="w-5 h-5" />
              </Button>
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
              {isAdmin && (
                <Button type="button" variant="ghost" size="icon" onClick={fetchAISuggestions} disabled={aiSuggestLoading || sending || loading || !!loadError} className="h-11 w-11 shrink-0 text-muted-foreground active:opacity-60" aria-label="Sugerir respuesta con IA" title="Sugerir respuesta con IA">
                  {aiSuggestLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                </Button>
              )}
              <Input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Escribe un mensaje…" aria-label="Mensaje" disabled={sending || loading || !!loadError} className="h-11 min-w-0 flex-1 rounded-full border-border/60 bg-transparent px-4 text-[17px] md:text-sm" />
              <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full transition-transform active:scale-95 disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100" aria-label={sending ? "Enviando mensaje" : "Enviar mensaje"} disabled={sending || loading || !!loadError || (!newMsg.trim() && !previewFile)}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="h-5 w-5" strokeWidth={2.5} />}
              </Button>
            </form>
        </div>

      </div>

      {/* Media Viewer */}
      {viewMedia && (
        <div role="dialog" aria-modal="true" aria-label="Archivo del chat" className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewMedia(null)}>
          <button type="button" onClick={() => setViewMedia(null)} aria-label="Cerrar archivo" className="absolute right-4 flex h-11 w-11 items-center justify-center text-white/80 active:opacity-60" style={{ top: "calc(var(--safe-top, 0px) + 0.5rem)" }}>
            <X className="w-6 h-6" />
          </button>
          <div onClick={(e) => e.stopPropagation()} className="max-w-3xl max-h-[85vh]">
            {viewMedia.type === "image" ? (
              <img loading="lazy" decoding="async" src={viewMedia.url} alt="" className="max-h-[85vh] rounded-xl object-contain" />
            ) : (
              // Sin autoPlay: se abre con los controles y el usuario pulsa play
              <video src={viewMedia.url} controls className="max-h-[85vh] rounded-xl" />
            )}
          </div>
        </div>
      )}
      <CallOverlay
        state={call.state}
        localStream={call.localStream}
        remoteStream={call.remoteStream}
        micOn={call.micOn}
        camOn={call.camOn}
        peerName={audience === "team" ? "Administración" : audience === "client" ? "Tu cliente" : "Tu entrenador"}
        onAccept={call.accept}
        onDecline={call.decline}
        onHangup={call.hangup}
        onToggleMic={call.toggleMic}
        onToggleCam={call.toggleCam}
      />
    </>
  );
};

export default Chat;
