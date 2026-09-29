import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Dumbbell, Edit2, Search, X, ArrowLeftRight, Video, Sparkles, Loader2, ImagePlus } from "lucide-react";
import type { Exercise } from "@/types/training";
import {
  MUSCLE_GROUPS, EXERCISE_TYPES, MOVEMENT_PATTERNS, LEVELS,
  PRIORITIES, STIMULUS_TYPES, LOAD_LEVELS, FATIGUE_LEVELS, RECOMMENDED_ORDERS, SKILL_TAGS,
} from "@/types/training";
import VideoEmbed, { toEmbedUrl } from "@/components/VideoEmbed";
import ExerciseMedia from "@/components/ExerciseMedia";

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
  Pecho: "bg-red-500/15 text-red-400 border-red-500/30",
  Espalda: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Hombros: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Bíceps: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Tríceps: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  Piernas: "bg-green-500/15 text-green-400 border-green-500/30",
  Glúteos: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Core: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  Cardio: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  "Cuerpo completo": "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  Otro: "bg-muted text-muted-foreground border-border",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-emerald-500/15 text-emerald-400",
  2: "bg-yellow-500/15 text-yellow-400",
  3: "bg-red-500/15 text-red-400",
};

const STIMULUS_COLORS: Record<string, string> = {
  Fuerza: "bg-blue-600/15 text-blue-400",
  Hipertrofia: "bg-violet-500/15 text-violet-400",
  Resistencia: "bg-orange-500/15 text-orange-400",
  Isométrico: "bg-teal-500/15 text-teal-400",
};

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
      if (error) throw new Error(error.message || "Error al generar la foto");
      if (data?.error) throw new Error(data.error);
      if (!data?.image_url) throw new Error("No se recibió ninguna foto");
      set("image_url", data.image_url);
      onMediaChange?.();
      toast.success("Foto generada");
    } catch (e: any) {
      toast.error(e.message || "Error con IA");
    }
    setImgAiLoading(false);
  };


  const generateVideoWithAI = async () => {
    const id = initial?.id;
    if (!id) return;
    setGenLoading(true);
    try {
      const start = await supabase.functions.invoke("exercise-video", { body: { exercise_id: id, action: "create" } });
      if (start.error) throw new Error(start.error.message || "Error al iniciar");
      if (start.data?.error) throw new Error(start.data.error);
      setGenStatus("Generando vídeo…");
      const deadline = Date.now() + 4 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 6000));
        const check = await supabase.functions.invoke("exercise-video", { body: { exercise_id: id, action: "check" } });
        if (check.error) throw new Error(check.error.message || "Error al comprobar");
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
            {form.image_url ? (
              <img src={form.image_url} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-border object-cover" />
            ) : (
              <Dumbbell className="w-5 h-5 text-primary" />
            )}
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
              {form.image_url ? (
                <img src={form.image_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-secondary/50 border border-dashed border-border flex items-center justify-center shrink-0">
                  <Dumbbell className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
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
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  const fetchExercises = async () => {
    const { data } = await supabase.from("exercises")
      .select("id, name, muscle_group, image_url, video_url, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level, recommended_order, alternative_id, skill_tag, progression_order, is_stable, is_progressable, high_tension")
      .order("muscle_group").order("recommended_order").order("name");
    if (data) setExercises(data as Exercise[]);
  };

  useEffect(() => { fetchExercises(); }, []);

  const filtered = useMemo(() => {
    let result = exercises;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.name.toLowerCase().includes(q));
    }
    if (filterGroup) result = result.filter((e) => (e.muscle_group || "Sin grupo") === filterGroup);
    if (filterType) result = result.filter((e) => e.exercise_type === filterType);
    return result;
  }, [exercises, search, filterGroup, filterType]);

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
    const { error } = await supabase.from("exercises").delete().eq("id", id);
    if (!error) {
      setExercises((e) => e.filter((ex) => ex.id !== id));
      toast.success("Ejercicio eliminado");
    } else {
      toast.error("Error al eliminar");
    }
  };

  const levelLabel = (l: number) => LEVELS.find((x) => x.value === l)?.label || "";
  const priorityLabel = (p: number) => PRIORITIES.find((x) => x.value === p)?.label || "";
  const orderLabel = (o: number) => RECOMMENDED_ORDERS.find((x) => x.value === o)?.label || "";

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-[0_16px_44px_-36px_hsl(var(--primary)/.55)] sm:p-5">
      <div className="mb-4 flex items-center gap-2 border-b border-border/70 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
            <Dumbbell className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-bold font-display">Biblioteca de ejercicios</h2>
            <p className="text-xs text-muted-foreground">{filtered.length} de {exercises.length} ejercicios</p>
          </div>
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

          {/* Lista única y limpia */}
          {filtered.length > 0 ? (
            <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80">
              {filtered.map((ex) => (
                <div
                  key={ex.id}
                  className="group flex items-center gap-3 bg-card px-3.5 py-3 transition-colors hover:bg-secondary/40"
                >
                  {ex.image_url ? (
                    <img src={ex.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-border/70 object-cover" />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-b from-secondary/70 to-secondary/30" />
                  )}
                  <div className="min-w-0 flex-1">

                    <p className="font-medium text-sm truncate">{ex.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {[ex.muscle_group, ex.exercise_type].filter(Boolean).map((category) => (
                        <span
                          key={category}
                          className="rounded-full border border-border bg-secondary/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {category}
                        </span>
                      ))}
                      {!ex.muscle_group && !ex.exercise_type && (
                        <span className="text-[10px] text-muted-foreground">Sin clasificar</span>
                      )}
                    </div>
                  </div>

                  {ex.video_url ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium flex items-center gap-1 shrink-0">
                      <Video className="w-2.5 h-2.5" /> Vídeo
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">Sin vídeo</span>
                  )}

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
    </div>
  );
};

export default ExerciseLibrary;
