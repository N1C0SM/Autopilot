import { errorMessage } from "@/lib/runtimeValues";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, Smartphone, Radio } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hapticTap } from "@/lib/native";

type Msg = { customHtml: string; subject: string; templateData?: Record<string, unknown> };

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
      const body: { templateName: string; customHtml?: string; templateData?: Record<string, unknown> } = { templateName: templateKey };
      if (msg?.customHtml) body.customHtml = msg.customHtml;
      if (msg?.templateData) body.templateData = msg.templateData;
      const { data, error } = await supabase.functions.invoke("render-email-template", { body });
      if (error) throw error;
      if (id !== inflight.current) return; // stale
      setRenderedHtml(data.html ?? "");
      setSubject((msg?.subject?.trim()) || (data.subject ?? ""));
    } catch (e: unknown) {
      if (id === inflight.current) {
        setRenderedHtml(`<pre style="padding:24px;color:#b00020;font-family:monospace">Error: ${errorMessage(e) || "No se pudo cargar la vista previa"}</pre>`);
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
    } catch { /* Best-effort browser feature; the primary flow remains available. */ }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== channelName || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        setConnected(true);
        scheduleRender(parsed as Msg);
      } catch { /* Best-effort browser feature; the primary flow remains available. */ }
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
    } catch { /* Best-effort browser feature; the primary flow remains available. */ }

    return () => {
      bc?.close();
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey]);

  const frameWidth = viewport === "mobile" ? 390 : 720;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="material sep-b px-4 md:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="type-footnote text-muted-foreground">Previsualización · {templateKey}</div>
          <div className="type-headline truncate">{subject || "Sin asunto"}</div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 type-footnote ${connected ? "text-primary" : "text-muted-foreground"}`}>
            <Radio className="w-3.5 h-3.5" /> {connected ? "Sincronizado con el editor" : "Esperando editor…"}
          </div>
          <Tabs value={viewport} onValueChange={(v) => { void hapticTap(); setViewport(v as "desktop" | "mobile"); }}>
            <TabsList>
              <TabsTrigger value="desktop" className="gap-1"><Monitor className="w-3.5 h-3.5" /> Desktop</TabsTrigger>
              <TabsTrigger value="mobile" className="gap-1"><Smartphone className="w-3.5 h-3.5" /> Mobile</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center p-4 md:p-6 overflow-auto">
        {loading && !renderedHtml ? (
          <div className="flex items-center gap-2 type-subhead text-muted-foreground mt-20"><Spinner size="sm" /> Cargando…</div>
        ) : (
          <div
            className="bg-white rounded-2xl overflow-hidden transition-all"
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
