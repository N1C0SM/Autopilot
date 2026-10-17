import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hapticSelection, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";
import { DAYS, type DayPlan, type GymExerciseEntry } from "@/types/training";
import ExercisePicker from "./ExercisePicker";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  dayPlans: DayPlan[];
  onSaved: (plans: DayPlan[]) => void;
}

const clone = (p: DayPlan[]) => JSON.parse(JSON.stringify(p)) as DayPlan[];

/** Orden lunes→domingo y fuera los días de gimnasio vacíos (son descanso). */
export const normalizePlan = (plans: DayPlan[]): DayPlan[] =>
  plans
    .filter((p) => p.type === "actividad" || (p.exercises?.length ?? 0) > 0)
    .sort((a, b) => DAYS.indexOf(a.day as (typeof DAYS)[number]) - DAYS.indexOf(b.day as (typeof DAYS)[number]));

const PlanEditor = ({ open, onOpenChange, userId, dayPlans, onSaved }: Props) => {
  const [draft, setDraft] = useState<DayPlan[]>([]);
  const [day, setDay] = useState<string>(DAYS[0]);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(clone(dayPlans));
      setDay(dayPlans[0]?.day ?? DAYS[0]);
    }
  }, [open, dayPlans]);

  const plan = draft.find((p) => p.day === day);
  const exercises = plan?.type === "gimnasio" ? plan.exercises ?? [] : [];

  const update = (fn: (p: DayPlan) => DayPlan) =>
    setDraft((d) => {
      const exists = d.some((p) => p.day === day);
      const base: DayPlan = { day, type: "gimnasio", routine_name: "", muscle_focus: "", exercises: [] };
      return exists ? d.map((p) => (p.day === day ? fn(p) : p)) : [...d, fn(base)];
    });

  const setExercises = (fn: (e: GymExerciseEntry[]) => GymExerciseEntry[]) =>
    update((p) => ({ ...p, type: "gimnasio", exercises: fn(p.type === "gimnasio" ? p.exercises ?? [] : []) }));

  const move = (i: number, dir: -1 | 1) =>
    setExercises((e) => {
      const n = [...e];
      const j = i + dir;
      if (j < 0 || j >= n.length) return e;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const save = async () => {
    setSaving(true);
    const clean = normalizePlan(draft);
    const { error } = await supabase
      .from("training_plan")
      .upsert({ user_id: userId, workouts_json: clean as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar tu rutina. Inténtalo de nuevo.");
      return;
    }
    void hapticTap();
    toast.success("Rutina guardada");
    onSaved(clean);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar mi rutina</DialogTitle>
        </DialogHeader>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Día">
          {DAYS.map((d) => {
            const has = draft.some((p) => p.day === d && (p.type === "actividad" || (p.exercises?.length ?? 0) > 0));
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={day === d}
                onClick={() => { void hapticSelection(); setDay(d); }}
                className={cn(
                  "relative shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
                  day === d ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground",
                )}
              >
                {d.slice(0, 3)}
                {has && <span className="absolute -top-0.5 right-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
              </button>
            );
          })}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {plan?.type === "actividad" ? (
            <div className="space-y-3 rounded-2xl border border-border p-4">
              <p className="text-sm text-muted-foreground">{day}: {plan.sport || "Actividad"} · {plan.duration}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => update(() => ({ day, type: "gimnasio", routine_name: "", muscle_focus: "", exercises: [] }))}>
                Convertir en día de fuerza
              </Button>
            </div>
          ) : (
            <>
              <Input
                aria-label="Nombre de la sesión"
                placeholder="Nombre de la sesión (p. ej. Torso A)"
                value={plan?.routine_name ?? ""}
                onChange={(e) => update((p) => ({ ...p, routine_name: e.target.value }))}
              />
              {exercises.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Día de descanso. Añade ejercicios para entrenar este día.</p>
              )}
              <ul className="space-y-2">
                {exercises.map((ex, i) => (
                  <li key={`${ex.exercise_id}-${i}`} className="rounded-2xl border border-border p-3">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{ex.name}</span>
                      <Button type="button" size="icon" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" aria-label="Bajar" disabled={i === exercises.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" aria-label={`Quitar ${ex.name}`} onClick={() => setExercises((e) => e.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <label className="text-xs text-muted-foreground">Series
                        <Input type="number" inputMode="numeric" min={1} max={10} value={ex.series}
                          onChange={(e) => setExercises((l) => l.map((x, k) => (k === i ? { ...x, series: Math.max(1, Math.min(10, Number(e.target.value) || 1)) } : x)))} />
                      </label>
                      <label className="text-xs text-muted-foreground">Reps
                        <Input type="number" inputMode="numeric" min={1} max={100} value={ex.reps}
                          onChange={(e) => setExercises((l) => l.map((x, k) => (k === i ? { ...x, reps: Math.max(1, Math.min(100, Number(e.target.value) || 1)) } : x)))} />
                      </label>
                      <label className="text-xs text-muted-foreground">Descanso
                        <Input value={ex.rest} maxLength={12}
                          onChange={(e) => setExercises((l) => l.map((x, k) => (k === i ? { ...x, rest: e.target.value } : x)))} />
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="outline" className="w-full" onClick={() => setPicker(true)}>
                <Plus className="h-4 w-4" /> Añadir ejercicio
              </Button>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={() => {
            if (window.confirm("¿Vaciar toda la semana para crearla desde cero?")) setDraft([]);
          }}>
            Empezar de cero
          </Button>
          <Button type="button" variant="hero" disabled={saving} onClick={() => void save()}>
            {saving ? "Guardando…" : "Guardar rutina"}
          </Button>
        </DialogFooter>

        <ExercisePicker open={picker} onOpenChange={setPicker} onPick={(entry) => setExercises((e) => [...e, entry])} />
      </DialogContent>
    </Dialog>
  );
};

export default PlanEditor;
