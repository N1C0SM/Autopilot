import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Save, RotateCcw, FileCode, Bold, Italic, List, ListOrdered, Heading1, Heading2, Link as LinkIcon, Undo2, Redo2, Code2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type TemplateDef = {
  name: string;
  label: string;
  placeholders: string[];
  sampleData: Record<string, any>;
};

// Sample values used to render `{{variables}}` in the live preview so the
// admin sees a realistic email even before any user is selected.
const TEMPLATES: TemplateDef[] = [
  {
    name: "scan-diagnosis",
    label: "Scan Diagnosis (resultado del AI scan)",
    placeholders: ["name", "headline", "summary", "monthsWithPlan", "monthsWithoutPlan", "SCAN_IMAGE_URL", "cardImageUrl", "photoUrl", "reportUrl"],
    sampleData: {
      name: "Nico",
      headline: "Tu mayor margen está en espalda y hombros.",
      summary: "Buen pecho frontal pero cadena posterior infradesarrollada. Postura ligeramente cifótica.",
      monthsWithPlan: 6,
      monthsWithoutPlan: 18,
      SCAN_IMAGE_URL: "https://placehold.co/1080x1350/0a0a0a/facc15?text=AI+Scan",
      cardImageUrl: "https://placehold.co/1080x1350/0a0a0a/facc15?text=AI+Scan",
      photoUrl: "https://placehold.co/600x800/0a0a0a/facc15?text=Foto",
      reportUrl: "https://autopilotplan.com/scan",
    },
  },
  {
    name: "mini-plan",
    label: "Mini Plan (plan gratis post-onboarding)",
    placeholders: ["insight", "mistake", "action", "ctaUrl"],
    sampleData: {
      insight: "Tu mayor bloqueo es la constancia, no el plan.",
      mistake: "Estás haciendo demasiado cardio para tu objetivo.",
      action: "Sube proteína a 1.6 g/kg y mide solo eso esta semana.",
      ctaUrl: "https://autopilotplan.com/quiz",
    },
  },
  {
    name: "payment-reminder",
    label: "Payment Reminder (recordatorio de pago)",
    placeholders: ["name", "customMessage", "checkoutUrl"],
    sampleData: {
      name: "Nico",
      customMessage: "Tu plan personalizado ya está listo, solo falta activar la suscripción.",
      checkoutUrl: "https://autopilotplan.com/dashboard",
    },
  },
];

// Wrap simple HTML produced by the visual editor in an email-friendly shell so
// the preview & sent email look polished without the admin having to write any HTML.
const wrapVisualHtml = (innerHtml: string, subject: string) => `<!doctype html>
<html><head><meta charset="utf-8" /><title>${subject || ""}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:36px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <tr><td style="font-size:16px;line-height:1.6;color:#1a1a1a;">
          ${innerHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

// Best-effort extraction of inner content from a previously-wrapped email so
// the visual editor can keep editing it after save/reload.
const extractInner = (html: string): string => {
  if (!html) return "";
  // If it looks like a full document, try to pull the inner content cell
  const m = html.match(/<td[^>]*style="[^"]*color:#1a1a1a[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
  if (m) return m[1].trim();
  // Else if it has <body>, return its inner
  const b = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (b) return b[1].trim();
  return html;
};

function VisualEditor({ value, onChange, placeholders, onInsertVariable }: {
  value: string;
  onChange: (html: string) => void;
  placeholders: string[];
  onInsertVariable?: (v: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit, LinkExt.configure({ openOnClick: false, HTMLAttributes: { style: "color:#3b82f6;text-decoration:underline;" } })],
    content: value || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[360px] focus:outline-none px-4 py-3 bg-white text-black rounded-b-lg",
      },
    },
  });

  // Sync external value changes (e.g. template switch)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return <div className="h-[400px] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  const Btn = ({ onClick, active, children, title }: any) => (
    <button type="button" onClick={onClick} title={title}
      className={`w-8 h-8 rounded flex items-center justify-center transition ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
      {children}
    </button>
  );

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace", prev ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/40 flex-wrap">
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Título"><Heading1 className="w-4 h-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Subtítulo"><Heading2 className="w-4 h-4" /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrita"><Bold className="w-4 h-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Cursiva"><Italic className="w-4 h-4" /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista"><List className="w-4 h-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada"><ListOrdered className="w-4 h-4" /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn onClick={setLink} active={editor.isActive("link")} title="Enlace"><LinkIcon className="w-4 h-4" /></Btn>
        <div className="flex-1" />
        <Btn onClick={() => editor.chain().focus().undo().run()} title="Deshacer"><Undo2 className="w-4 h-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} title="Rehacer"><Redo2 className="w-4 h-4" /></Btn>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/20 flex-wrap">
        <span className="text-[11px] text-muted-foreground mr-1">Insertar variable:</span>
        {placeholders.map(p => (
          <button key={p} type="button"
            onClick={() => { editor.chain().focus().insertContent(`{{${p}}}`).run(); onInsertVariable?.(p); }}
            className="text-[11px] bg-background border border-border rounded px-2 py-0.5 hover:bg-primary hover:text-primary-foreground hover:border-primary transition">
            {`{{${p}}}`}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
export default function EmailTemplatesEditor() {
  const [selected, setSelected] = useState(TEMPLATES[0].name);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [visualHtml, setVisualHtml] = useState("");
  const [mode, setMode] = useState<"visual" | "code">("visual");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [hasOverride, setHasOverride] = useState(false);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const previewWinRef = useRef<Window | null>(null);

  const current = TEMPLATES.find(t => t.name === selected)!;

  // Maintain a BroadcastChannel tied to the current template so the open
  // preview tab receives live updates.
  useEffect(() => {
    const name = `email-preview-${selected}`;
    try {
      bcRef.current?.close();
      const bc = new BroadcastChannel(name);
      // When the preview tab announces itself, immediately push current state.
      bc.onmessage = (ev) => {
        if (ev.data?.type === "ready") pushLive();
      };
      bcRef.current = bc;
    } catch {
      bcRef.current = null;
    }
    return () => { bcRef.current?.close(); bcRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const pushLive = () => {
    const customHtml = mode === "visual" ? wrapVisualHtml(visualHtml, subject) : html;
    const payload = { customHtml, subject, templateData: current.sampleData };
    try { bcRef.current?.postMessage({ type: "update", payload }); } catch {}
    try { localStorage.setItem(`email-preview-${selected}`, JSON.stringify(payload)); } catch {}
  };

  // Debounced live-push whenever editable fields change
  useEffect(() => {
    const t = setTimeout(() => { pushLive(); }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualHtml, html, subject, mode, selected]);

  const load = async () => {
    setLoading(true);
    setPreviewHtml(null);
    try {
      // Try fetch override
      const { data: override } = await supabase
        .from("email_template_overrides" as any)
        .select("subject, html, enabled")
        .eq("template_name", selected)
        .maybeSingle();

      if (override) {
        setSubject((override as any).subject);
        setHtml((override as any).html);
        setVisualHtml(extractInner((override as any).html));
        setEnabled((override as any).enabled);
        setHasOverride(true);
      } else {
        // Load default from edge function
        const { data, error } = await supabase.functions.invoke("render-email-template", {
          body: { templateName: selected },
        });
        if (error) throw error;
        setSubject(data.subject ?? "");
        setHtml(data.html ?? "");
        setVisualHtml(extractInner(data.html ?? ""));
        setEnabled(true);
        setHasOverride(false);
      }
    } catch (e: any) {
      toast.error("No se pudo cargar la plantilla: " + (e?.message ?? "error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [selected]);

  const save = async () => {
    const finalHtml = mode === "visual" ? wrapVisualHtml(visualHtml, subject) : html;
    if (!subject.trim() || !finalHtml.trim()) {
      toast.error("Asunto y HTML son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("email_template_overrides" as any).upsert({
        template_name: selected,
        subject: subject.trim(),
        html: finalHtml,
        enabled,
      }, { onConflict: "template_name" });
      if (error) throw error;
      setHtml(finalHtml);
      toast.success("Plantilla guardada");
      setHasOverride(true);
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message ?? "error"));
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    if (!confirm("¿Restaurar la plantilla por defecto? Se borrará tu personalización.")) return;
    try {
      const { error } = await supabase.from("email_template_overrides" as any)
        .delete().eq("template_name", selected);
      if (error) throw error;
      toast.success("Restaurada");
      load();
    } catch (e: any) {
      toast.error("Error: " + (e?.message ?? ""));
    }
  };

  const preview = async () => {
    // Push latest state first, then open (or focus) the live preview tab.
    pushLive();
    const url = `/admin/email-preview/${encodeURIComponent(selected)}`;
    if (previewWinRef.current && !previewWinRef.current.closed) {
      try { previewWinRef.current.focus(); return; } catch {}
    }
    previewWinRef.current = window.open(url, `email-preview-${selected}`);
  };

  // Interpolate {{vars}} with sample data so the in-page preview doesn't show
  // raw placeholders. Same shape as the edge-function interpolator.
  const interpolate = (str: string) =>
    str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      const val = key.split(".").reduce((acc: any, k: string) => acc?.[k], current.sampleData);
      return val == null ? "" : String(val);
    });

  // Live preview HTML for the side-by-side iframe (always reflects current edits).
  const rawLive = mode === "visual"
    ? wrapVisualHtml(visualHtml || "<p style='color:#999'>Empieza a escribir…</p>", subject)
    : html;
  const livePreviewHtml = interpolate(rawLive);

  const loadDefault = async () => {
    if (!confirm("¿Cargar el HTML por defecto en el editor? Se sobrescribirá lo que tengas escrito (no se guardará hasta que pulses Guardar).")) return;
    try {
      const { data, error } = await supabase.functions.invoke("render-email-template", {
        body: { templateName: selected },
      });
      if (error) throw error;
      setHtml(data.html ?? "");
      setSubject(data.subject ?? "");
      setVisualHtml(extractInner(data.html ?? ""));
      toast.success("HTML por defecto cargado");
    } catch (e: any) {
      toast.error("Error: " + (e?.message ?? ""));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold mb-1">Editor de Emails</h1>
        <p className="text-sm text-muted-foreground">
          Personaliza el asunto y el HTML de cada email transaccional. Si está desactivado, se usa el diseño por defecto.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Plantilla</Label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
          >
            {TEMPLATES.map(t => <option key={t.name} value={t.name}>{t.label}</option>)}
          </select>
          <p className="text-[11px] text-muted-foreground mt-2">
            Variables disponibles: {current.placeholders.map(p => <code key={p} className="mx-0.5 bg-muted px-1.5 py-0.5 rounded">{`{{${p}}}`}</code>)}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-lg">
              <div>
                <div className="text-sm font-medium">Personalización activa</div>
                <div className="text-xs text-muted-foreground">{hasOverride ? "Estás usando una versión personalizada" : "Sin personalizar (se usa el diseño por defecto)"}</div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Asunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" placeholder="Asunto del email" />
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as "visual" | "code")}>
              <div className="flex items-center justify-between mb-2">
                <TabsList>
                  <TabsTrigger value="visual" className="gap-1.5"><Eye className="w-3.5 h-3.5" /> Editor visual</TabsTrigger>
                  <TabsTrigger value="code" className="gap-1.5"><Code2 className="w-3.5 h-3.5" /> HTML avanzado</TabsTrigger>
                </TabsList>
                <Button variant="ghost" size="sm" onClick={loadDefault} className="h-7 text-xs gap-1">
                  <FileCode className="w-3 h-3" /> Cargar por defecto
                </Button>
              </div>

              <TabsContent value="visual" className="mt-0">
                <div className="grid lg:grid-cols-2 gap-4">
                  <VisualEditor
                    value={visualHtml}
                    onChange={setVisualHtml}
                    placeholders={current.placeholders}
                  />
                  <div className="border border-border rounded-lg overflow-hidden bg-white flex flex-col">
                    <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/40">
                      Vista previa en vivo
                    </div>
                    <iframe srcDoc={livePreviewHtml} title="Live email preview" className="w-full flex-1 bg-white" style={{ minHeight: 420, border: 0 }} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="code" className="mt-0">
                <Textarea
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  className="font-mono text-xs min-h-[400px]"
                  placeholder="<html>...</html>"
                />
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </Button>
              <Button variant="outline" onClick={preview} className="gap-2">
                <Eye className="w-4 h-4" /> Previsualizar
              </Button>
              {hasOverride && (
                <Button variant="outline" onClick={resetToDefault} className="gap-2 text-destructive">
                  <RotateCcw className="w-4 h-4" /> Restaurar por defecto
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {previewHtml && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold">Vista previa</div>
            <Button variant="ghost" size="sm" onClick={() => setPreviewHtml(null)}>Cerrar</Button>
          </div>
          <iframe srcDoc={previewHtml} className="w-full bg-white" style={{ height: 700, border: 0 }} title="Email preview" />
        </div>
      )}
    </div>
  );
}