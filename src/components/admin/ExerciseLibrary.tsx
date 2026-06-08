import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Dumbbell, Edit2, Search, X, ArrowLeftRight, Video, Sparkles, Loader2 } from "lucide-react";
import type { Exercise } from "@/types/training";
import {
  MUSCLE_GROUPS, EXERCISE_TYPES, MOVEMENT_PATTERNS, LEVELS,
  PRIORITIES, STIMULUS_TYPES, LOAD_LEVELS, FATIGUE_LEVELS, RECOMMENDED_ORDERS, SKILL_TAGS,
} from "@/types/training";
import VideoEmbed, { toEmbedUrl } from "@/components/VideoEmbed";

const ALL_MUSCLE_GROUPS = [...MUSCLE_GROUPS, "Otro"] as const;

interface ExerciseLibraryProps {
  defaultOpen?: boolean;
}

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
  open, onOpenChange, initial, onSave, loading, allExercises,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Exercise | null;
  onSave: (data: Partial<Exercise>) => void;
  loading: boolean;
  allExercises: Exercise[];
}) => {
  const [form, setForm] = useState<Partial<Exercise>>({});
  const [altSearch, setAltSearch] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
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
                <Label className="text-xs">Grupo muscular</Label>
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
            <p className="text-[10px] text-muted-foreground">
              Pega cualquier URL de YouTube (incluye Shorts), Vimeo o un .mp4 directo. Se mostrará al usuario en su entrenamiento.
            </p>
            {form.video_url && toEmbedUrl(form.video_url) && (
              <div className="rounded-lg overflow-hidden border border-border">
                <VideoEmbed url={form.video_url} />
              </div>
            )}
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

          <Button className="w-full" onClick={() => onSave(form)} disabled={loading || !form.name?.trim()}>
            {initial ? "Guardar cambios" : "Añadir ejercicio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ── Main Component ── */

const ExerciseLibrary = ({ defaultOpen = false }: ExerciseLibraryProps) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [open, setOpen] = useState(defaultOpen);
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
    <div className="bg-card rounded-xl border border-border mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-primary" />
          <span className="font-bold font-display">Biblioteca de Ejercicios</span>
          <Badge variant="secondary" className="ml-1 text-xs">{exercises.length}</Badge>
        </div>
        <span className="text-muted-foreground text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 animate-fade-in">
          {/* Search + Add */}
          <div className="flex gap-2">
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

          {/* Filter chips - muscle groups */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterGroup(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                !filterGroup ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos
            </button>
            {Object.entries(groupCounts).sort(([a], [b]) => a.localeCompare(b)).map(([group, count]) => (
              <button
                key={group}
                onClick={() => setFilterGroup(filterGroup === group ? null : group)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterGroup === group ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {group} <span className="opacity-60">({count})</span>
              </button>
            ))}
          </div>

          {/* Filter chips - type */}
          <div className="flex gap-1.5">
            {EXERCISE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(filterType === t ? null : t)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Card grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((ex) => (
                <div
                  key={ex.id}
                  className={`group relative rounded-lg border p-3.5 transition-all hover:shadow-md hover:border-primary/30 ${
                    ex.priority === 1 ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-semibold text-sm leading-tight">{ex.name}</h4>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => { setEditingExercise(ex); setDialogOpen(true); }}
                        className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => deleteExercise(ex.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>

                  {/* Muscle group badge */}
                  {ex.muscle_group && (
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border mb-2 ${GROUP_COLORS[ex.muscle_group] || GROUP_COLORS.Otro}`}>
                      {ex.muscle_group}
                    </span>
                  )}

                  {/* Info badges */}
                  <div className="flex flex-wrap gap-1">
                    {ex.level && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${LEVEL_COLORS[ex.level] || ""}`}>
                        {levelLabel(ex.level)}
                      </span>
                    )}
                    {ex.priority === 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-400">
                        Base
                      </span>
                    )}
                    {ex.stimulus_type && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STIMULUS_COLORS[ex.stimulus_type] || "bg-secondary text-muted-foreground"}`}>
                        {ex.stimulus_type}
                      </span>
                    )}
                    {ex.exercise_type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {ex.exercise_type}
                      </span>
                    )}
                    {ex.movement_pattern && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {ex.movement_pattern}
                      </span>
                    )}
                    {ex.video_url && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium flex items-center gap-1">
                        <Video className="w-2.5 h-2.5" /> Vídeo
                      </span>
                    )}
                  </div>

                  {/* Skill tag */}
                  {ex.skill_tag && (
                    <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20">
                      <span className="text-[10px] text-violet-400 font-medium">
                        🎯 {ex.skill_tag} {ex.progression_order ? `#${ex.progression_order}` : ""}
                      </span>
                    </div>
                  )}

                  {/* Alternative */}
                  {ex.alternative_id && (() => {
                    const alt = exercises.find((a) => a.id === ex.alternative_id);
                    return alt ? (
                      <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent/50 border border-border/50">
                        <ArrowLeftRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">
                          Alt: <span className="font-medium text-foreground">{alt.name}</span>
                          {alt.exercise_type && <span className="opacity-60"> · {alt.exercise_type}</span>}
                        </span>
                      </div>
                    ) : null;
                  })()}
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
      )}

      {/* Form Dialog */}
      <ExerciseFormDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingExercise(null); }}
        initial={editingExercise}
        onSave={handleSave}
        loading={loading}
        allExercises={exercises}
      />
    </div>
  );
};

export default ExerciseLibrary;
