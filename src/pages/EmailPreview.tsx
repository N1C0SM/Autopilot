import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Monitor, Smartphone, Radio } from "lucide-react";

type Msg = { customHtml: string; subject: string; templateData?: Record<string, any> };

export default function EmailPreview() {
  const { templateKey = "" } = useParams();
  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const inflight = useRef(0);
  const lastMsg = useRef<Msg | null>(null);
  const pending = useRef<Msg | null>(null);

  useEffect(() => {
    document.title = `Preview · ${templateKey}`;
  }, [templateKey]);

  const render = async (msg: Msg | null) => {
    const id = ++inflight.current;
    try {
      const body: any = { templateName: templateKey };
      if (msg?.customHtml) body.customHtml = msg.customHtml;
      if (msg?.templateData) body.templateData = msg.templateData;
      const { data, error } = await supabase.functions.invoke("render-email-template", { body });
      if (error) throw error;
      if (id !== inflight.current) return; // stale
      setRenderedHtml(data.html ?? "");
      setSubject((msg?.subject?.trim()) || (data.subject ?? ""));
    } catch (e: any) {
      if (id === inflight.current) {
        setRenderedHtml(`<pre style="padding:24px;color:#b00020;font-family:monospace">Error: ${e?.message ?? e}</pre>`);
      }
    } finally {
      if (id === inflight.current) setLoading(false);
      // If a newer message arrived while we were rendering, render again.
      if (pending.current && pending.current !== msg) {
        const next = pending.current;
        pending.current = null;
        render(next);
      }
    }
  };

  const scheduleRender = (msg: Msg) => {
    lastMsg.current = msg;
    if (inflight.current > 0 && !loading) {
      // a render is in-flight — queue the latest
      pending.current = msg;
      return;
    }
    render(msg);
  };

  // Initial render from DB defaults
  useEffect(() => {
    render(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey]);

  // Listen for live edits via BroadcastChannel + localStorage fallback
  useEffect(() => {
    const channelName = `email-preview-${templateKey}`;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(channelName);
      bc.onmessage = (ev) => {
        setConnected(true);
        if (ev.data && ev.data.type === "update") scheduleRender(ev.data.payload as Msg);
      };
      // Announce we're alive so editor can push latest
      bc.postMessage({ type: "ready" });
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (e.key !== channelName || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        setConnected(true);
        scheduleRender(parsed as Msg);
      } catch {}
    };
    window.addEventListener("storage", onStorage);

    // Pick up latest snapshot from localStorage on open
    try {
      const raw = localStorage.getItem(channelName);
      if (raw) {
        const parsed = JSON.parse(raw);
        setConnected(true);
        scheduleRender(parsed as Msg);
      }
    } catch {}

    return () => {
      bc?.close();
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey]);

  const frameWidth = viewport === "mobile" ? 390 : 720;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="bg-card border-b border-border px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Previsualización · {templateKey}</div>
          <div className="text-sm font-semibold truncate">{subject || "Sin asunto"}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${connected ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
            <Radio className="w-3 h-3" /> {connected ? "Sincronizado con el editor" : "Esperando editor…"}
          </div>
          <div className="flex items-center bg-background border border-border rounded-lg p-0.5">
            <button
              onClick={() => setViewport("desktop")}
              className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 ${viewport === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Monitor className="w-3.5 h-3.5" /> Desktop
            </button>
            <button
              onClick={() => setViewport("mobile")}
              className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 ${viewport === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center p-6 overflow-auto">
        {loading && !renderedHtml ? (
          <div className="flex items-center gap-2 text-muted-foreground mt-20"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
        ) : (
          <div
            className="bg-white rounded-xl shadow-lg overflow-hidden transition-all"
            style={{ width: frameWidth, maxWidth: "100%" }}
          >
            <iframe
              srcDoc={renderedHtml}
              title="Email preview"
              sandbox="allow-same-origin"
              className="w-full bg-white"
              style={{ minHeight: "80vh", border: 0, display: "block" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}