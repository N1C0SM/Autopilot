import { errorMessage } from "@/shared/lib/runtimeValues";
import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { Spinner } from "@/shared/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { useConfirm } from "@/app/components/admin/content/useConfirm";
import { toast } from "sonner";
import scanPreviewAsset from "@/shared/assets/scan-preview.jpg.asset.json";
import scanUserAsset from "@/shared/assets/scan-example-user.jpg.asset.json";
import { extractInlineStyles, reinlineStyles } from "@/app/components/admin/email-style-utils";

const SCAN_PREVIEW_URL = `${window.location.origin}${scanPreviewAsset.url}`;
const SCAN_USER_PHOTO_URL = `${window.location.origin}${scanUserAsset.url}`;

type TemplateDef = {
  name: string;
  label: string;
  placeholders: string[];
  sampleData: Record<string, unknown>;
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
      headline: "Físico lean (~12% BF) con clara asimetría entre tren superior y tren inferior.",
      summary:
        "Composición: aprox. 12-13% de grasa corporal, ~70-72 kg estimados, somatotipo ecto-mesomorfo. " +
        "Puntos fuertes: definición abdominal visible (oblicuos y recto abdominal marcados), pecho con buena inserción y serrato presente. " +
        "Puntos débiles claros: 1) hombros (deltoides medio y posterior) muy poco desarrollados — la silueta cae recta desde el cuello, falta de anchura clavicular relativa al torso; " +
        "2) tren inferior infradesarrollado respecto al superior (cuádriceps planos, gemelo pequeño); " +
        "3) brazos (bíceps/tríceps) por debajo del potencial del torso. " +
        "Postura: ligera anteposición de hombros y cabeza adelantada (cifosis leve), típico de exceso de horas sentado. " +
        "Recomendación AI: priorizar volumen en deltoides lateral, espalda alta (rear delts + trapecio medio) y pierna 2x/semana durante 12 semanas. " +
        "Mantener déficit ligero (-200 kcal) con 1.8 g/kg de proteína para ganar masa magra sin perder definición.",
      monthsWithPlan: 4,
      monthsWithoutPlan: 18,
      SCAN_IMAGE_URL: SCAN_USER_PHOTO_URL,
      cardImageUrl: SCAN_USER_PHOTO_URL,
      photoUrl: SCAN_USER_PHOTO_URL,
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
  {
    name: "renewal-no-answer",
    label: "Renovación sin respuesta (Transformación 12 semanas)",
    placeholders: ["name", "cycleEndDate", "manageUrl"],
    sampleData: {
      name: "Nico",
      cycleEndDate: "30 de octubre de 2026",
      manageUrl: "https://autopilotplan.com/dashboard",
    },
  },
];

export default function EmailTemplatesEditor() {
  const [selected, setSelected] = useState(TEMPLATES[0].name);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [css, setCss] = useState("");
  const [activeTab, setActiveTab] = useState<"html" | "css">("html");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasOverride, setHasOverride] = useState(false);
  const { ask, dialog: confirmDialog } = useConfirm();
  const bcRef = useRef<BroadcastChannel | null>(null);
  const previewWinRef = useRef<Window | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const cssEditorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

  // Removes zero-width / invisible chars that React Email injects inside the
  // <Preview> block as padding for inbox preview. They are invisible in real
  // email clients but clutter the code editor. We also strip the entire hidden
  // preview <div> (display:none; max-height:0) which only contains padding.
  const sanitizeEditableHtml = (raw: string): string => {
    if (!raw) return raw;
    let s = raw;
    // Strip the hidden React Email preview padding div entirely
    s = s.replace(
      /<div[^>]*display:\s*none[^>]*>[\s\S]*?<\/div>/gi,
      (block) => (/max-height:\s*0/i.test(block) ? "" : block),
    );
    // Strip remaining zero-width and bidi-control chars
    s = s.replace(/[\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060\uFEFF]/g, "");
    return s;
  };

  // Prettier formatters for HTML / CSS. Brackets stay on the same line so
  // the editor is compact and easy to scan.
  const formatHtmlSrc = async (src: string): Promise<string> => {
    if (!src.trim()) return src;
    try {
      const [{ default: prettier }, { default: prettierPluginHtml }, { default: prettierPluginPostcss }] = await Promise.all([import("prettier/standalone"), import("prettier/plugins/html"), import("prettier/plugins/postcss")]);
      return await prettier.format(src, {
        parser: "html",
        plugins: [prettierPluginHtml],
        htmlWhitespaceSensitivity: "ignore",
        printWidth: 120,
        tabWidth: 2,
        useTabs: false,
        bracketSameLine: true,
        singleAttributePerLine: false,
      });
    } catch {
      return src;
    }
  };
  const formatCssSrc = async (src: string): Promise<string> => {
    if (!src.trim()) return src;
    try {
      const [{ default: prettier }, { default: prettierPluginHtml }, { default: prettierPluginPostcss }] = await Promise.all([import("prettier/standalone"), import("prettier/plugins/html"), import("prettier/plugins/postcss")]);
      return await prettier.format(src, {
        parser: "css",
        plugins: [prettierPluginPostcss],
        printWidth: 100,
        tabWidth: 2,
      });
    } catch {
      return src;
    }
  };

  const foldAll = (ed: Parameters<OnMount>[0]) => {
    try { ed?.getAction?.("editor.foldAll")?.run?.(); } catch { /* Best-effort browser feature; the primary flow remains available. */ }
  };

  const editorOptions = {
    fontSize: 13,
    fontFamily: "SF Mono, Menlo, Monaco, monospace",
    minimap: { enabled: false },
    wordWrap: "on" as const,
    tabSize: 2,
    insertSpaces: true,
    formatOnPaste: true,
    formatOnType: true,
    autoClosingBrackets: "always" as const,
    autoClosingQuotes: "always" as const,
    autoClosingOvertype: "always" as const,
    autoIndent: "full" as const,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    suggestOnTriggerCharacters: true,
    quickSuggestions: { other: true, comments: false, strings: true },
    scrollBeyondLastLine: false,
    renderWhitespace: "selection" as const,
    smoothScrolling: true,
    padding: { top: 12, bottom: 12 },
    folding: true,
    showFoldingControls: "always" as const,
  };

  const current = TEMPLATES.find(t => t.name === selected)!;

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Editor skin in the app palette: card background, iOS system colours for the syntax.
    monaco.editor.defineTheme("autopilot-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "FFFFFF", background: "1C1C1E" },
        { token: "tag", foreground: "FF9F0A" },
        { token: "tag.html", foreground: "FF9F0A" },
        { token: "metatag", foreground: "FF9F0A" },
        { token: "metatag.content.html", foreground: "30D158" },
        { token: "metatag.html", foreground: "FF9F0A" },
        { token: "delimiter", foreground: "8E8E93" },
        { token: "delimiter.html", foreground: "8E8E93" },
        { token: "attribute.name", foreground: "64D2FF" },
        { token: "attribute.name.html", foreground: "64D2FF" },
        { token: "attribute.value", foreground: "30D158" },
        { token: "attribute.value.html", foreground: "30D158" },
        { token: "string", foreground: "30D158" },
        { token: "string.html", foreground: "30D158" },
        { token: "comment", foreground: "8E8E93", fontStyle: "italic" },
        { token: "comment.html", foreground: "8E8E93", fontStyle: "italic" },
        { token: "number", foreground: "BF5AF2" },
        { token: "keyword", foreground: "FF9F0A" },
      ],
      colors: {
        "editor.background": "#1C1C1E",
        "editor.foreground": "#FFFFFF",
        "editor.lineHighlightBackground": "#2C2C2E",
        "editor.lineHighlightBorder": "#2C2C2E",
        "editorLineNumber.foreground": "#636366",
        "editorLineNumber.activeForeground": "#EBEBF5",
        "editorCursor.foreground": "#D7B45B",
        "editor.selectionBackground": "#D7B45B44",
        "editor.inactiveSelectionBackground": "#D7B45B22",
        "editorBracketMatch.background": "#D7B45B33",
        "editorBracketMatch.border": "#D7B45B",
        "editorIndentGuide.background": "#38383A",
        "editorIndentGuide.activeBackground": "#636366",
        "editorWhitespace.foreground": "#38383A",
        "scrollbarSlider.background": "#63636655",
        "scrollbarSlider.hoverBackground": "#63636688",
        "scrollbarSlider.activeBackground": "#636366AA",
      },
    });
    monaco.editor.setTheme("autopilot-dark");
    // Fold everything once the model is ready so the user sees a clean tree.
    setTimeout(() => foldAll(editor), 60);
  };

  const handleCssEditorMount: OnMount = (editor) => {
    cssEditorRef.current = editor;
    setTimeout(() => foldAll(editor), 60);
  };

  const insertVariable = (placeholder: string) => {
    const editor = activeTab === "html" ? editorRef.current : cssEditorRef.current;
    const text = `{{${placeholder}}}`;
    if (!editor) {
      if (activeTab === "html") setHtml(prev => prev + text);
      else setCss(prev => prev + text);
      return;
    }
    const selection = editor.getSelection();
    const id = { major: 1, minor: 1 };
    const op = { identifier: id, range: selection, text, forceMoveMarkers: true };
    editor.executeEdits("insert-var", [op]);
    editor.focus();
  };

  const formatDocument = async () => {
    const [h, c] = await Promise.all([formatHtmlSrc(html), formatCssSrc(css)]);
    setHtml(sanitizeEditableHtml(h));
    setCss(c);
    setTimeout(() => { foldAll(editorRef.current); foldAll(cssEditorRef.current); }, 30);
    toast.success("Formato aplicado");
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
    // Re-inline before sending to preview so what the admin sees matches what
    // the user will receive.
    const inlined = reinlineStyles(html, css);
    const payload = { customHtml: inlined, subject, templateData: current.sampleData };
    try { bcRef.current?.postMessage({ type: "update", payload }); } catch { /* Best-effort browser feature; the primary flow remains available. */ }
    try { localStorage.setItem(`email-preview-${selected}`, JSON.stringify(payload)); } catch { /* Best-effort browser feature; the primary flow remains available. */ }
  };

  // Debounced live-push whenever editable fields change
  useEffect(() => {
    const t = setTimeout(() => { pushLive(); }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, css, subject, selected]);

  // Load raw HTML (with inline styles) → split → format → set state and fold.
  const applyRawHtml = async (rawHtml: string) => {
    const cleaned = sanitizeEditableHtml(rawHtml ?? "");
    const { html: splitHtml, css: splitCss } = extractInlineStyles(cleaned);
    const [fmtHtml, fmtCss] = await Promise.all([
      formatHtmlSrc(splitHtml),
      formatCssSrc(splitCss),
    ]);
    setHtml(fmtHtml);
    setCss(fmtCss);
    setTimeout(() => { foldAll(editorRef.current); foldAll(cssEditorRef.current); }, 80);
  };

  const load = async () => {
    setLoading(true);
    try {
      // Try fetch override
      const { data: override } = await supabase
        .from("email_template_overrides")
        .select("subject, html, enabled")
        .eq("template_name", selected)
        .maybeSingle();

      if (override) {
        setSubject(override.subject);
        await applyRawHtml(override.html);
        setEnabled(override.enabled);
        setHasOverride(true);
      } else {
        // Load default from edge function
        const { data, error } = await supabase.functions.invoke("render-email-template", {
          body: { templateName: selected },
        });
        if (error) throw error;
        setSubject(data.subject ?? "");
        await applyRawHtml(data.html ?? "");
        setEnabled(true);
        setHasOverride(false);
      }
    } catch (e: unknown) {
      toast.error("No se pudo cargar la plantilla: " + (errorMessage(e) || "error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selected]);

  const save = async () => {
    if (!subject.trim() || !html.trim()) {
      toast.error("Asunto y HTML son obligatorios");
      return;
    }
    setSaving(true);
    try {
      // Re-inline CSS back into the HTML for Gmail/Outlook compatibility.
      const cleanHtml = sanitizeEditableHtml(reinlineStyles(html, css));
      const { error } = await supabase.from("email_template_overrides").upsert({
        template_name: selected,
        subject: subject.trim(),
        html: cleanHtml,
        enabled,
      }, { onConflict: "template_name" });
      if (error) throw error;
      toast.success("Plantilla guardada");
      setHasOverride(true);
    } catch (e: unknown) {
      toast.error("No se pudo guardar: " + (errorMessage(e) || "error"));
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    if (!(await ask({ title: "¿Restaurar la plantilla por defecto?", description: "Se borrará tu personalización.", confirmLabel: "Restaurar" }))) return;
    try {
      const { error } = await supabase.from("email_template_overrides")
        .delete().eq("template_name", selected);
      if (error) throw error;
      toast.success("Restaurada");
      load();
    } catch (e: unknown) {
      toast.error("Error: " + (errorMessage(e)));
    }
  };

  const preview = async () => {
    // Push latest state first, then open (or focus) the live preview tab.
    pushLive();
    const url = `/admin/email-preview/${encodeURIComponent(selected)}`;
    if (previewWinRef.current && !previewWinRef.current.closed) {
      try { previewWinRef.current.focus(); return; } catch { /* Best-effort browser feature; the primary flow remains available. */ }
    }
    previewWinRef.current = window.open(url, `email-preview-${selected}`);
  };

  const loadDefault = async () => {
    if (!(await ask({ title: "¿Cargar el HTML por defecto?", description: "Se sobrescribirá lo que tengas escrito en el editor. No se guardará hasta que pulses Guardar.", confirmLabel: "Cargar", destructive: false }))) return;
    try {
      const { data, error } = await supabase.functions.invoke("render-email-template", {
        body: { templateName: selected },
      });
      if (error) throw error;
      await applyRawHtml(data.html ?? "");
      setSubject(data.subject ?? "");
      toast.success("HTML por defecto cargado");
    } catch (e: unknown) {
      toast.error("Error: " + (errorMessage(e)));
    }
  };

  return (
    <div className="w-full space-y-8">
      <p className="type-subhead text-muted-foreground">
        Personaliza el asunto y el HTML de cada email transaccional. Si está desactivado, se usa el diseño por defecto.
      </p>

      <div className="space-y-6">
        <div>
          <Label htmlFor="email-template" className="mb-1.5 block text-muted-foreground">Plantilla</Label>
          <select
            id="email-template"
            value={selected}
            onChange={(e) => { void hapticSelection(); setSelected(e.target.value); }}
            className="field w-full"
          >
            {TEMPLATES.map(t => <option key={t.name} value={t.name}>{t.label}</option>)}
          </select>
          <div className="mt-4 space-y-2">
            <p className="type-footnote text-muted-foreground">Variables disponibles. Pulsa una para insertarla en el editor.</p>
            <div className="flex flex-wrap gap-2">
              {current.placeholders.map(p => {
                const raw = current.sampleData?.[p];
                const val = raw === undefined || raw === null ? "—" : String(raw);
                const isUrl = /^https?:\/\//i.test(val);
                const display = isUrl ? val.replace(/^https?:\/\//, "").slice(0, 32) + (val.length > 40 ? "…" : "") : (val.length > 40 ? val.slice(0, 40) + "…" : val);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { void hapticTap(); insertVariable(p); }}
                    title={`Insertar {{${p}}} — valor actual: ${val}`}
                    aria-label={`Insertar {{${p}}}, valor actual: ${val}`}
                    className="relative inline-flex h-[34px] max-w-full items-center gap-2 rounded-full bg-secondary px-3 type-footnote transition-colors active:bg-accent before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-['']"
                  >
                    <code className="shrink-0 font-mono">{`{{${p}}}`}</code>
                    <span className="min-w-0 truncate text-muted-foreground">{display}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner size="md" /></div>
        ) : (
          <>
            <ListGroup>
              <ListRow
                title="Personalización activa"
                subtitle={hasOverride ? "Estás usando una versión personalizada" : "Sin personalizar (se usa el diseño por defecto)"}
                trailing={<Switch checked={enabled} onCheckedChange={(v) => { void hapticSelection(); setEnabled(v); }} aria-label="Personalización activa" />}
              />
            </ListGroup>

            <div>
              <Label htmlFor="email-subject" className="mb-1.5 block text-muted-foreground">Asunto</Label>
              <Input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} enterKeyHint="done" placeholder="Asunto del email" />
            </div>

            <div className="space-y-3">
              <Tabs value={activeTab} onValueChange={(v) => { void hapticSelection(); setActiveTab(v as "html" | "css"); }}>
                <TabsList className="w-full sm:w-56">
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="css">CSS</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="overflow-hidden rounded-media bg-card">
                {activeTab === "html" ? (
                  <Editor
                    height="min(520px, 60vh)"
                    defaultLanguage="html"
                    language="html"
                    value={html}
                    onChange={(value) => setHtml(value ?? "")}
                    onMount={handleEditorMount}
                    theme="autopilot-dark"
                    options={editorOptions}
                  />
                ) : (
                  <Editor
                    height="min(520px, 60vh)"
                    defaultLanguage="css"
                    language="css"
                    value={css}
                    onChange={(value) => setCss(value ?? "")}
                    onMount={handleCssEditorMount}
                    theme="autopilot-dark"
                    options={editorOptions}
                  />
                )}
              </div>
              <p className="px-1 type-footnote text-muted-foreground">
                Editor de código. El CSS se reinyecta como <code className="font-mono">style="…"</code> al guardar para máxima compatibilidad (Gmail, Outlook). Al cargar se formatea y se colapsa todo automáticamente.
              </p>
            </div>

            <ListGroup>
              <ListRow title={<span className="text-primary">Previsualizar</span>} onClick={() => void preview()} />
              <ListRow title={<span className="text-primary">Formatear código</span>} onClick={() => void formatDocument()} />
              <ListRow title={<span className="text-primary">Cargar HTML por defecto</span>} onClick={() => void loadDefault()} />
              {hasOverride && <ListRow title="Restaurar por defecto" destructive onClick={() => void resetToDefault()} />}
            </ListGroup>

            <Button size="lg" onClick={() => { void hapticTap(); void save(); }} disabled={saving} className="w-full md:w-auto">
              {saving ? <Spinner size="sm" className="text-primary-foreground" /> : null}
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
