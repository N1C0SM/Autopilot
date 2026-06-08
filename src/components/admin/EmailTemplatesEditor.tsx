import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Save, RotateCcw, FileCode, Eye, Wand2 } from "lucide-react";
import { toast } from "sonner";
import scanPreviewAsset from "@/assets/scan-preview.jpg.asset.json";

const SCAN_PREVIEW_URL = `${window.location.origin}${scanPreviewAsset.url}`;

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
      SCAN_IMAGE_URL: SCAN_PREVIEW_URL,
      cardImageUrl: SCAN_PREVIEW_URL,
      photoUrl: SCAN_PREVIEW_URL,
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

export default function EmailTemplatesEditor() {
  const [selected, setSelected] = useState(TEMPLATES[0].name);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasOverride, setHasOverride] = useState(false);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const previewWinRef = useRef<Window | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const current = TEMPLATES.find(t => t.name === selected)!;

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // VSCode-like dark theme that matches the app
    monaco.editor.defineTheme("autopilot-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0a0a0a",
        "editor.lineHighlightBackground": "#1a1a1a",
      },
    });
    monaco.editor.setTheme("autopilot-dark");
  };

  const insertVariable = (placeholder: string) => {
    const editor = editorRef.current;
    const text = `{{${placeholder}}}`;
    if (!editor) {
      setHtml(prev => prev + text);
      return;
    }
    const selection = editor.getSelection();
    const id = { major: 1, minor: 1 };
    const op = { identifier: id, range: selection, text, forceMoveMarkers: true };
    editor.executeEdits("insert-var", [op]);
    editor.focus();
  };

  const formatDocument = () => {
    editorRef.current?.getAction("editor.action.formatDocument")?.run();
  };

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
    const payload = { customHtml: html, subject, templateData: current.sampleData };
    try { bcRef.current?.postMessage({ type: "update", payload }); } catch {}
    try { localStorage.setItem(`email-preview-${selected}`, JSON.stringify(payload)); } catch {}
  };

  // Debounced live-push whenever editable fields change
  useEffect(() => {
    const t = setTimeout(() => { pushLive(); }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, subject, selected]);

  const load = async () => {
    setLoading(true);
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
    if (!subject.trim() || !html.trim()) {
      toast.error("Asunto y HTML son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("email_template_overrides" as any).upsert({
        template_name: selected,
        subject: subject.trim(),
        html: html,
        enabled,
      }, { onConflict: "template_name" });
      if (error) throw error;
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

  const loadDefault = async () => {
    if (!confirm("¿Cargar el HTML por defecto en el editor? Se sobrescribirá lo que tengas escrito (no se guardará hasta que pulses Guardar).")) return;
    try {
      const { data, error } = await supabase.functions.invoke("render-email-template", {
        body: { templateName: selected },
      });
      if (error) throw error;
      setHtml(data.html ?? "");
      setSubject(data.subject ?? "");
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
          <div className="mt-3 space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Variables disponibles — haz clic para insertarlas en el editor</div>
            <div className="flex flex-wrap gap-1.5">
              {current.placeholders.map(p => {
                const raw = current.sampleData?.[p];
                const val = raw === undefined || raw === null ? "—" : String(raw);
                const isUrl = /^https?:\/\//i.test(val);
                const display = isUrl ? val.replace(/^https?:\/\//, "").slice(0, 32) + (val.length > 40 ? "…" : "") : (val.length > 40 ? val.slice(0, 40) + "…" : val);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => insertVariable(p)}
                    title={`Insertar {{${p}}} — valor actual: ${val}`}
                    className="group inline-flex items-center gap-1 text-[11px] bg-muted/60 border border-border rounded-md overflow-hidden hover:border-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <code className="px-1.5 py-0.5 bg-muted text-foreground group-hover:bg-primary group-hover:text-primary-foreground">{`{{${p}}}`}</code>
                    <span className="px-1.5 py-0.5 text-muted-foreground">{display}</span>
                  </button>
                );
              })}
            </div>
          </div>
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">HTML del email</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={formatDocument} className="h-7 text-xs gap-1">
                    <Wand2 className="w-3 h-3" /> Formatear
                  </Button>
                  <Button variant="ghost" size="sm" onClick={loadDefault} className="h-7 text-xs gap-1">
                    <FileCode className="w-3 h-3" /> Cargar por defecto
                  </Button>
                </div>
              </div>
              <div className="rounded-lg overflow-hidden border border-border bg-[#0a0a0a]">
                <Editor
                  height="520px"
                  defaultLanguage="html"
                  language="html"
                  value={html}
                  onChange={(value) => setHtml(value ?? "")}
                  onMount={handleEditorMount}
                  theme="autopilot-dark"
                  options={{
                    fontSize: 13,
                    fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
                    minimap: { enabled: false },
                    wordWrap: "on",
                    tabSize: 2,
                    insertSpaces: true,
                    formatOnPaste: true,
                    formatOnType: true,
                    autoClosingBrackets: "always",
                    autoClosingQuotes: "always",
                    autoClosingOvertype: "always",
                    autoIndent: "full",
                    bracketPairColorization: { enabled: true },
                    guides: { bracketPairs: true, indentation: true },
                    suggestOnTriggerCharacters: true,
                    quickSuggestions: { other: true, comments: false, strings: true },
                    scrollBeyondLastLine: false,
                    renderWhitespace: "selection",
                    smoothScrolling: true,
                    padding: { top: 12, bottom: 12 },
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Editor estilo VSCode: autocompletado de etiquetas, cierre automático y formato. Pulsa <span className="text-foreground font-medium">Previsualizar</span> para abrir el render en vivo.
              </p>
            </div>

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

    </div>
  );
}