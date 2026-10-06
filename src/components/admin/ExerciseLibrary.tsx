import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Dumbbell, Edit2, Search, X, ArrowLeftRight, Video, VideoOff, Image as ImageIcon, ImageOff, RefreshCw, AlertTriangle, Sparkles, Loader2, ImagePlus } from "lucide-react";
import type { Exercise } from "@/types/training";
import {
  MUSCLE_GROUPS, EXERCISE_TYPES, MOVEMENT_PATTERNS, LEVELS,
  PRIORITIES, STIMULUS_TYPES, LOAD_LEVELS, FATIGUE_LEVELS, RECOMMENDED_ORDERS, SKILL_TAGS,
} from "@/types/training";
import VideoEmbed, { toEmbedUrl } from "@/components/VideoEmbed";
import ExerciseMedia, { ExerciseThumb } from "@/components/ExerciseMedia";
import { ExercisePreviewSheet, type ExercisePreviewData } from "@/components/ExercisePreviewSheet";

/**
 * Versión del estilo visual actual. Debe coincidir con MEDIA_STYLE_VERSION de la
 * edge function `exercise-video`; los medios con otra versión (o sin versión) se
 * marcan como "estilo antiguo" y se pueden regenerar.
 */
const MEDIA_STYLE_VERSION = 2;

/** Los vídeos con IA (sora-2) tardan bastante más de 4 minutos; damos 10. */
const VIDEO_DEADLINE_MS = 10 * 60 * 1000;

/** Columnas de medios que la biblioteca necesita además del tipo Exercise. */
type ExerciseRow = Exercise & {
  media_style_version?: number | null;
  image_generated_at?: string | null;
  video_generated_at?: string | null;
  media_error?: string | null;
};

type MediaFilter = "all" | "no-image" | "no-video" | "old-style" | "error";

const isOldStyle = (exercise: ExerciseRow) => (exercise.media_style_version ?? 0) !== MEDIA_STYLE_VERSION;
/** Tiene algún medio pero generado con un estilo anterior (o sin versión). */
const hasOutdatedMedia = (exercise: ExerciseRow) =>
  Boolean(exercise.image_url || exercise.video_url) && isOldStyle(exercise);
const needsGeneration = (exercise: ExerciseRow) =>
  !exercise.image_url || !exercise.video_url || hasOutdatedMedia(exercise);

/**
 * Ruta del objeto dentro del bucket público site-assets a partir de su URL
 * pública. Devuelve null para URLs externas (YouTube, etc.) o ajenas al prefijo.
 */
const siteAssetPath = (url: string | null | undefined, prefix: string): string | null => {
  if (!url) return null;
  const marker = "/site-assets/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split("?")[0];
  return path.startsWith(prefix) ? path : null;
};

const ALL_MUSCLE_GROUPS = [...MUSCLE_GROUPS, "Otro"] as const;

/* ── Helpers ── */

const SmallSelect = ({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: readonly string[]; placeholder?: string;
}) => (
  <select
    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    value={value} onChange={(e) => onChange(e.target.value)}
  >
    <option value="">{placeholder || "—"}</option>
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
);

const NumSelect = ({ value, onChange, options }: {
  value: number | null | undefined; onChange: (v: number) => void;
  options: readonly { value: number; label: string }[];
}) => (
  <select
    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    value={value ?? ""} onChange={(e) => onChange(parseInt(e.target.value) || 1)}
  >
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const GROUP_COLORS: Record<string, string> = {
  Pecho: "bg-secondary text-muted-foreground border-border/60",
  Espalda: "bg-secondary text-muted-foreground border-border/60",
  Hombros: "bg-secondary text-muted-foreground border-border/60",
  Bíceps: "bg-secondary text-muted-foreground border-border/60",
  Tríceps: "bg-secondary text-muted-foreground border-border/60",
  Piernas: "bg-secondary text-muted-foreground border-border/60",
  Glúteos: "bg-secondary text-muted-foreground border-border/60",
  Core: "bg-secondary text-muted-foreground border-border/60",
  Cardio: "bg-secondary text-muted-foreground border-border/60",
  "Cuerpo completo": "bg-secondary text-muted-foreground border-border/60",
  Otro: "bg-secondary text-muted-foreground border-border/60",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-secondary text-muted-foreground",
  2: "bg-primary/10 text-primary/80",
  3: "bg-primary/20 text-primary",
};

const STIMULUS_COLORS: Record<string, string> = {
  Fuerza: "bg-secondary text-muted-foreground",
  Hipertrofia: "bg-secondary text-muted-foreground",
  Resistencia: "bg-secondary text-muted-foreground",
  Isométrico: "bg-secondary text-muted-foreground",
};

/* ── Chips de estado de medios ── */

const MEDIA_BADGE_BASE = "flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium";
const MEDIA_BADGE_ON = `${MEDIA_BADGE_BASE} border-primary/30 bg-primary/15 text-primary`;
const MEDIA_BADGE_OFF = `${MEDIA_BADGE_BASE} border-border bg-secondary/60 text-muted-foreground`;

/* ── Exercise Form Dialog ── */

const ExerciseFormDialog = ({
  open, onOpenChange, initial, onSave, loading, allExercises, onMediaChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Exercise | null;
  onSave: (data: Partial<Exercise>) => void;
  loading: boolean;
  allExercises: Exercise[];
  onMediaChange?: () => void;
}) => {
  const [form, setForm] = useState<Partial<Exercise>>({});
  const [altSearch, setAltSearch] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [imgAiLoading, setImgAiLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genStatus, setGenStatus] = useState<string | null>(null);

  const fnErrorMessage = async (err: any, fallback: string) => {
    try {
      const body = await err?.context?.json?.();
      if (body?.error) return String(body.error);
    } catch { /* ignore */ }
    return fallback;
  };

  const generateImageWithAI = async () => {
    const id = initial?.id;
    if (!id) return;
    setImgAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("exercise-video", { body: { exercise_id: id, action: "image" } });
      if (error) {
        toast.error(await fnErrorMessage(error, "No se pudo generar la foto"));
        return;
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.image_url) throw new Error("No se recibió ninguna foto");
      set("image_url", data.image_url);
      onMediaChange?.();
      toast.success("Foto generada");
    } catch (e: any) {
      toast.error(e.message || "Error con IA");
    } finally {
      setImgAiLoading(false);
    }
  };


  const generateVideoWithAI = async () => {
    const id = initial?.id;
    if (!id) return;
    setGenLoading(true);
    try {
      const start = await supabase.functions.invoke("exercise-video", { body: { exercise_id: id, action: "create" } });
      if (start.error) {
        toast.error(await fnErrorMessage(start.error, "No se pudo iniciar el vídeo"));
        return;
      }
      if (start.data?.error) throw new Error(start.data.error);
      setGenStatus("Generando vídeo…");
      const deadline = Date.now() + VIDEO_DEADLINE_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 6000));
        const check = await supabase.functions.invoke("exercise-video", { body: { exercise_id: id, action: "check" } });
        if (check.error) {
          toast.error(await fnErrorMessage(check.error, "No se pudo comprobar el vídeo"));
          return;
        }
        const d = check.data;
        if (d?.error) throw new Error(d.error);
        if (d?.status === "completed" && d.video_url) {
          set("video_url", d.video_url);
          onMediaChange?.();
          setGenStatus(null);
          setGenLoading(false);
          toast.success("Vídeo generado");
          return;
        }
        if (d?.status === "failed") throw new Error(d.error || "La generación falló");
        const pct = d?.progress ? Math.round(d.progress * 100) : 0;
        setGenStatus(pct > 0 ? `Generando vídeo… ${pct}%` : "Generando vídeo…");
      }
      throw new Error("El vídeo está tardando más de lo normal. Cierra y vuelve a abrir el ejercicio en un minuto.");
    } catch (e: any) {
      toast.error(e.message || "Error con IA");
    } finally {
      setGenStatus(null);
      setGenLoading(false);
    }
  };

  const uploadImage = async (file: File) => {
    setImgUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `exercise-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      set("image_url", data.publicUrl);
      toast.success("Imagen subida");
    } catch (e: any) {
      toast.error(e.message || "Error al subir la imagen");
    }
    setImgUploading(false);
  };

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : {
        name: "", muscle_group: "", exercise_type: "", movement_pattern: "",
        level: 1, priority: 2, stimulus_type: "", load_level: "", fatigue_level: "", recommended_order: 2,
        alternative_id: null, skill_tag: null, progression_order: null, video_url: "",
        is_stable: true, is_progressable: true, high_tension: true,
      });
      setAltSearch("");
    }
  }, [open, initial]);

  const set = (k: keyof Exercise, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const autofillWithAI = async () => {
    const name = form.name?.trim();
    if (!name) { toast.error("Escribe un nombre primero"); return; }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-classify-exercise", { body: { name } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForm((f) => ({ ...f, ...data, name: f.name }));
      toast.success("Campos rellenados con IA");
    } catch (e: any) {
      toast.error(e.message || "Error con IA");
    }
    setAiLoading(false);
  };

  // Filter exercises for alternative selection: different type, same muscle group preferred
  const altCandidates = useMemo(() => {
    const currentId = initial?.id;
    let candidates = allExercises.filter((e) => e.id !== currentId);
    if (altSearch) {
      const q = altSearch.toLowerCase();
      candidates = candidates.filter((e) => e.name.toLowerCase().includes(q));
    }
    // Sort: same muscle group first, then opposite type first
    const currentType = form.exercise_type;
    candidates.sort((a, b) => {
      const aOpp = currentType && a.exercise_type && a.exercise_type !== currentType ? -1 : 0;
      const bOpp = currentType && b.exercise_type && b.exercise_type !== currentType ? -1 : 0;
      if (aOpp !== bOpp) return aOpp - bOpp;
      const aSame = a.muscle_group === form.muscle_group ? -1 : 0;
      const bSame = b.muscle_group === form.muscle_group ? -1 : 0;
      return aSame - bSame;
    });
    return candidates.slice(0, 20);
  }, [allExercises, initial, altSearch, form.exercise_type, form.muscle_group]);

  const selectedAlt = allExercises.find((e) => e.id === form.alternative_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Hero: vídeo del ejercicio arriba del todo (se reproduce al pasar el ratón) */}
        <div className="-mx-6 -mt-6 mb-1 overflow-hidden border-b border-border bg-black">
          <ExerciseMedia video={form.video_url} image={form.image_url} name={form.name} />
        </div>

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExerciseThumb image={form.image_url} name={form.name} size="xs" />
            {initial ? "Editar ejercicio" : "Nuevo ejercicio"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">

          {/* Basic info */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Información básica</p>
            <div>
              <Label className="text-xs">Nombre</Label>
              <div className="flex gap-2 mt-1">
                <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Press banca" />
                <Button type="button" variant="secondary" size="sm" onClick={autofillWithAI} disabled={aiLoading || !form.name?.trim()} className="shrink-0 gap-1.5">
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  IA
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Escribe el nombre y pulsa IA para clasificar automáticamente todos los campos.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Categoría · grupo muscular</Label>
                <SmallSelect value={form.muscle_group || ""} onChange={(v) => set("muscle_group", v)} options={ALL_MUSCLE_GROUPS} placeholder="Seleccionar..." />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <SmallSelect value={form.exercise_type || ""} onChange={(v) => set("exercise_type", v)} options={EXERCISE_TYPES} placeholder="Tipo..." />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Clasificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Patrón</Label>
                <SmallSelect value={form.movement_pattern || ""} onChange={(v) => set("movement_pattern", v)} options={MOVEMENT_PATTERNS} placeholder="Patrón..." />
              </div>
              <div>
                <Label className="text-xs">Estímulo</Label>
                <SmallSelect value={form.stimulus_type || ""} onChange={(v) => set("stimulus_type", v)} options={STIMULUS_TYPES} placeholder="Estímulo..." />
              </div>
              <div>
                <Label className="text-xs">Nivel</Label>
                <NumSelect value={form.level} onChange={(v) => set("level", v)} options={LEVELS} />
              </div>
              <div>
                <Label className="text-xs">Prioridad</Label>
                <NumSelect value={form.priority} onChange={(v) => set("priority", v)} options={PRIORITIES} />
              </div>
            </div>
          </div>

          {/* Generation params */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Parámetros de generación</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Carga</Label>
                <SmallSelect value={form.load_level || ""} onChange={(v) => set("load_level", v)} options={LOAD_LEVELS} placeholder="—" />
              </div>
              <div>
                <Label className="text-xs">Fatiga</Label>
                <SmallSelect value={form.fatigue_level || ""} onChange={(v) => set("fatigue_level", v)} options={FATIGUE_LEVELS} placeholder="—" />
              </div>
              <div>
                <Label className="text-xs">Orden</Label>
                <NumSelect value={form.recommended_order} onChange={(v) => set("recommended_order", v)} options={RECOMMENDED_ORDERS} />
              </div>
            </div>
          </div>

          {/* Hard criteria */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Criterios obligatorios</p>
            <p className="text-[10px] text-muted-foreground -mt-1">Si alguno está desactivado, el ejercicio NO se incluirá en planes generados.</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "is_stable" as const, label: "Estable", hint: "Permite ejecución sin que el equilibrio limite la carga" },
                { key: "is_progressable" as const, label: "Progresable", hint: "Se puede aumentar carga/reps sesión a sesión" },
                { key: "high_tension" as const, label: "Alta tensión", hint: "Genera mucha tensión en el músculo objetivo" },
              ].map(({ key, label, hint }) => {
                const checked = (form as any)[key] ?? true;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set(key as any, !checked)}
                    title={hint}
                    className={`rounded-lg border p-2 text-left transition-colors ${
                      checked
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-secondary/40 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{label}</span>
                      <span className={`text-[10px] font-bold ${checked ? "text-primary" : "text-muted-foreground"}`}>
                        {checked ? "SÍ" : "NO"}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skill Progression */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Progresión de Skill</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Skill</Label>
                <SmallSelect value={form.skill_tag || ""} onChange={(v) => set("skill_tag", v || null)} options={SKILL_TAGS} placeholder="Ninguno" />
              </div>
              <div>
                <Label className="text-xs">Orden progresión</Label>
                <Input
                  type="number" min={1} max={20}
                  className="h-9"
                  value={form.progression_order ?? ""}
                  onChange={(e) => set("progression_order", e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="1=básico"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Asigna un skill y orden para crear cadenas de progresión (1=más fácil → mayor=más difícil)</p>
          </div>

          {/* Imagen */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ImagePlus className="w-3.5 h-3.5" /> Imagen del ejercicio
            </p>
            <div className="flex items-center gap-3">
              <ExerciseThumb image={form.image_url} name={form.name} size="lg" />
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-secondary/70 transition-colors">
                    {imgUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                    {form.image_url ? "Cambiar imagen" : "Subir imagen"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={imgUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {initial?.id && (
                    <Button type="button" variant="secondary" size="sm" onClick={generateImageWithAI} disabled={imgAiLoading} className="h-[30px] gap-1.5 px-3 text-xs">
                      {imgAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {form.image_url ? "Otra foto con IA" : "Generar foto con IA"}
                    </Button>
                  )}
                </div>
                {form.image_url && (
                  <button type="button" onClick={() => set("image_url", null)} className="block text-[10px] text-muted-foreground hover:text-destructive">
                    Quitar imagen
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground">Se mostrará al usuario en su plan. Las fotos generadas con IA usan siempre el mismo estilo que los vídeos.</p>
              </div>

            </div>
          </div>

          {/* Video */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" /> Vídeo del ejercicio
            </p>
            <Input
              value={form.video_url || ""}
              onChange={(e) => set("video_url", e.target.value)}
              placeholder="YouTube, Vimeo o MP4 directo (https://...)"
              className="h-9"
            />
            {initial?.id ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={generateVideoWithAI}
                disabled={genLoading}
                className="gap-1.5 self-start"
              >
                {genLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {genStatus || (form.video_url ? "Generar otro vídeo con IA" : "Generar vídeo con IA")}
              </Button>
            ) : (
              <p className="text-[10px] text-muted-foreground">Guarda el ejercicio y después podrás generar su vídeo con IA.</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Pega cualquier URL de YouTube (incluye Shorts), Vimeo o un .mp4 directo, o genera el vídeo con IA. Se mostrará al usuario en su entrenamiento.
            </p>
            <p className="text-[10px] text-muted-foreground">El vídeo se ve arriba, en la cabecera del ejercicio.</p>

          </div>

          {/* Alternative exercise */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Alternativa
            </p>
            {selectedAlt ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-primary/30 bg-primary/5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedAlt.name}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedAlt.exercise_type} · {selectedAlt.muscle_group}</p>
                </div>
                <button onClick={() => set("alternative_id", null)} className="p-1 rounded hover:bg-secondary">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Buscar alternativa..."
                  value={altSearch}
                  onChange={(e) => setAltSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                {altSearch && (
                  <div className="max-h-32 overflow-y-auto rounded-md border bg-popover">
                    {altCandidates.length > 0 ? altCandidates.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => { set("alternative_id", e.id); setAltSearch(""); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center justify-between"
                      >
                        <span className="font-medium truncate">{e.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{e.exercise_type}</span>
                      </button>
                    )) : (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {(() => {
            const allCriteria = (form.is_stable ?? true) && (form.is_progressable ?? true) && (form.high_tension ?? true);
            return (
              <>
                {!allCriteria && (
                  <p className="text-[11px] text-destructive text-center">
                    Debe cumplir los 3 criterios obligatorios para añadirse a la biblioteca.
                  </p>
                )}
                <Button
                  className="w-full"
                  onClick={() => onSave(form)}
                  disabled={loading || !form.name?.trim() || !allCriteria}
                >
                  {initial ? "Guardar cambios" : "Añadir ejercicio"}
                </Button>
              </>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ── Main Component ── */

const ExerciseLibrary = () => {
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [preview, setPreview] = useState<ExercisePreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [mediaBatchOpen, setMediaBatchOpen] = useState(false);
  const [mediaBatch, setMediaBatch] = useState<{ current: number; total: number; exercise: string; task: string; errors: number } | null>(null);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");

  // Cola de generación: cancelación limpia y espera interrumpible entre sondeos.
  const cancelRef = useRef(false);
  const sleepRef = useRef<{ id: number; resolve: () => void } | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseRow | null>(null);

  const fetchExercises = async () => {
    const { data } = await supabase.from("exercises")
      .select("id, name, muscle_group, image_url, video_url, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level, recommended_order, alternative_id, skill_tag, progression_order, is_stable, is_progressable, high_tension, media_style_version, image_generated_at, video_generated_at, media_error")
      .order("muscle_group").order("recommended_order").order("name");
    // Las columnas de medios vienen de la migración 20261006130000; los tipos
    // generados de Supabase se regeneran al desplegar, de ahí el doble cast.
    if (data) setExercises(data as unknown as ExerciseRow[]);
  };

  useEffect(() => { fetchExercises(); }, []);

  // Al desmontar: cancelamos la cola y despertamos la espera pendiente para no
  // dejar timers ni promesas colgando.
  useEffect(() => () => {
    cancelRef.current = true;
    const pending = sleepRef.current;
    if (pending) {
      window.clearTimeout(pending.id);
      sleepRef.current = null;
      pending.resolve();
    }
  }, []);

  const interruptibleSleep = (ms: number) =>
    new Promise<void>((resolve) => {
      if (cancelRef.current) {
        resolve();
        return;
      }
      const id = window.setTimeout(() => {
        sleepRef.current = null;
        resolve();
      }, ms);
      sleepRef.current = { id, resolve };
    });

  const cancelMediaQueue = () => {
    cancelRef.current = true;
    const pending = sleepRef.current;
    if (pending) {
      window.clearTimeout(pending.id);
      sleepRef.current = null;
      pending.resolve();
    }
  };

  const invokeExerciseMedia = async (exerciseId: string, action: "image" | "create" | "check") => {
    const { data, error } = await supabase.functions.invoke("exercise-video", {
      body: { exercise_id: exerciseId, action },
    });
    if (error) {
      let message = "No se pudo generar el recurso";
      try {
        const body = await error.context?.json?.();
        if (body?.error) message = String(body.error);
      } catch {
        // Keep the actionable fallback when the function response is not JSON.
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  /** Cola en serie que nunca se detiene por un error: lo registra y sigue. */
  const generatePendingMedia = async () => {
    const queue = pendingQueue;
    if (queue.length === 0) {
      setMediaBatchOpen(false);
      toast.success("No hay medios pendientes con los filtros actuales.");
      return;
    }

    setMediaBatchOpen(false);
    cancelRef.current = false;
    const total = queue.length;
    let completed = 0;
    let errors = 0;

    for (let index = 0; index < total; index++) {
      if (cancelRef.current) break;
      const exercise = queue[index];
      const setProgress = (task: string) =>
        setMediaBatch({ current: index + 1, total, exercise: exercise.name, task, errors });

      try {
        const oldStyle = hasOutdatedMedia(exercise);

        if (!exercise.image_url || oldStyle) {
          setProgress("Generando imagen");
          const image = await invokeExerciseMedia(exercise.id, "image");
          if (!image?.image_url) throw new Error("La IA no devolvió una imagen.");
          setExercises((current) => current.map((item) => item.id === exercise.id
            ? { ...item, image_url: image.image_url, media_style_version: MEDIA_STYLE_VERSION, image_generated_at: new Date().toISOString(), media_error: null }
            : item));
        }
        if (cancelRef.current) break;

        if (!exercise.video_url || oldStyle) {
          setProgress("Generando técnica en vídeo");
          await invokeExerciseMedia(exercise.id, "create");
          const deadline = Date.now() + VIDEO_DEADLINE_MS;
          let completedVideoUrl: string | null = null;
          while (Date.now() < deadline && !cancelRef.current) {
            await interruptibleSleep(6000);
            if (cancelRef.current) break;
            const status = await invokeExerciseMedia(exercise.id, "check");
            if (status?.status === "failed") throw new Error(status.error || "La generación del vídeo falló.");
            if (status?.status === "completed" && status.video_url) {
              completedVideoUrl = status.video_url;
              break;
            }
            const progress = status?.progress ? ` (${Math.round(status.progress * 100)}%)` : "";
            setProgress(`Generando técnica en vídeo${progress}`);
          }
          if (cancelRef.current) break;
          if (!completedVideoUrl) throw new Error("El vídeo sigue generándose. Puedes reanudar la cola más tarde; el trabajo se reanudará.");
          setExercises((current) => current.map((item) => item.id === exercise.id
            ? { ...item, video_url: completedVideoUrl, media_style_version: MEDIA_STYLE_VERSION, video_generated_at: new Date().toISOString(), media_error: null }
            : item));
        }

        completed++;
      } catch (error) {
        errors++;
        const message = error instanceof Error ? error.message : "No se pudo completar la generación.";
        console.error(`No se pudieron generar los medios de "${exercise.name}"`, error);
        // El error se guarda en la fila (media_error) y la cola continúa.
        setExercises((current) => current.map((item) => item.id === exercise.id ? { ...item, media_error: message } : item));
        toast.error(`${exercise.name}: ${message}`);
      }
    }

    const cancelled = cancelRef.current;
    cancelRef.current = false;
    setMediaBatch(null);
    void fetchExercises();
    const detail = `${completed}/${total} · errores: ${errors}`;
    if (cancelled) toast.info(`Cola cancelada (${detail}).`);
    else if (errors > 0) toast.warning(`Medios generados con incidencias (${detail}).`);
    else toast.success(`Medios generados (${detail}).`);
  };

  const filtered = useMemo(() => {
    let result = exercises;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.name.toLowerCase().includes(q));
    }
    if (filterGroup) result = result.filter((e) => (e.muscle_group || "Sin grupo") === filterGroup);
    if (filterType) result = result.filter((e) => e.exercise_type === filterType);
    if (mediaFilter === "no-image") result = result.filter((e) => !e.image_url);
    if (mediaFilter === "no-video") result = result.filter((e) => !e.video_url);
    if (mediaFilter === "old-style") result = result.filter(hasOutdatedMedia);
    if (mediaFilter === "error") result = result.filter((e) => Boolean(e.media_error));
    return result;
  }, [exercises, search, filterGroup, filterType, mediaFilter]);

  /** Pendientes visibles: lo que realmente procesará el botón "Generar pendientes". */
  const pendingQueue = useMemo(() => filtered.filter(needsGeneration), [filtered]);

  const mediaFilterOptions = useMemo(() => ([
    { value: "all" as const, label: "Todos", count: exercises.length },
    { value: "no-image" as const, label: "Sin imagen", count: exercises.filter((e) => !e.image_url).length },
    { value: "no-video" as const, label: "Sin vídeo", count: exercises.filter((e) => !e.video_url).length },
    { value: "old-style" as const, label: "Estilo antiguo", count: exercises.filter(hasOutdatedMedia).length },
    { value: "error" as const, label: "Con error", count: exercises.filter((e) => Boolean(e.media_error)).length },
  ]), [exercises]);

  const pendingCounts = useMemo(() => ({
    missingImage: pendingQueue.filter((e) => !e.image_url).length,
    missingVideo: pendingQueue.filter((e) => !e.video_url).length,
    oldStyle: pendingQueue.filter(hasOutdatedMedia).length,
  }), [pendingQueue]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    exercises.forEach((e) => {
      const g = e.muscle_group || "Sin grupo";
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [exercises]);

  const handleSave = async (form: Partial<Exercise>) => {
    if (!(form.is_stable ?? true) || !(form.is_progressable ?? true) || !(form.high_tension ?? true)) {
      toast.error("El ejercicio debe ser estable, progresable y de alta tensión para añadirse a la biblioteca.");
      return;
    }
    setLoading(true);
    const payload = {
      name: form.name?.trim(),
      muscle_group: form.muscle_group || null,
      exercise_type: form.exercise_type || null,
      movement_pattern: form.movement_pattern || null,
      level: form.level ?? 1,
      priority: form.priority ?? 2,
      stimulus_type: form.stimulus_type || null,
      load_level: form.load_level || null,
      fatigue_level: form.fatigue_level || null,
      recommended_order: form.recommended_order ?? 2,
      alternative_id: form.alternative_id || null,
      skill_tag: form.skill_tag || null,
      progression_order: form.progression_order ?? null,
      video_url: form.video_url?.trim() || null,
      image_url: form.image_url || null,
      is_stable: form.is_stable ?? true,
      is_progressable: form.is_progressable ?? true,
      high_tension: form.high_tension ?? true,
    };

    if (editingExercise) {
      const { error } = await supabase.from("exercises").update(payload as any).eq("id", editingExercise.id);
      if (!error) { toast.success("Ejercicio actualizado"); } else { toast.error("Error al actualizar"); }
    } else {
      const { error } = await supabase.from("exercises").insert(payload as any);
      if (!error) { toast.success("Ejercicio añadido"); } else { toast.error("Error al añadir"); }
    }
    setDialogOpen(false);
    setEditingExercise(null);
    fetchExercises();
    setLoading(false);
  };

  const deleteExercise = async (id: string) => {
    const target = exercises.find((exercise) => exercise.id === id);
    const { error } = await supabase.from("exercises").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar");
      return;
    }
    setExercises((e) => e.filter((ex) => ex.id !== id));
    // Higiene de medios: primero se borra la fila (revoca el acceso) y después
    // los objetos del bucket. Si la limpieza falla, el ejercicio ya no existe.
    const orphanPaths = [
      siteAssetPath(target?.image_url, "exercise-images/"),
      siteAssetPath(target?.video_url, "exercise-videos/"),
    ].filter((path): path is string => Boolean(path));
    if (orphanPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage.from("site-assets").remove(orphanPaths);
      if (cleanupError) console.warn("No se pudieron limpiar los medios del ejercicio eliminado", cleanupError);
    }
    toast.success("Ejercicio eliminado");
  };

  const levelLabel = (l: number) => LEVELS.find((x) => x.value === l)?.label || "";
  const priorityLabel = (p: number) => PRIORITIES.find((x) => x.value === p)?.label || "";
  const orderLabel = (o: number) => RECOMMENDED_ORDERS.find((x) => x.value === o)?.label || "";

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-[0_16px_44px_-36px_hsl(var(--primary)/.55)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
            <Dumbbell className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-bold font-display">Biblioteca de ejercicios</h2>
            <p className="text-xs text-muted-foreground">{filtered.length} de {exercises.length} ejercicios</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mediaBatch ? (
            <>
              <p role="status" className="text-xs text-muted-foreground">
                {mediaBatch.current}/{mediaBatch.total} · errores: {mediaBatch.errors} · {mediaBatch.exercise}: {mediaBatch.task}
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={cancelMediaQueue} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pendingQueue.length === 0}
              onClick={() => setMediaBatchOpen(true)}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generar pendientes ({pendingQueue.length})
            </Button>
          )}
        </div>
      </div>

        <div className="space-y-4">
          {/* Search + Add */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 h-10"
                placeholder="Buscar ejercicio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <Button onClick={() => { setEditingExercise(null); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Nuevo
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Músculo</span>
              <select
                className="flex h-10 w-full rounded-xl border border-input bg-secondary/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                value={filterGroup ?? ""}
                onChange={(event) => setFilterGroup(event.target.value || null)}
                aria-label="Filtrar ejercicios por músculo"
              >
                <option value="">Todos los músculos</option>
                {Object.keys(groupCounts).sort((a, b) => a.localeCompare(b, "es")).map((group) => (
                  <option key={group} value={group}>{group} · {groupCounts[group]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Tipo de ejercicio</span>
              <select
                className="flex h-10 w-full rounded-xl border border-input bg-secondary/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                value={filterType ?? ""}
                onChange={(event) => setFilterType(event.target.value || null)}
                aria-label="Filtrar ejercicios por tipo"
              >
                <option value="">Todos los tipos</option>
                {EXERCISE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
          </div>

          {/* Chips de estado de medios */}
          <div className="flex flex-wrap items-center gap-1.5">
            {mediaFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMediaFilter(option.value)}
                aria-pressed={mediaFilter === option.value}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  mediaFilter === option.value
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
                }`}
              >
                {option.label} · {option.count}
              </button>
            ))}
          </div>

          {/* Lista única y limpia */}
          {filtered.length > 0 ? (
            <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80">
              {filtered.map((ex) => (
                <div
                  key={ex.id}
                  className="group flex items-start gap-3 bg-card px-3.5 py-3 transition-colors hover:bg-secondary/40"
                >
                  <button
                    type="button"
                    onClick={() => setPreview({
                      name: ex.name,
                      image: ex.image_url,
                      video: ex.video_url,
                      detail: [ex.muscle_group, ex.exercise_type].filter(Boolean).join(" · ") || null,
                    })}
                    aria-label={`Ver el vídeo de ${ex.name}`}
                    className="shrink-0 rounded-xl transition-opacity hover:opacity-80"
                  >
                    <ExerciseThumb image={ex.image_url} video={ex.video_url} name={ex.name} size="sm" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ex.name}</p>
                    {/* Clasificación y estado de medios en la misma fila que envuelve:
                        antes las insignias iban en su propia columna a la derecha y
                        se comían el nombre del ejercicio. */}
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {[ex.muscle_group, ex.exercise_type].filter(Boolean).map((category) => (
                        <span
                          key={category}
                          className="rounded-full border border-border bg-secondary/60 px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {category}
                        </span>
                      ))}
                      {!ex.muscle_group && !ex.exercise_type && (
                        <span className="text-xs text-muted-foreground">Sin clasificar</span>
                      )}
                      <span className={ex.image_url ? MEDIA_BADGE_ON : MEDIA_BADGE_OFF}>
                        {ex.image_url ? <ImageIcon className="h-2.5 w-2.5" /> : <ImageOff className="h-2.5 w-2.5" />}
                        {ex.image_url ? "Imagen" : "Sin imagen"}
                      </span>
                      <span className={ex.video_url ? MEDIA_BADGE_ON : MEDIA_BADGE_OFF}>
                        {ex.video_url ? <Video className="h-2.5 w-2.5" /> : <VideoOff className="h-2.5 w-2.5" />}
                        {ex.video_url ? "Vídeo" : "Sin vídeo"}
                      </span>
                      {hasOutdatedMedia(ex) && (
                        <span className={MEDIA_BADGE_OFF} title="Generado con una versión de estilo anterior">
                          <RefreshCw className="h-2.5 w-2.5" /> Estilo antiguo
                        </span>
                      )}
                      {ex.media_error && (
                        <span
                          className={`${MEDIA_BADGE_BASE} border-destructive/40 bg-destructive/10 text-destructive`}
                          title={ex.media_error}
                        >
                          <AlertTriangle className="h-2.5 w-2.5" /> Error
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => { setEditingExercise(ex); setDialogOpen(true); }}
                      className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteExercise(ex.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Dumbbell className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {exercises.length === 0 ? "No hay ejercicios aún. Añade el primero." : "Sin resultados para esta búsqueda."}
              </p>
            </div>
          )}
        </div>

      {/* Form Dialog */}
      <ExerciseFormDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingExercise(null); }}
        initial={editingExercise}
        onSave={handleSave}
        loading={loading}
        allExercises={exercises}
        onMediaChange={fetchExercises}
      />
      <AlertDialog open={mediaBatchOpen} onOpenChange={setMediaBatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generar medios pendientes</AlertDialogTitle>
            <AlertDialogDescription>
              Se generará imagen y/o vídeo de técnica con IA para {pendingQueue.length} ejercicios de los filtros actuales
              ({pendingCounts.missingImage} sin imagen, {pendingCounts.missingVideo} sin vídeo y {pendingCounts.oldStyle} con
              estilo antiguo, que se regenerarán). El proceso puede tardar bastante y consume créditos de IA. Los recursos
              se guardan a medida que se completan: si se interrumpe o lo cancelas, podrás reanudarlo sin repetir los que ya estén listos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ahora no</AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingQueue.length === 0 || mediaBatch !== null}
              onClick={(event) => {
                event.preventDefault();
                void generatePendingMedia();
              }}
            >
              Generar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ver el vídeo de un ejercicio sin entrar a editarlo */}
      <ExercisePreviewSheet exercise={preview} onClose={() => setPreview(null)} />
    </div>
  );
};

export default ExerciseLibrary;
