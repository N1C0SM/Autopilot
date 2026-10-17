import { useEffect, useMemo, useState } from "react";
import { Copy, History, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hapticSelection, hapticTap } from "@/lib/native";
import { clearBackup, markManual, readBackup } from "@/lib/planShield";
import { cn } from "@/lib/utils";
import { DAYS, type DayPlan, type GymExerciseEntry } from "@/types/training";
import ExercisePicker from "./ExercisePicker";
import ExerciseRowEditor from "./ExerciseRowEditor";
import ResponsiveSheet from "./ResponsiveSheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  dayPlans: DayPlan[];
  onSaved: (plans: DayPlan[]) => void;
}

const clone = (p: DayPlan[]) => JSON.parse(JSON.stringify(p)) as DayPlan[];
const dayIdx = (d: string) => DAYS.indexOf(d as (typeof DAYS)[number]);

/** Orden lunes→domingo y fuera los días de gimnasio vacíos (son descanso). */
export const normalizePlan = (plans: DayPlan[]): DayPlan[] =>
  plans
    .filter((p) => p.type === "actividad" || (p.exercises?.length ?? 0) > 0)
    .sort((a, b) => dayIdx(a.day) - dayIdx(b.day));

const daySummary = (p?: DayPlan) => {
  if (!p) return "Descanso";
  if (p.type === "actividad") return p.sport || "Actividad";
  const n = p.exercises?.length ?? 0;
  if (!n) return "Descanso";
  return `${n} ejerc. · ${p.exercises!.reduce((a, e) => a + e.series, 0)} series`;
};

const PlanEditor = ({ open, onOpenChange, userId, dayPlans, onSaved }: Props) => {
  const [draft, setDraft] = useState<DayPlan[]>([]);
  const [day, setDay] = useState<string>(DAYS[0]);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const backup = useMemo(() => (open ? readBackup(userId) : null), [open, userId]);

  useEffect(() => {
    if (open) {
      setDraft(clone(dayPlans));
      setDay(dayPlans[0]?.day ?? DAYS[0]);
      setCopyOpen(false);
      setConfirmReset(false);
    }
  }, [open, dayPlans]);

  const plan = draft.find((p) => p.day === day);
  const exercises = plan?.type === "gimnasio" ? plan.exercises ?? [] : [];
  const dirty = JSON.stringify(normalizePlan(draft)) !== JSON.stringify(normalizePlan(dayPlans));

  const updateDay = (target: string, fn: (p: DayPlan) => DayPlan) =>
    setDraft((d) => {
      const base: DayPlan = { day: target, type: "gimnasio", routine_name: "", muscle_focus: "", exercises: [] };
      return d.some((p) => p.day === target) ? d.map((p) => (p.day === target ? fn(p) : p)) : [...d, fn(base)];
    });
  const update = (fn: (p: DayPlan) => DayPlan) => updateDay(day, fn);

  const setExercises = (fn: (e: GymExerciseEntry[]) => GymExerciseEntry[]) =>
    update((p) => ({ ...p, type: "gimnasio", exercises: fn(p.type === "gimnasio" ? p.exercises ?? [] : []) }));

  const move = (i: number, dir: -1 | 1) =>
    setExercises((e) => {
      const n = [...e]; const j = i + dir;
      if (j < 0 || j >= n.length) return e;
      [n[i], n[j]] = [n[j], n[i]]; return n;
    });

  const copyTo = (target: string) => {
    if (!plan) return;
    void hapticTap();
    updateDay(target, () => ({ ...clone([plan])[0], day: target }));
    setCopyOpen(false);
    toast.success(`Sesión copiada al ${target.toLowerCase()}`);
  };

  const save = async () => {
    setSaving(true);
    const clean = markManual(normalizePlan(draft));
    const { error } = await supabase
      .from("training_plan")
      .upsert({ user_id: userId, workouts_json: clean as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar tu rutina. Inténtalo de nuevo.");
      return;
    }
    void hapticTap();
    toast.success("Rutina guardada y protegida");
    onSaved(clean);
    onOpenChange(false);
  };

  const dayButton = (d: string, layout: "chip" | "row") => {
    const p = draft.find((x) => x.day === d);
    const has = !!p && (p.type === "actividad" || (p.exercises?.length ?? 0) > 0);
    const active = day === d;
    if (layout === "chip") {
      return (
        <button key={d} type="button" role="tab" aria-selected={active}
          onClick={() => { void hapticSelection(); setDay(d); setCopyOpen(false); }}
          className={cn(
            "flex min-w-[52px] shrink-0 flex-col items-center gap-1 rounded-2xl border px-2 py-2 transition-colors",
            active ? "border-primary bg-primary/15 text-foreground" : "border-border/70 text-muted-foreground",
          )}>
          <span className="text-xs font-semibold">{d.slice(0, 3)}</span>
          <span className={cn("h-1.5 w-1.5 rounded-full", has ? "bg-primary" : "bg-border")} aria-hidden />
        </button>
      );
    }
    return (
      <button key={d} type="button" role="tab" aria-selected={active}
        onClick={() => { setDay(d); setCopyOpen(false); }}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
          active ? "bg-primary/12 text-foreground" : "text-muted-foreground hover:bg-muted/40",
        )}>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", has ? "bg-primary" : "bg-border")} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{d}</span>
          <span className="block truncate text-xs">{p?.routine_name ? `${p.routine_name} · ` : ""}{daySummary(p)}</span>
        </span>
      </button>
    );
  };

  const detail = (
    <div className="flex min-h-0 flex-1 flex-col">
      {plan?.type === "actividad" ? (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">{day}: {plan.sport || "Actividad"} {plan.duration ? `· ${plan.duration}` : ""}</p>
          <Button type="button" variant="outline" onClick={() => update(() => ({ day, type: "gimnasio", routine_name: "", muscle_focus: "", exercises: [] }))}>
            Convertir en día de fuerza
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Input
              aria-label="Nombre de la sesión"
              placeholder={`Nombre del ${day.toLowerCase()} (p. ej. Torso A)`}
              value={plan?.routine_name ?? ""}
              onChange={(e) => update((p) => ({ ...p, routine_name: e.target.value }))}
              className="h-11"
            />
            {exercises.length > 0 && (
              <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => setCopyOpen((v) => !v)} aria-expanded={copyOpen}>
                <Copy className="h-4 w-4" /> <span className="hidden sm:inline">Copiar a…</span>
              </Button>
            )}
          </div>
          {copyOpen && (
            <div className="mt-2 flex flex-wrap gap-1.5 rounded-2xl border border-border/70 p-2">
              {DAYS.filter((d) => d !== day).map((d) => (
                <button key={d} type="button" onClick={() => copyTo(d)} className="rounded-full border border-border px-3 py-2 text-xs hover:border-primary/50">{d}</button>
              ))}
            </div>
          )}
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
            {exercises.length === 0 ? (
              <button type="button" onClick={() => setPicker(true)}
                className="flex min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border text-muted-foreground hover:border-primary/50">
                <Plus className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-foreground">Día de descanso</span>
                <span className="text-xs">Añade ejercicios para entrenar el {day.toLowerCase()}</span>
              </button>
            ) : (
              <>
                <ul className="space-y-2">
                  {exercises.map((ex, i) => (
                    <ExerciseRowEditor key={`${ex.exercise_id}-${i}`} ex={ex} index={i} total={exercises.length}
                      onChange={(e) => setExercises((l) => l.map((x, k) => (k === i ? e : x)))}
                      onMove={(d) => move(i, d)}
                      onRemove={() => setExercises((e) => e.filter((_, k) => k !== i))} />
                  ))}
                </ul>
                <Button type="button" variant="outline" className="mt-3 min-h-12 w-full" onClick={() => setPicker(true)}>
                  <Plus className="h-4 w-4" /> Añadir ejercicios
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Editar mi rutina"
      description="Al guardar, tu rutina queda protegida frente al piloto automático."
      desktopClassName="sm:max-w-5xl"
      footer={
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex gap-2 md:mr-auto">
            {confirmReset ? (
              <>
                <Button type="button" variant="destructive" className="min-h-11 flex-1" onClick={() => { setDraft([]); setConfirmReset(false); }}>Sí, vaciar semana</Button>
                <Button type="button" variant="ghost" className="min-h-11" onClick={() => setConfirmReset(false)}>Cancelar</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" className="min-h-11 flex-1 md:flex-none" onClick={() => setConfirmReset(true)}>
                  <RotateCcw className="h-4 w-4" /> Empezar de cero
                </Button>
                {backup && (
                  <Button type="button" variant="ghost" className="min-h-11 flex-1 md:flex-none" onClick={() => {
                    setDraft(clone(backup.plans)); setDay(backup.plans[0]?.day ?? DAYS[0]); clearBackup(userId);
                    toast.success("Rutina anterior recuperada. Guarda para activarla.");
                  }}>
                    <History className="h-4 w-4" /> Recuperar mi copia
                  </Button>
                )}
              </>
            )}
          </div>
          <Button type="button" variant="hero" size="lg" className="min-h-12 w-full md:w-auto md:min-w-[200px]" disabled={saving || !dirty} onClick={save}>
            {saving ? "Guardando…" : dirty ? "Guardar rutina" : "Sin cambios"}
          </Button>
        </div>
      }
    >
      {/* Móvil: días en fila táctil. Web: semana completa a la izquierda, detalle a la derecha. */}
      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:hidden" role="tablist" aria-label="Día">
        {DAYS.map((d) => dayButton(d, "chip"))}
      </div>
      <div className="flex min-h-0 flex-1 gap-5 md:min-h-[60dvh]">
        <nav className="hidden w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border/60 pr-4 md:flex" role="tablist" aria-label="Semana">
          {DAYS.map((d) => dayButton(d, "row"))}
        </nav>
        {detail}
      </div>
      <ExercisePicker open={picker} onOpenChange={setPicker} existing={exercises.map((e) => e.name)} onPick={(entries) => setExercises((e) => [...e, ...entries])} />
    </ResponsiveSheet>
  );
};

export default PlanEditor;
