import { errorMessage } from "@/shared/lib/runtimeValues";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/shared/integrations/supabase/client";
import { Radio } from "lucide-react";
import { Spinner } from "@/shared/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import Screen from "@/shared/components/native/Screen";
import { hapticSelection } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";

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
    <Screen title="Previsualización" hideBack maxWidth="full" contentClassName="space-y-4 pb-4 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="type-footnote text-muted-foreground"><span className="font-mono">{templateKey}</span></p>
          <p className="mt-0.5 break-words type-title3">{subject || "Sin asunto"}</p>
          <p className={cn("mt-1 flex items-center gap-1.5 type-footnote", connected ? "text-success" : "text-muted-foreground")}>
            <Radio className="h-3.5 w-3.5" aria-hidden="true" /> {connected ? "Sincronizado con el editor" : "Esperando al editor…"}
          </p>
        </div>
        <Tabs value={viewport} onValueChange={(v) => { void hapticSelection(); setViewport(v as "desktop" | "mobile"); }} className="w-full sm:w-64">
          <TabsList className="w-full">
            <TabsTrigger value="desktop">Escritorio</TabsTrigger>
            <TabsTrigger value="mobile">Móvil</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex justify-center">
        {loading && !renderedHtml ? (
          <div className="mt-20 flex items-center gap-2 type-subhead text-muted-foreground"><Spinner size="sm" /> Cargando…</div>
        ) : (
          <div
            className="overflow-hidden rounded-media bg-white transition-all"
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
    </Screen>
  );
}
