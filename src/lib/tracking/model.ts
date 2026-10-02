import { friendlyGoalText } from "@/lib/trainingDisplay";
import type { DayPlan, GymExerciseEntry } from "@/types/training";
import { toLocalDateString } from "@/lib/localDates";
export type TrackingKind =
  | "weight"
  | "bodyweight"
  | "isometric"
  | "cardio"
  | "legacy";
export type LoadMode = "load" | "bodyweight" | "added" | "assisted";
export interface Result {
  reps: number | null;
  seconds: number | null;
  kg: number | null;
  distance: number | null;
  rpe: number | null;
}
export interface TrackedSet {
  id: string;
  planned: boolean;
  done: boolean;
  target: Result;
  actual: Result;
}
export interface TrackedExercise {
  id: string;
  exerciseId: string;
  name: string;
  kind: TrackingKind;
  variant: string;
  mode: LoadMode;
  assistance: string;
  muscle: string;
  notes: string;
  sets: TrackedSet[];
  video?: string | null;
}
export interface Session {
  id: string;
  user_id: string;
  local_date: string;
  timezone: string;
  status: "in_progress" | "completed";
  revision: number;
  payload: {
    title: string;
    startedAt: string;
    exercises: TrackedExercise[];
    notes: string;
    legacy?: boolean;
  };
  updated_at?: string;
}
export const emptyResult = (): Result => ({
  reps: null,
  seconds: null,
  kg: null,
  distance: null,
  rpe: null,
});
export const kinds: Record<TrackingKind, string> = {
  weight: "Pesas",
  bodyweight: "Calistenia dinámica",
  isometric: "Isométrico",
  cardio: "Cardio",
  legacy: "Registro antiguo (tipo desconocido)",
};
export const modes: Record<LoadMode, string> = {
  load: "Carga externa",
  bodyweight: "Peso corporal",
  added: "Lastre",
  assisted: "Asistencia",
};
export function exerciseFromPlan(
  e: GymExerciseEntry & { stimulus_type?: string | null },
): TrackedExercise {
  const kind: TrackingKind =
    e.tracking_kind ||
    (e.stimulus_type === "Isométrico"
      ? "isometric"
      : e.exercise_type === "Calistenia"
        ? "bodyweight"
        : e.muscle_group === "Cardio"
          ? "cardio"
          : "weight");
  const target = {
    ...emptyResult(),
    reps: kind === "weight" || kind === "bodyweight" ? e.reps : null,
    seconds: e.target_seconds ?? null,
    distance: e.target_distance ?? null,
    kg:
      (e.weight || "").trim() !== "" &&
      Number.isFinite(Number((e.weight || "").replace(",", ".")))
        ? Number((e.weight || "").replace(",", "."))
        : null,
  };
  return {
    id: crypto.randomUUID(),
    exerciseId: e.exercise_id,
    name: e.name,
    kind,
    variant: e.variant || "",
    mode: e.load_mode || (kind === "weight" ? "load" : "bodyweight"),
    assistance: "",
    muscle: e.muscle_group || "",
    notes: "",
    video: e.video_url,
    sets: Array.from({ length: e.series }, () => ({
      id: crypto.randomUUID(),
      planned: true,
      done: false,
      target: { ...target },
      actual: emptyResult(),
    })),
  };
}
export function createSession(user: string, plan: DayPlan): Session {
  const exercises = plan.exercises?.map(exerciseFromPlan) || [];
  if (plan.type === "actividad")
    exercises.push(
      exerciseFromPlan({
        exercise_id: "",
        name: plan.sport || "Actividad",
        tracking_kind: "cardio",
        series: 1,
        reps: 0,
        weight: "",
        rest: "",
      }),
    );
  return {
    id: crypto.randomUUID(),
    user_id: user,
    local_date: toLocalDateString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    status: "in_progress",
    revision: 0,
    payload: {
      title: friendlyGoalText(plan.routine_name || plan.sport || plan.day),
      startedAt: new Date().toISOString(),
      exercises,
      notes: "",
    },
  };
}
export function validResult(e: TrackedExercise, r: Result): boolean {
  const positive = (n: number | null) =>
    n !== null && Number.isFinite(n) && n > 0;
  if (r.rpe !== null && (!Number.isFinite(r.rpe) || r.rpe < 1 || r.rpe > 10))
    return false;
  if (r.kg !== null && (!Number.isFinite(r.kg) || r.kg < 0)) return false;
  if (r.distance !== null && !positive(r.distance)) return false;
  if (e.kind === "cardio" || e.kind === "isometric") return positive(r.seconds);
  return (
    positive(r.reps) &&
    Number.isInteger(r.reps) &&
    (e.mode === "bodyweight" || e.kind === "legacy" || r.kg !== null)
  );
}
export function stats(s: Session) {
  const sets = s.payload.exercises.flatMap((e) =>
    e.sets.map((set) => ({
      ...set,
      valid: set.done && validResult(e, set.actual),
    })),
  );
  const planned = sets.filter((s) => s.planned).length,
    done = sets.filter((s) => s.valid).length;
  const plannedDone = sets.filter((s) => s.planned && s.valid).length;
  return {
    planned,
    done,
    extra: sets.filter((s) => !s.planned && s.valid).length,
    compliance: s.payload.legacy
      ? null
      : planned
        ? Math.round((plannedDone / planned) * 100)
        : null,
    performed: s.status === "completed" && done > 0,
  };
}
export function comparisonKey(e: TrackedExercise) {
  return JSON.stringify([
    e.exerciseId || e.name,
    e.kind,
    e.variant.trim().toLowerCase(),
    e.mode,
    e.assistance.trim().toLowerCase(),
  ]);
}
export function previousExercise(
  s: Session,
  e: TrackedExercise,
  history: Session[],
) {
  return [...history]
    .filter(
      (h) =>
        h.id !== s.id &&
        h.status === "completed" &&
        h.payload.startedAt < s.payload.startedAt,
    )
    .sort((a, b) => b.payload.startedAt.localeCompare(a.payload.startedAt))
    .flatMap((h) =>
      h.payload.exercises
        .filter(
          (x) =>
            comparisonKey(x) === comparisonKey(e) &&
            x.sets.some((set) => set.done && validResult(x, set.actual)),
        )
        .map((exercise) => ({ session: h, exercise })),
    )[0];
}
export function resultLabel(e: TrackedExercise, r: Result) {
  if (e.kind === "isometric" || e.kind === "cardio")
    return `${r.seconds ?? "—"} s${r.distance != null ? ` · ${r.distance} km` : ""}${e.mode !== "bodyweight" ? ` · ${r.kg ?? "—"} kg (${modes[e.mode]})` : ""}`;
  return `${r.reps ?? "—"} reps${e.mode !== "bodyweight" ? ` · ${r.kg ?? "—"} kg (${modes[e.mode]})` : ""}`;
}
export function weekKey(date: string) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toLocalDateString(d);
}
export function weeklyMuscles(sessions: Session[]) {
  const counts: Record<string, number> = {};
  sessions
    .filter((s) => stats(s).performed)
    .forEach((s) =>
      s.payload.exercises.forEach((e) => {
        if (!e.muscle || e.kind === "cardio") return;
        const key = `${weekKey(s.local_date)} · ${e.muscle}`;
        counts[key] =
          (counts[key] || 0) +
          e.sets.filter((set) => set.done && validResult(e, set.actual)).length;
      }),
    );
  return counts;
}
export const defaultRules = {
  minimumSessions: 2,
  maxRpe: 8,
  incrementKg: 1.25,
};
export function recommendation(
  s: Session,
  e: TrackedExercise,
  history: Session[],
  rules = defaultRules,
) {
  const matches = [...history]
    .filter((h) => stats(h).performed)
    .sort((a, b) => b.payload.startedAt.localeCompare(a.payload.startedAt))
    .flatMap((h) =>
      h.payload.exercises
        .filter((x) => comparisonKey(x) === comparisonKey(e))
        .map((x) => ({ session: h, exercise: x })),
    )
    .slice(0, rules.minimumSessions);
  const evidence = matches.map((m) => m.session.id);
  const conditions = `Mínimo ${rules.minimumSessions} sesiones comparables; todas las series previstas alcanzan el objetivo; RPE registrado ≤ ${rules.maxRpe}. Incremento: ${rules.incrementKg} kg.`;
  if (
    e.kind !== "weight" ||
    e.mode !== "load" ||
    matches.length < rules.minimumSessions
  )
    return {
      label: "Mantener",
      reason:
        "Todavía no hay información suficiente para proponer un aumento de carga.",
      evidence,
      conditions,
      kg: null,
    };
  const sets = matches.flatMap((m) => m.exercise.sets.filter((s) => s.planned));
  const high = sets.some(
    (s) => s.done && s.actual.rpe !== null && s.actual.rpe > rules.maxRpe,
  );
  const load = sets[0]?.actual.kg;
  const achieved =
    sets.length > 0 &&
    sets.every(
      (set) =>
        set.done &&
        set.target.reps !== null &&
        set.actual.reps !== null &&
        set.actual.reps >= set.target.reps &&
        set.actual.kg === load &&
        set.target.kg !== null &&
        set.actual.kg !== null &&
        set.actual.kg >= set.target.kg &&
        set.actual.rpe !== null &&
        set.actual.rpe <= rules.maxRpe,
    );
  return {
    label: high ? "Revisar" : achieved ? "Aumentar" : "Mantener",
    reason: high
      ? "El esfuerzo registrado supera el umbral: revisar recuperación y técnica."
      : achieved
        ? "Objetivos alcanzados con la misma carga y esfuerzo dentro del umbral."
        : "Faltan objetivos alcanzados o registros de esfuerzo compatibles.",
    evidence,
    conditions,
    kg: achieved && load != null ? load + rules.incrementKg : null,
  };
}
