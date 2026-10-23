import { errorMessage, functionErrorMessage } from "@/shared/lib/runtimeValues";
import { getExerciseTrackingConfig, TRACKING_MODES } from "@/shared/lib/exerciseTrackingConfig";
import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Progress } from "@/shared/components/ui/progress";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Spinner } from "@/shared/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Check, Dumbbell, Image as ImageIcon, ImageOff, Play, RefreshCw, AlertTriangle, Search, Video, VideoOff, X,
  type LucideIcon,
} from "lucide-react";
import type { Exercise } from "@/shared/types/training";
import {
  MUSCLE_GROUPS, EXERCISE_TYPES, MOVEMENT_PATTERNS, LEVELS,
  PRIORITIES, STIMULUS_TYPES, LOAD_LEVELS, FATIGUE_LEVELS, RECOMMENDED_ORDERS, SKILL_TAGS,
} from "@/shared/types/training";
import ExerciseMedia, { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { ExercisePreviewSheet, type ExercisePreviewData } from "@/app/components/ExercisePreviewSheet";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import { skipAutoFocusOnTouch } from "@/app/components/admin-library/touchAutoFocus";
import { WithImageFallback } from "@/app/components/admin-library/WithImageFallback";

/**
 * Versión del estilo visual actual. Debe coincidir con MEDIA_STYLE_VERSION de la
 * edge function`exercise-video`; los medios con otra versión (o sin versión) se
 * marcan como"estilo antiguo" y se pueden regenerar.
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
  /** 1 = vídeo clave: la cola de pendientes lo genera primero. */
  video_priority?: number | null;
};

type MediaFilter ="all" |"no-image" |"no-video" |"old-style" |"error";

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
  const marker ="/site-assets/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split("?")[0];
  return path.startsWith(prefix) ? path : null;
};

const ALL_MUSCLE_GROUPS = [...MUSCLE_GROUPS,"Otro"] as const;

/* ── Helpers ── */

const SELECT_CLASS =
  "field w-full text-foreground focus-visible:outline-none md:focus-visible:ring-2 md:focus-visible:ring-primary/40";

const SmallSelect = ({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: readonly string[]; placeholder?: string;
}) => (
  <select
    className={SELECT_CLASS}
    value={value}
    onChange={(e) => { void hapticSelection(); onChange(e.target.value); }}
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
    className={SELECT_CLASS}
    value={value ?? ""}
    onChange={(e) => { void hapticSelection(); onChange(parseInt(e.target.value) || 1); }}
  >
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

/** Campo suelto con su etiqueta encima. */
const FormField = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
  <label className={cn("block min-w-0", className)}>
    <span className="mb-1.5 block type-subhead text-muted-foreground">{label}</span>
    {children}
  </label>
);

/** Sección de la hoja: cabecera de grupo y contenido apilado. */
const FormSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h3 className="type-group-header px-4 pb-1.5">{title}</h3>
    <div className="space-y-3">{children}</div>
  </section>
);

const Hint = ({ children }: { children: ReactNode }) => (
  <p className="type-footnote text-muted-foreground">{children}</p>
);

const TRACKING_LABELS: Record<string, string> = {
  weighted_reps: "KG + Repes",
  bodyweight_reps: "Peso corporal (PC)",
  weighted_bodyweight: "Lastre + Repes",
  seconds_only: "Segundos",
  assisted_reps: "Asistida + Repes",
};

const CRITERIA = [
  { key: "is_stable" as const, label: "Estable", hint: "Permite ejecución sin que el equilibrio limite la carga" },
  { key: "is_progressable" as const, label: "Progresable", hint: "Se puede aumentar carga/reps sesión a sesión" },
  { key: "high_tension" as const, label: "Alta tensión", hint: "Genera mucha tensión en el músculo objetivo" },
];

/* ── Fila de la biblioteca ── */

type MediaTone = "ok" | "missing" | "stale" | "error";

const MEDIA_TONE_CLASS: Record<MediaTone, string> = {
  ok: "text-muted-foreground",
  missing: "text-muted-foreground/60",
  stale: "text-primary",
  error: "text-destructive",
};

const MediaStatus = ({ tone, icon: Icon, label }: { tone: MediaTone; icon: LucideIcon; label: string }) => (
  <span className={cn("inline-flex items-center gap-1", MEDIA_TONE_CLASS[tone])}>
    <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
    {label}
  </span>
);

/** Clasificación y estado de medios de un ejercicio, para el subtítulo de su fila. */
const ExerciseMeta = ({ exercise: ex }: { exercise: ExerciseRow }) => {
  const categories = [ex.muscle_group, ex.exercise_type].filter((c): c is string => Boolean(c));
  return (
    <>
      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {categories.map((category) => (
          <span key={category} className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
            {category}
          </span>
        ))}
        {categories.length === 0 && <span>Sin clasificar</span>}
        <MediaStatus
          tone={ex.image_url ? "ok" : "missing"}
          icon={ex.image_url ? ImageIcon : ImageOff}
          label={ex.image_url ? "Imagen" : "Sin imagen"}
        />
        <MediaStatus
          tone={ex.video_url ? "ok" : "missing"}
          icon={ex.video_url ? Video : VideoOff}
          label={ex.video_url ? "Vídeo" : "Sin vídeo"}
        />
        {hasOutdatedMedia(ex) && <MediaStatus tone="stale" icon={RefreshCw} label="Estilo antiguo" />}
        {ex.media_error && <MediaStatus tone="error" icon={AlertTriangle} label="Error" />}
      </span>
      {ex.media_error ? <span className="mt-1 line-clamp-2 block text-destructive">{ex.media_error}</span> : null}
    </>
  );
};

/* ── Exercise Form Dialog ── */

const ExerciseFormDialog = ({
  open, onOpenChange, initial, onSave, onDelete, loading, allExercises, onMediaChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Exercise | null;
  onSave: (data: Partial<Exercise>) => void;
  onDelete?: (exercise: Exercise) => void;
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
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fnErrorMessage = functionErrorMessage;

  const generateImageWithAI = async () => {
    const id = initial?.id;
    if (!id) return;
    setImgAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("exercise-video", { body: { exercise_id: id, action:"image" } });
      if (error) {
        toast.error(await fnErrorMessage(error,"No se pudo generar la foto"));
        return;
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.image_url) throw new Error("No se recibió ninguna foto");
      set("image_url", data.image_url);
      onMediaChange?.();
      toast.success("Foto generada");
    } catch (e: unknown) {
      toast.error(errorMessage(e) ||"Error con IA");
    } finally {
      setImgAiLoading(false);
    }
  };


  const generateVideoWithAI = async () => {
    const id = initial?.id;
    if (!id) return;
    setGenLoading(true);
    try {
      const start = await supabase.functions.invoke("exercise-video", { body: { exercise_id: id, action:"create" } });
      if (start.error) {
        toast.error(await fnErrorMessage(start.error,"No se pudo iniciar el vídeo"));
        return;
      }
      if (start.data?.error) throw new Error(start.data.error);
      if (start.data?.paused) {
        toast.info(start.data.message ||"La generación de vídeos está pausada");
        return;
      }
      setGenStatus("Generando vídeo…");
      const deadline = Date.now() + VIDEO_DEADLINE_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 6000));
        const check = await supabase.functions.invoke("exercise-video", { body: { exercise_id: id, action:"check" } });
        if (check.error) {
          toast.error(await fnErrorMessage(check.error,"No se pudo comprobar el vídeo"));
          return;
        }
        const d = check.data;
        if (d?.error) throw new Error(d.error);
        if (d?.status ==="completed" && d.video_url) {
          set("video_url", d.video_url);
          onMediaChange?.();
          setGenStatus(null);
          setGenLoading(false);
          toast.success("Vídeo generado");
          return;
        }
        if (d?.status ==="failed") throw new Error(d.error ||"La generación falló");
        const pct = d?.progress ? Math.round(d.progress * 100) : 0;
        setGenStatus(pct > 0 ?`Generando vídeo… ${pct}%` :"Generando vídeo…");
      }
      throw new Error("El vídeo está tardando más de lo normal. Cierra y vuelve a abrir el ejercicio en un minuto.");
    } catch (e: unknown) {
      toast.error(errorMessage(e) ||"Error con IA");
    } finally {
      setGenStatus(null);
      setGenLoading(false);
    }
  };

  const uploadImage = async (file: File) => {
    setImgUploading(true);
    try {
      const ext = file.name.split(".").pop() ||"jpg";
      const path =`exercise-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      set("image_url", data.publicUrl);
      toast.success("Imagen subida");
    } catch (e: unknown) {
      toast.error(errorMessage(e) ||"Error al subir la imagen");
    }
    setImgUploading(false);
  };

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : {
        name:"", muscle_group:"", exercise_type:"", movement_pattern:"",
        level: 1, priority: 2, stimulus_type:"", load_level:"", fatigue_level:"", recommended_order: 2,
        alternative_id: null, skill_tag: null, progression_order: null, video_url:"",
        is_stable: true, is_progressable: true, high_tension: true,
      });
      setAltSearch("");
    }
  }, [open, initial]);

  const set = <K extends keyof Exercise>(k: K, v: Exercise[K]) => setForm((f) => ({ ...f, [k]: v }));

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
    } catch (e: unknown) {
      toast.error(errorMessage(e) ||"Error con IA");
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

  const allCriteria = (form.is_stable ?? true) && (form.is_progressable ?? true) && (form.high_tension ?? true);
  const trackingOptions = [
    ["", "Automático", "Se deduce por el nombre y el tipo"],
    ...Object.entries(TRACKING_MODES).map(([k, c]) => [k, TRACKING_LABELS[k], c.description]),
  ] as [string, string, string][];
  const trackingConfig = getExerciseTrackingConfig({
    name: form.name,
    skill_tag: form.skill_tag,
    movement_pattern: form.movement_pattern,
    exercise_type: form.exercise_type,
    tracking_mode: form.tracking_mode,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined} onOpenAutoFocus={skipAutoFocusOnTouch}>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar ejercicio" : "Nuevo ejercicio"}</DialogTitle>
        </DialogHeader>

        {/* Vídeo del ejercicio arriba del todo, o su imagen si aún no tiene vídeo */}
        <WithImageFallback image={form.image_url}>
          {(image) => <ExerciseMedia video={form.video_url} image={image} name={form.name} className="rounded-[14px]" />}
        </WithImageFallback>

        <div className="space-y-6 pt-1">
          <FormSection title="Información básica">
            <div>
              <label htmlFor="exercise-name" className="mb-1.5 block type-subhead text-muted-foreground">Nombre</label>
              <div className="flex gap-2">
                <Input
                  id="exercise-name"
                  value={form.name || ""}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Press banca"
                  autoCapitalize="sentences"
                  enterKeyHint="done"
                />
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Clasificar con IA"
                  onClick={() => { void hapticTap(); void autofillWithAI(); }}
                  disabled={aiLoading || !form.name?.trim()}
                  className="shrink-0 gap-1.5 px-3.5"
                >
                  {aiLoading ? <Spinner size="sm" className="text-current" /> : null}
                  Clasificar
                </Button>
              </div>
              <p className="mt-1.5 type-footnote text-muted-foreground">
                Escribe el nombre y pulsa Clasificar para rellenar los campos con IA.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Grupo muscular">
                <SmallSelect value={form.muscle_group || ""} onChange={(v) => set("muscle_group", v)} options={ALL_MUSCLE_GROUPS} placeholder="Seleccionar…" />
              </FormField>
              <FormField label="Tipo">
                <SmallSelect value={form.exercise_type || ""} onChange={(v) => set("exercise_type", v)} options={EXERCISE_TYPES} placeholder="Tipo…" />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Clasificación">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Patrón">
                <SmallSelect value={form.movement_pattern || ""} onChange={(v) => set("movement_pattern", v)} options={MOVEMENT_PATTERNS} placeholder="Patrón…" />
              </FormField>
              <FormField label="Estímulo">
                <SmallSelect value={form.stimulus_type || ""} onChange={(v) => set("stimulus_type", v)} options={STIMULUS_TYPES} placeholder="Estímulo…" />
              </FormField>
              <FormField label="Nivel">
                <NumSelect value={form.level} onChange={(v) => set("level", v)} options={LEVELS} />
              </FormField>
              <FormField label="Prioridad">
                <NumSelect value={form.priority} onChange={(v) => set("priority", v)} options={PRIORITIES} />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Parámetros de generación">
            <div className="grid grid-cols-3 gap-2">
              <FormField label="Carga">
                <SmallSelect value={form.load_level || ""} onChange={(v) => set("load_level", v)} options={LOAD_LEVELS} placeholder="—" />
              </FormField>
              <FormField label="Fatiga">
                <SmallSelect value={form.fatigue_level || ""} onChange={(v) => set("fatigue_level", v)} options={FATIGUE_LEVELS} placeholder="—" />
              </FormField>
              <FormField label="Orden">
                <NumSelect value={form.recommended_order} onChange={(v) => set("recommended_order", v)} options={RECOMMENDED_ORDERS} />
              </FormField>
            </div>
          </FormSection>

          <ListGroup
            inset
            header="Criterios obligatorios"
            footer="Si alguno está desactivado, el ejercicio no se incluirá en los planes generados."
          >
            {CRITERIA.map(({ key, label, hint }) => (
              <ListRow
                key={key}
                title={label}
                subtitle={hint}
                trailing={
                  <Switch
                    aria-label={label}
                    checked={form[key] ?? true}
                    onCheckedChange={(v) => { void hapticSelection(); set(key, v); }}
                  />
                }
              />
            ))}
          </ListGroup>

          <div className="space-y-3">
            <ListGroup inset header="Modo de registro">
              {trackingOptions.map(([k, label, desc]) => {
                const active = (form.tracking_mode || "") === k;
                return (
                  <ListRow
                    key={k || "auto"}
                    title={label}
                    subtitle={desc}
                    trailing={active ? <Check className="h-5 w-5 text-primary" strokeWidth={2.5} role="img" aria-label="Seleccionado" /> : undefined}
                    onClick={() => set("tracking_mode", k === "weighted_reps" || k === "bodyweight_reps" || k === "weighted_bodyweight" || k === "seconds_only" || k === "assisted_reps" ? k : null)}
                  />
                );
              })}
            </ListGroup>
            <div>
              <p className="mb-1.5 px-4 type-footnote text-muted-foreground">Así se verá cada serie al registrarla.</p>
              <div className="grid grid-cols-[40px_52px_1fr_1fr_20px] items-center gap-2 rounded-[10px] bg-secondary px-3 py-2 type-caption1 font-medium text-muted-foreground">
                <span className="truncate">Serie</span>
                <span className="truncate">Previa</span>
                <span className="truncate">{trackingConfig.fixedBodyweight ? "PC" : trackingConfig.weightLabel}</span>
                <span className="truncate">{trackingConfig.valueLabel}</span>
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              </div>
            </div>
          </div>

          <FormSection title="Progresión de skill">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Skill">
                <SmallSelect value={form.skill_tag || ""} onChange={(v) => set("skill_tag", v || null)} options={SKILL_TAGS} placeholder="Ninguno" />
              </FormField>
              <FormField label="Orden de progresión">
                <Input
                  type="number"
                  inputMode="numeric"
                  enterKeyHint="done"
                  min={1}
                  max={20}
                  value={form.progression_order ?? ""}
                  onChange={(e) => set("progression_order", e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="1 = básico"
                />
              </FormField>
            </div>
            <Hint>Asigna un skill y un orden para crear cadenas de progresión (1 = más fácil, mayor = más difícil).</Hint>
          </FormSection>

          <section>
            <h3 className="type-group-header px-4 pb-1.5">Imagen del ejercicio</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <WithImageFallback image={form.image_url}>
                  {(image) => <ExerciseThumb image={image} name={form.name} size="lg" />}
                </WithImageFallback>
                <p className="min-w-0 flex-1 type-footnote text-muted-foreground">
                  Se mostrará al usuario en su plan. Las fotos generadas con IA usan siempre el mismo estilo que los vídeos.
                </p>
              </div>
              <input
                ref={imageInputRef}
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
              <ListGroup inset>
                <ListRow
                  title={<span className="text-primary">{form.image_url ? "Cambiar imagen" : "Subir imagen"}</span>}
                  trailing={imgUploading ? <Spinner size="sm" /> : undefined}
                  disabled={imgUploading}
                  onClick={() => imageInputRef.current?.click()}
                />
                {initial?.id ? (
                  <ListRow
                    title={<span className="text-primary">{form.image_url ? "Otra foto con IA" : "Generar foto con IA"}</span>}
                    trailing={imgAiLoading ? <Spinner size="sm" /> : undefined}
                    disabled={imgAiLoading}
                    onClick={generateImageWithAI}
                  />
                ) : null}
                {form.image_url ? (
                  <ListRow title="Quitar imagen" destructive onClick={() => set("image_url", null)} />
                ) : null}
              </ListGroup>
            </div>
          </section>

          <FormSection title="Vídeo del ejercicio">
            <Input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-label="URL del vídeo"
              value={form.video_url || ""}
              onChange={(e) => set("video_url", e.target.value)}
              placeholder="YouTube, Vimeo o MP4 directo (https://…)"
              className="font-mono !type-footnote"
            />
            {initial?.id ? (
              <ListGroup inset>
                <ListRow
                  title={<span className="text-primary">{genStatus || (form.video_url ? "Generar otro vídeo con IA" : "Generar vídeo con IA")}</span>}
                  trailing={genLoading ? <Spinner size="sm" /> : undefined}
                  disabled={genLoading}
                  onClick={generateVideoWithAI}
                />
              </ListGroup>
            ) : (
              <Hint>Guarda el ejercicio y después podrás generar su vídeo con IA.</Hint>
            )}
            <Hint>
              Pega cualquier URL de YouTube (incluye Shorts), Vimeo o un .mp4 directo, o genera el vídeo con IA. Se mostrará al usuario en su entrenamiento y se ve arriba, en la cabecera del ejercicio.
            </Hint>
          </FormSection>

          <FormSection title="Alternativa">
            {selectedAlt ? (
              <ListGroup inset>
                <ListRow
                  title={selectedAlt.name}
                  subtitle={[selectedAlt.exercise_type, selectedAlt.muscle_group].filter(Boolean).join(" · ")}
                  trailing={
                    <button
                      type="button"
                      aria-label="Quitar alternativa"
                      onClick={() => { void hapticTap(); set("alternative_id", null); }}
                      className="-mr-3 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground active:opacity-60"
                    >
                      <X className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                    </button>
                  }
                />
              </ListGroup>
            ) : (
              <>
                <Input
                  type="search"
                  enterKeyHint="search"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Buscar alternativa"
                  placeholder="Buscar alternativa…"
                  value={altSearch}
                  onChange={(e) => setAltSearch(e.target.value)}
                />
                {altSearch ? (
                  altCandidates.length > 0 ? (
                    <ListGroup inset>
                      <div className="max-h-56 overflow-y-auto overscroll-contain">
                        {altCandidates.map((e) => (
                          <ListRow
                            key={e.id}
                            title={e.name}
                            value={e.exercise_type}
                            onClick={() => { set("alternative_id", e.id); setAltSearch(""); }}
                          />
                        ))}
                      </div>
                    </ListGroup>
                  ) : (
                    <p className="px-4 type-footnote text-muted-foreground">Sin resultados</p>
                  )
                ) : null}
              </>
            )}
          </FormSection>

          <div className="space-y-2 pt-2">
            {!allCriteria && (
              <p className="text-center type-footnote text-destructive">
                Debe cumplir los 3 criterios obligatorios para añadirse a la biblioteca.
              </p>
            )}
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => { void hapticTap(); onSave(form); }}
              disabled={loading || !form.name?.trim() || !allCriteria}
            >
              {loading ? <Spinner size="sm" className="text-primary-foreground" /> : null}
              {initial ? "Guardar cambios" : "Añadir ejercicio"}
            </Button>
            {initial && onDelete ? (
              <Button
                type="button"
                variant="plain"
                className="w-full text-destructive"
                onClick={() => { void hapticTap(); onDelete(initial); }}
              >
                Eliminar ejercicio
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ── Main Component ── */

const ExerciseLibrary = () => {
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [fetched, setFetched] = useState(false);
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  /**
   * Las columnas de medios (media_style_version, *_generated_at, media_error)
   * llegan con la migración 20261006130000. Si todavía no está aplicada, la
   * consulta falla: en ese caso seguimos listando la biblioteca sin ellas en vez
   * de dejar la pantalla vacía.
   */
  const [mediaColumnsReady, setMediaColumnsReady] = useState(true);

  const LEGACY_COLUMNS ="id, name, muscle_group, image_url, video_url, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level, recommended_order, alternative_id, skill_tag, progression_order, is_stable, is_progressable, high_tension, tracking_mode";
  const MEDIA_COLUMNS ="media_style_version, image_generated_at, video_generated_at, media_error, video_priority";

  const fetchExercises = async () => {
    const full = await supabase.from("exercises")
      .select(`${LEGACY_COLUMNS}, ${MEDIA_COLUMNS}`)
      .order("muscle_group").order("recommended_order").order("name");

    if (!full.error) {
      setMediaColumnsReady(true);
      setExercises((full.data ?? []) as unknown as ExerciseRow[]);
      setFetched(true);
      return;
    }

    console.warn("La biblioteca no pudo leer las columnas de medios; falta la migración", full.error.message);
    const legacy = await supabase.from("exercises")
      .select(LEGACY_COLUMNS)
      .order("muscle_group").order("recommended_order").order("name");
    setMediaColumnsReady(false);
    // Sin el dato de estilo no podemos afirmar que un medio sea antiguo, así que
    // lo damos por actual: no marcamos la biblioteca entera como pendiente.
    setExercises(((legacy.data ?? []) as unknown as ExerciseRow[]).map((row) => ({
      ...row,
      media_style_version: MEDIA_STYLE_VERSION,
    })));
    setFetched(true);
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

  const invokeExerciseMedia = async (exerciseId: string, action:"image" |"create" |"check") => {
    const { data, error } = await supabase.functions.invoke("exercise-video", {
      body: { exercise_id: exerciseId, action },
    });
    if (error) {
      let message ="No se pudo generar el recurso";
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
    let videosPaused = false;

    for (let index = 0; index < total; index++) {
      if (cancelRef.current) break;
      const exercise = queue[index];
      const setProgress = (task: string) =>
        setMediaBatch({ current: index + 1, total, exercise: exercise.name, task, errors });

      try {
        const oldStyle = hasOutdatedMedia(exercise);

        if (!exercise.image_url || oldStyle) {
          setProgress("Generando imagen");
          const image = await invokeExerciseMedia(exercise.id,"image");
          if (!image?.image_url) throw new Error("La IA no devolvió una imagen.");
          setExercises((current) => current.map((item) => item.id === exercise.id
            ? { ...item, image_url: image.image_url, media_style_version: MEDIA_STYLE_VERSION, image_generated_at: new Date().toISOString(), media_error: null }
            : item));
        }
        if (cancelRef.current) break;

        if (!videosPaused && (!exercise.video_url || oldStyle)) {
          setProgress("Generando técnica en vídeo");
          const started = await invokeExerciseMedia(exercise.id,"create");
          if (started?.paused) {
            // Vídeos pausados en Claves de IA: seguimos solo con las fotos.
            videosPaused = true;
            completed++;
            continue;
          }
          const deadline = Date.now() + VIDEO_DEADLINE_MS;
          let completedVideoUrl: string | null = null;
          while (Date.now() < deadline && !cancelRef.current) {
            await interruptibleSleep(6000);
            if (cancelRef.current) break;
            const status = await invokeExerciseMedia(exercise.id,"check");
            if (status?.status ==="failed") throw new Error(status.error ||"La generación del vídeo falló.");
            if (status?.status ==="completed" && status.video_url) {
              completedVideoUrl = status.video_url;
              break;
            }
            const progress = status?.progress ?` (${Math.round(status.progress * 100)}%)` :"";
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
        if (/credit limit|sin créditos|sin saldo|402/i.test(message)) {
          // Sin saldo o límite mensual alcanzado: parar la cola en vez de fallar 271 veces.
          toast.error("Se ha alcanzado el límite de créditos de IA. La cola se ha detenido.");
          break;
        }
        if (/no disponibles|404/i.test(message)) {
          // El modelo de vídeo no existe para esta cuenta: seguir solo con fotos.
          videosPaused = true;
          toast.error(`${message}. Se seguirá solo con las fotos.`);
          continue;
        }
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
    const detail =`${completed}/${total} · errores: ${errors}`;
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
    if (filterGroup) result = result.filter((e) => (e.muscle_group ||"Sin grupo") === filterGroup);
    if (filterType) result = result.filter((e) => e.exercise_type === filterType);
    if (mediaFilter ==="no-image") result = result.filter((e) => !e.image_url);
    if (mediaFilter ==="no-video") result = result.filter((e) => !e.video_url);
    if (mediaFilter ==="old-style") result = result.filter(hasOutdatedMedia);
    if (mediaFilter ==="error") result = result.filter((e) => Boolean(e.media_error));
    return result;
  }, [exercises, search, filterGroup, filterType, mediaFilter]);

  // Pintado progresivo: 30 filas al instante, el resto al acercarse al final.
  const [visibleCount, setVisibleCount] = useState(30);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setVisibleCount(30); }, [search, filterGroup, filterType, mediaFilter]);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisibleCount((c) => c + 40);
    }, { rootMargin: "600px" });
    io.observe(node);
    return () => io.disconnect();
  }, [visibleCount, filtered.length]);

  /** Pendientes visibles: lo que realmente procesará el botón"Generar pendientes". */
  /** Los ejercicios clave (video_priority) van primero, el resto conserva su orden. */
  const pendingQueue = useMemo(
    () => filtered.filter(needsGeneration).sort((a, b) => (a.video_priority ?? 99) - (b.video_priority ?? 99)),
    [filtered],
  );

  const mediaFilterOptions = useMemo(() => ([
    { value:"all" as const, label:"Todos", count: exercises.length },
    { value:"no-image" as const, label:"Sin imagen", count: exercises.filter((e) => !e.image_url).length },
    { value:"no-video" as const, label:"Sin vídeo", count: exercises.filter((e) => !e.video_url).length },
    { value:"old-style" as const, label:"Estilo antiguo", count: exercises.filter(hasOutdatedMedia).length },
    { value:"error" as const, label:"Con error", count: exercises.filter((e) => Boolean(e.media_error)).length },
  ]), [exercises]);

  const pendingCounts = useMemo(() => ({
    missingImage: pendingQueue.filter((e) => !e.image_url).length,
    missingVideo: pendingQueue.filter((e) => !e.video_url).length,
    oldStyle: pendingQueue.filter(hasOutdatedMedia).length,
  }), [pendingQueue]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    exercises.forEach((e) => {
      const g = e.muscle_group ||"Sin grupo";
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
      name: form.name?.trim() ||"",
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
      tracking_mode: form.tracking_mode || null,
    };

    if (editingExercise) {
      const { error } = await supabase.from("exercises").update(payload).eq("id", editingExercise.id);
      if (!error) { toast.success("Ejercicio actualizado"); } else { toast.error("Error al actualizar"); }
    } else {
      const { error } = await supabase.from("exercises").insert(payload);
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
      siteAssetPath(target?.image_url,"exercise-images/"),
      siteAssetPath(target?.video_url,"exercise-videos/"),
    ].filter((path): path is string => Boolean(path));
    if (orphanPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage.from("site-assets").remove(orphanPaths);
      if (cleanupError) console.warn("No se pudieron limpiar los medios del ejercicio eliminado", cleanupError);
    }
    toast.success("Ejercicio eliminado");
  };

  const openEditor = (exercise: ExerciseRow) => {
    setEditingExercise(exercise);
    setDialogOpen(true);
  };

  const requestDelete = (exercise: Exercise) => {
    setDeleteTarget({ id: exercise.id, name: exercise.name });
    setDialogOpen(false);
    setEditingExercise(null);
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="type-subhead text-muted-foreground">
          {fetched ? `${filtered.length} de ${exercises.length} ejercicios` : null}
        </p>
        {!mediaBatch && (
          <Button
            type="button"
            variant="plain"
            size="sm"
            className="-mr-3 h-11 px-3"
            disabled={pendingQueue.length === 0 || !mediaColumnsReady}
            onClick={() => { void hapticTap(); setMediaBatchOpen(true); }}
          >
            Generar pendientes ({pendingQueue.length})
          </Button>
        )}
      </div>

      {mediaBatch && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p role="status" className="min-w-0 type-footnote text-muted-foreground">
              {mediaBatch.current}/{mediaBatch.total} · errores: {mediaBatch.errors} · {mediaBatch.exercise}: {mediaBatch.task}
            </p>
            <Button
              type="button"
              variant="plain"
              size="sm"
              className="-mr-3 h-11 shrink-0 px-3"
              onClick={() => { void hapticTap(); cancelMediaQueue(); }}
            >
              Cancelar
            </Button>
          </div>
          <Progress value={((mediaBatch.current - 1) / mediaBatch.total) * 100} aria-label="Progreso de la cola de medios" />
        </div>
      )}

      {!mediaColumnsReady && (
        <p role="status" className="type-footnote text-muted-foreground">
          Faltan las columnas de medios en la base de datos: aplica supabase db push para activar la generación y el marcado de estilos y errores.
        </p>
      )}

      <Button
        type="button"
        size="lg"
        className="w-full md:w-auto"
        onClick={() => { void hapticTap(); setEditingExercise(null); setDialogOpen(true); }}
      >
        Nuevo ejercicio
      </Button>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
          aria-hidden="true"
        />
        <Input
          type="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Buscar ejercicio"
          className="pl-10 pr-11 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          placeholder="Buscar ejercicio…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onClick={() => { void hapticTap(); setSearch(""); }}
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-muted-foreground active:opacity-60"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="mb-1.5 block type-subhead text-muted-foreground">Músculo</span>
          <select
            className={SELECT_CLASS}
            value={filterGroup ?? ""}
            onChange={(event) => { void hapticSelection(); setFilterGroup(event.target.value || null); }}
            aria-label="Filtrar ejercicios por músculo"
          >
            <option value="">Todos</option>
            {Object.keys(groupCounts).sort((a, b) => a.localeCompare(b, "es")).map((group) => (
              <option key={group} value={group}>{group} · {groupCounts[group]}</option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block type-subhead text-muted-foreground">Tipo</span>
          <select
            className={SELECT_CLASS}
            value={filterType ?? ""}
            onChange={(event) => { void hapticSelection(); setFilterType(event.target.value || null); }}
            aria-label="Filtrar ejercicios por tipo"
          >
            <option value="">Todos</option>
            {EXERCISE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
      </div>

      {/* Chips de estado de medios */}
      <div className="flex flex-wrap items-center gap-2">
        {mediaFilterOptions.map((option) => {
          const selected = mediaFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => { void hapticSelection(); setMediaFilter(option.value); }}
              aria-pressed={selected}
              className={cn(
                "relative h-9 rounded-full px-3.5 type-subhead font-medium transition-colors duration-150 before:absolute before:inset-x-0 before:-inset-y-1",
                selected ? "bg-primary/15 text-primary active:bg-primary/25" : "bg-secondary text-muted-foreground active:bg-accent",
              )}
            >
              {option.label} · <span className="tabular-nums">{option.count}</span>
            </button>
          );
        })}
      </div>

      {!fetched ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length > 0 ? (
        <>
        <ListGroup>
          {filtered.slice(0, visibleCount).map((ex) => (
            <ListRow
              key={ex.id}
              leading={
                <WithImageFallback image={ex.image_url}>
                  {(image) => <ExerciseThumb image={image} video={ex.video_url} name={ex.name} size="md" />}
                </WithImageFallback>
              }
              title={ex.name}
              subtitle={<ExerciseMeta exercise={ex} />}
              trailing={
                ex.video_url || ex.image_url ? (
                  <button
                    type="button"
                    aria-label={`Ver el vídeo de ${ex.name}`}
                    onClick={() => {
                      void hapticTap();
                      setPreview({
                        name: ex.name,
                        image: ex.image_url,
                        video: ex.video_url,
                        detail: [ex.muscle_group, ex.exercise_type].filter(Boolean).join(" · ") || null,
                      });
                    }}
                    className="-mr-3 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground active:opacity-60"
                  >
                    <Play className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                  </button>
                ) : undefined
              }
              onClick={() => openEditor(ex)}
            />
          ))}
        </ListGroup>
        {visibleCount < filtered.length && (
          <div ref={sentinelRef} className="flex justify-center py-6 text-xs text-muted-foreground">
            Cargando más…
          </div>
        )}
        </>
      ) : (
        <EmptyState
          icon={exercises.length === 0 ? Dumbbell : Search}
          title={exercises.length === 0 ? "Aún no hay ejercicios" : "Sin resultados"}
          description={exercises.length === 0 ? "Añade el primero con el botón Nuevo ejercicio." : "Prueba con otra búsqueda o cambia los filtros."}
        />
      )}

      {/* Form Dialog */}
      <ExerciseFormDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingExercise(null); }}
        initial={editingExercise}
        onSave={handleSave}
        onDelete={requestDelete}
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar ejercicio</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará {deleteTarget?.name} de la biblioteca, junto con su imagen y su vídeo guardados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => { if (deleteTarget) void deleteExercise(deleteTarget.id); }}>
              Eliminar
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
