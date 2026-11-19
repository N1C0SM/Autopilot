import { useEffect, useMemo, useState } from "react";
import { Copy, History, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/shared/integrations/supabase/client";
import type { Json } from "@/shared/integrations/supabase/types";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { clearBackup, readBackup } from "@/shared/lib/planShield";
import { normalizePlan, planToSave, rowKeys } from "@/shared/lib/planEditorValues";
import { exerciseCount } from "@/shared/lib/exerciseLibrary";
import { cn } from "@/shared/lib/utils";
import { DAYS, type DayPlan, type GymExerciseEntry } from "@/shared/types/training";
import ExercisePicker from "@/app/components/dashboard/ExercisePicker";
import ExerciseRowEditor from "@/app/components/dashboard/ExerciseRowEditor";
import ResponsiveSheet from "@/app/components/dashboard/ResponsiveSheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  dayPlans: DayPlan[];
  /** Día que se abre al entrar (tocar una rutina en Inicio). */
  initialDay?: string;
  onSaved: (plans: DayPlan[]) => void;
}

const clone = (p: DayPlan[]) => JSON.parse(JSON.stringify(p)) as DayPlan[];

const daySummary = (p?: DayPlan) => {
  if (!p) return "Descanso";
  if (p.type === "actividad") return p.sport || "Actividad";
  const n = p.exercises?.length ?? 0;
  if (!n) return "Descanso";
  const sets = p.exercises!.reduce((a, e) => a + e.series, 0);
  return `${exerciseCount(n)} · ${sets} ${sets === 1 ? "serie" : "series"}`;
};

const PlanEditor = ({ open, onOpenChange, userId, dayPlans, initialDay, onSaved }: Props) => {
  const [draft, setDraft] = useState<DayPlan[]>([]);
  const [day, setDay] = useState<string>(DAYS[0]);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const backup = useMemo(() => (open ? readBackup(userId) : null), [open, userId]);

  useEffect(() => {
    if (open) {
      setDraft(clone(dayPlans));
      setDay(initialDay ?? dayPlans[0]?.day ?? DAYS[0]);
      setCopyOpen(false);
      setConfirmReset(false);
      setConfirmDiscard(false);
    }
  }, [open, dayPlans, initialDay]);

  const plan = draft.find((p) => p.day === day);
  const exercises = plan?.type === "gimnasio" ? plan.exercises ?? [] : [];
  // Clave por ejercicio, no por posición: al subir o bajar una fila abierta, sigue abierta.
  const keys = rowKeys(exercises);
  const dirty = JSON.stringify(normalizePlan(draft)) !== JSON.stringify(normalizePlan(dayPlans));

  // Cerrar con swipe, overlay o Escape no debe tirar el trabajo: si hay cambios sin
  // guardar se pide confirmación (mismo patrón que «Empezar de cero»).
  const requestClose = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(false);
  };

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
    // Se guarda el borrador tal cual (reps «8-12» o descanso «75 s» intactos), ordenado y marcado como
    // tuyo solo en los días que cambiaste: las sesiones del piloto automático que no tocas siguen siendo suyas.
    const clean = planToSave(draft, dayPlans);
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
          aria-label={`${d}${has ? `: ${daySummary(p)}` : ", sin sesión"}`}
          className={cn(
            "flex min-h-11 min-w-[52px] flex-1 shrink-0 flex-col items-center justify-center gap-1 rounded-media px-2 py-2 transition-colors",
            active ? "bg-primary/15 text-foreground" : "bg-secondary text-muted-foreground",
          )}>
          <span className="type-footnote font-semibold">{d.slice(0, 3)}</span>
          <span className={cn("h-1.5 w-1.5 rounded-full", has ? "bg-primary" : "bg-border")} aria-hidden />
        </button>
      );
    }
    return (
      <button key={d} type="button" role="tab" aria-selected={active}
        onClick={() => { setDay(d); setCopyOpen(false); }}
        className={cn(
          "flex w-full items-center gap-3 rounded-media px-3 py-2.5 text-left transition-colors",
          active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-secondary",
        )}>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", has ? "bg-primary" : "bg-border")} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block type-subhead font-medium text-foreground">{d}</span>
          <span className="block truncate type-footnote">{p?.routine_name ? `${p.routine_name} · ` : ""}{daySummary(p)}</span>
        </span>
      </button>
    );
  };

  const detail = (
    <div className="flex min-h-0 flex-1 flex-col">
      {plan?.type === "actividad" ? (
        <div className="space-y-3 rounded-[22px] bg-card p-4">
          <p className="type-subhead text-muted-foreground">{[`${day}: ${plan.sport || "Actividad"}`, plan.duration].filter(Boolean).join(" · ")}</p>
          <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => update(() => ({ day, type: "gimnasio", routine_name: "", muscle_focus: "", exercises: [] }))}>
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
            <div className="mt-2 flex flex-wrap gap-2 py-1" role="group" aria-label="Copiar la sesión a">
              {DAYS.filter((d) => d !== day).map((d) => (
                <button key={d} type="button" onClick={() => copyTo(d)} className="h-10 rounded-full bg-secondary px-4 type-footnote font-semibold transition active:opacity-60">{d}</button>
              ))}
            </div>
          )}
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
            {exercises.length === 0 ? (
              // Día sin ejercicios: una tarjeta grande que invita a añadirlos (como `PlanEditorView`).
              <button type="button" onClick={() => setPicker(true)}
                className="flex min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-[28px] bg-card px-6 text-center text-muted-foreground transition-transform duration-150 active:scale-[0.985]">
                <span aria-hidden className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary"><Plus className="h-6 w-6" /></span>
                <span className="type-headline text-foreground">Día de descanso</span>
                <span className="type-footnote">Añade ejercicios para entrenar el {day.toLowerCase()}</span>
              </button>
            ) : (
              <>
                <ul className="space-y-3">
                  {exercises.map((ex, i) => (
                    <ExerciseRowEditor key={keys[i]} ex={ex} index={i} total={exercises.length}
                      onChange={(e) => setExercises((l) => l.map((x, k) => (k === i ? e : x)))}
                      onMove={(d) => move(i, d)}
                      onRemove={() => setExercises((e) => e.filter((_, k) => k !== i))} />
                  ))}
                </ul>
                <Button type="button" variant="secondary" size="lg" className="mt-3 w-full" onClick={() => setPicker(true)}>
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
      onOpenChange={(next) => { if (next) onOpenChange(true); else requestClose(); }}
      title="Editar mi rutina"
      desktopClassName="sm:max-w-5xl"
      footer={
        confirmDiscard ? (
          <div role="alert" aria-live="assertive">
            <p className="mb-2 text-center type-footnote text-muted-foreground">Tienes cambios sin guardar en tu rutina.</p>
            <div className="flex flex-col-reverse gap-1 md:flex-row md:items-center md:gap-2">
              <Button type="button" variant="destructive" className="min-h-11 flex-1 md:flex-none" onClick={() => { setConfirmDiscard(false); onOpenChange(false); }}>
                Descartar cambios
              </Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setConfirmDiscard(false)}>
                Seguir editando
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-1 md:flex-row md:items-center md:gap-2">
            <div className="flex justify-center gap-1 md:mr-auto">
            {confirmReset ? (
              <>
                <Button type="button" variant="destructive" className="min-h-11 flex-1" onClick={() => { setDraft([]); setConfirmReset(false); }}>Sí, vaciar semana</Button>
                <Button type="button" variant="ghost" className="min-h-11" onClick={() => setConfirmReset(false)}>Cancelar</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirmReset(true)}>
                  <RotateCcw className="h-4 w-4" /> Empezar de cero
                </Button>
                {backup && (
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => {
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
        )
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
