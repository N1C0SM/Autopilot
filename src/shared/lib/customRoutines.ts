import type { DayPlan, GymExerciseEntry } from "@/shared/types/training";
import type { WorkoutSetLog } from "@/shared/lib/workoutSet";
import { ROUTINE_KEYS, routineSessions } from "@/shared/lib/routineOrder";

/**
 * Rutinas propias («Nueva rutina», «Mis rutinas», «Duplicar», «Borrar» y «Guardar como rutina»).
 * No hay tabla aparte: cada rutina es una sesión más de `training_plan.workouts_json`, con la
 * siguiente clave libre del orden (`ROUTINE_KEYS`) y `custom: true`. Solo la rutina creada o
 * editada por el usuario lleva `custom: true`; las sesiones del piloto automático no se tocan.
 * Es `CustomRoutines` en la app nativa (`native/Autopilot/Core/Training.swift`).
 */

/** Siete claves de orden: como mucho siete sesiones en el plan. */
export const MAX_ROUTINE_SESSIONS = ROUTINE_KEYS.length;
/** Lo que se dice cuando no cabe otra sesión (nunca se falla en silencio). */
export const SESSION_LIMIT_MESSAGE = "Tienes 7 sesiones: borra o edita una para añadir otra";
/** Nombre si el usuario lo deja vacío. */
export const DEFAULT_ROUTINE_NAME = "Mi rutina";
/** `routine_name` del entreno vacío (el mismo en la app): tras él se ofrece «Guardar como rutina». */
export const FREE_WORKOUT_NAME = "Entrenamiento libre";

export type RoutineChange =
  | { ok: true; plans: DayPlan[]; day: string }
  | { ok: false; reason: "limit" | "missing" };

const keyIndex = (day: string) => {
  const index = ROUTINE_KEYS.indexOf(day);
  return index < 0 ? ROUTINE_KEYS.length : index;
};
const sorted = (plans: DayPlan[]) => [...plans].sort((a, b) => keyIndex(a.day) - keyIndex(b.day));
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const cleanName = (name: string | null | undefined) => String(name ?? "").trim();

/** Rutinas del usuario: las sesiones de gimnasio marcadas `custom`, en el orden de la rutina. */
export const myRoutines = (plans: readonly DayPlan[]): DayPlan[] =>
  routineSessions(plans).filter((plan) => plan.type === "gimnasio" && plan.custom === true);

/** Primera clave del orden que no usa ninguna entrada del plan; null si están las siete. */
export const nextFreeKey = (plans: readonly DayPlan[]): string | null =>
  ROUTINE_KEYS.find((key) => !plans.some((plan) => plan?.day === key)) ?? null;

/** ¿Cabe otra sesión? */
export const canAddRoutine = (plans: readonly DayPlan[]): boolean => nextFreeKey(plans) !== null;

/** «Pierna pesada (copia)». */
export const copyName = (name: string | null | undefined): string => `${cleanName(name) || DEFAULT_ROUTINE_NAME} (copia)`;

/** Nombre que se enseña de una rutina (el suyo o «Mi rutina»). */
export const routineName = (plan: Pick<DayPlan, "routine_name">): string => cleanName(plan.routine_name) || DEFAULT_ROUTINE_NAME;

/** «Pecho, espalda y hombros» (y «… y 2 más»): los músculos de sus ejercicios, sin repetir. */
export const routineMuscles = (plan: Pick<DayPlan, "exercises">): string => {
  const seen = new Map<string, string>();
  for (const exercise of plan.exercises ?? []) {
    const muscle = cleanName(exercise.muscle_group);
    if (muscle && !seen.has(muscle.toLocaleLowerCase("es"))) seen.set(muscle.toLocaleLowerCase("es"), muscle);
  }
  const names = [...seen.values()].map((name, index) => (index === 0 ? name : name.toLocaleLowerCase("es")));
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  return `${names.slice(0, 3).join(", ")} y ${names.length - 3} más`;
};

/** «4 ejercicios · Pecho, espalda y hombros» (sin músculos, solo el recuento). */
export const routineMeta = (plan: Pick<DayPlan, "exercises">): string => {
  const count = plan.exercises?.length ?? 0;
  return [`${count} ${count === 1 ? "ejercicio" : "ejercicios"}`, routineMuscles(plan)].filter(Boolean).join(" · ");
};

/** Nueva rutina en la siguiente clave libre, marcada como tuya. */
export function addRoutine(plans: readonly DayPlan[], routine: { name: string; exercises: GymExerciseEntry[] }): RoutineChange {
  const day = nextFreeKey(plans);
  if (!day) return { ok: false, reason: "limit" };
  const next: DayPlan = {
    day,
    type: "gimnasio",
    routine_name: cleanName(routine.name) || DEFAULT_ROUTINE_NAME,
    muscle_focus: "",
    exercises: clone(routine.exercises),
    custom: true,
  };
  return { ok: true, day, plans: sorted([...plans, next]) };
}

/** Cambia nombre y ejercicios de una sesión: solo esa pasa a ser tuya. */
export function updateRoutine(plans: readonly DayPlan[], day: string, routine: { name: string; exercises: GymExerciseEntry[] }): RoutineChange {
  if (!plans.some((plan) => plan.day === day)) return { ok: false, reason: "missing" };
  return {
    ok: true,
    day,
    plans: plans.map((plan) => (plan.day === day
      ? {
        ...plan,
        type: "gimnasio" as const,
        routine_name: cleanName(routine.name) || cleanName(plan.routine_name) || DEFAULT_ROUTINE_NAME,
        exercises: clone(routine.exercises),
        custom: true,
      }
      : plan)),
  };
}

/** Copia «<nombre> (copia)» en la siguiente clave libre; la original no cambia. */
export function duplicateRoutine(plans: readonly DayPlan[], day: string): RoutineChange {
  const source = plans.find((plan) => plan.day === day);
  if (!source) return { ok: false, reason: "missing" };
  const free = nextFreeKey(plans);
  if (!free) return { ok: false, reason: "limit" };
  const copy: DayPlan = { ...clone(source), day: free, routine_name: copyName(source.routine_name), custom: true };
  return { ok: true, day: free, plans: sorted([...plans, copy]) };
}

/** Quita la rutina del plan. El historial y los récords siguen en sus tablas. */
export function deleteRoutine(plans: readonly DayPlan[], day: string): RoutineChange {
  if (!plans.some((plan) => plan.day === day)) return { ok: false, reason: "missing" };
  return { ok: true, day, plans: plans.filter((plan) => plan.day !== day) };
}

/** Contenido de una sesión sin la marca `custom` (para saber si el usuario la tocó). */
const content = (plan: DayPlan) => {
  const { custom: _custom, ...rest } = plan;
  return JSON.stringify(rest);
};

/**
 * Editor de rutina: solo los días nuevos o cambiados pasan a `custom: true`; los que no se tocaron
 * conservan su marca tal cual (las sesiones del piloto automático siguen siendo suyas).
 */
export function markEditedDays(original: readonly DayPlan[], next: readonly DayPlan[]): DayPlan[] {
  return next.map((plan) => {
    const before = original.find((candidate) => candidate.day === plan.day);
    if (!before || content(before) !== content(plan)) return { ...plan, custom: true };
    return plan;
  });
}

/** Modo del plan: todo del piloto automático, todo tuyo o mezclado. */
export type PlanMode = "auto" | "custom" | "mixed";
export const planMode = (plans: readonly DayPlan[]): PlanMode => {
  const sessions = routineSessions(plans);
  const mine = sessions.filter((plan) => plan.custom === true).length;
  if (mine === 0) return "auto";
  return mine === sessions.length ? "custom" : "mixed";
};

/**
 * Cabecera de Entrenar: el modo del plan en una sola frase corta (`CustomRoutines.modeLine` en la app).
 * «Tu plan lo prepara el piloto automático.», «Tu plan lo has creado tú.» o, mezclado, «…, con 2 rutinas tuyas.».
 */
export const planModeLine = (plans: readonly DayPlan[]): string => {
  const mode = planMode(plans);
  if (mode === "custom") return "Tu plan lo has creado tú.";
  if (mode === "auto") return "Tu plan lo prepara el piloto automático.";
  const mine = myRoutines(plans).length;
  return `Tu plan lo prepara el piloto automático, con ${mine} ${mine === 1 ? "rutina tuya" : "rutinas tuyas"}.`;
};

/**
 * «Completar con el autopiloto» en «Mis rutinas» (`CustomRoutines.canCompleteWithAutopilot` en la app):
 * solo con rutinas tuyas, un plan que es todo tuyo (sin sesiones del piloto automático) y menos
 * sesiones que tus días de entreno (`frequency`, la misma cuenta que generate-plan:
 * `planTrainingDays`). Sin saber tus días (null), no se ofrece.
 */
export function canCompleteWithAutopilot(plans: readonly DayPlan[], frequency: number | null | undefined): boolean {
  if (frequency == null || !Number.isFinite(frequency) || myRoutines(plans).length === 0) return false;
  const sessions = routineSessions(plans);
  if (!sessions.every((plan) => plan.custom === true)) return false;
  return sessions.length < Math.min(Math.max(Math.floor(frequency), 0), MAX_ROUTINE_SESSIONS);
}

/** Textos de «Completar con el autopiloto»: los mismos en la app (`CustomRoutines.fill*`). */
export const AUTOPILOT_FILL = {
  action: "Completar con el autopiloto",
  detail: "El piloto automático prepara las sesiones que faltan y respeta las tuyas.",
  running: "Preparando tus sesiones…",
  errorTitle: "No se han podido preparar tus sesiones",
  errorDetail: "Revisa tu conexión y vuelve a intentarlo. Tus rutinas siguen guardadas.",
  retry: "Reintentar",
} as const;

/** «Tus rutinas cubren 2 de tus 4 días de entreno» / «Tu rutina cubre 1 de tus 3 días de entreno». */
export const autopilotFillSummary = (own: number, frequency: number): string =>
  own === 1
    ? `Tu rutina cubre 1 de tus ${frequency} días de entreno`
    : `Tus rutinas cubren ${own} de tus ${frequency} días de entreno`;

/**
 * «Guardar como rutina» tras un entreno vacío: cada ejercicio con series hechas pasa con esas
 * series, sus repeticiones (un número o el rango hecho, «8-12») y el peso más alto. Los ejercicios
 * sin ninguna serie hecha no entran. Los isométricos conservan sus segundos («30s»).
 */
export function routineFromWorkout(
  exercises: readonly GymExerciseEntry[],
  logs: Record<string, readonly Pick<WorkoutSetLog, "reps" | "weight" | "done" | "isWarmup">[]>,
): GymExerciseEntry[] {
  return exercises.flatMap((exercise) => {
    const done = (logs[exercise.name] ?? []).filter((set) => set.done && !set.isWarmup);
    if (done.length === 0) return [];
    const reps = done.map((set) => Number(set.reps)).filter((n) => Number.isFinite(n) && n > 0);
    const seconds = typeof exercise.reps === "string" && /s\s*$/i.test(exercise.reps);
    const low = reps.length ? Math.min(...reps) : 0;
    const high = reps.length ? Math.max(...reps) : 0;
    const nextReps = seconds || reps.length === 0
      ? exercise.reps
      : low === high ? low : `${low}-${high}`;
    const weights = done
      .map((set) => Number(String(set.weight ?? "").replace(",", ".")))
      .filter((n) => Number.isFinite(n) && n > 0);
    const weight = weights.length ? String(Math.max(...weights)) : String(exercise.weight ?? "");
    return [{
      ...clone(exercise),
      series: done.length,
      reps: nextReps as GymExerciseEntry["reps"],
      weight,
    }];
  });
}

type PlanClient = {
  from: (table: "training_plan") => {
    select: (columns: "workouts_json") => {
      eq: (column: "user_id", value: string) => {
        maybeSingle: () => PromiseLike<{ data: { workouts_json: unknown } | null; error: unknown }>;
      };
    };
    upsert: (
      row: { user_id: string; workouts_json: unknown; updated_at: string },
      options: { onConflict: "user_id" },
    ) => PromiseLike<{ error: unknown }>;
  };
};

export type RoutineCommit =
  | { ok: true; plans: DayPlan[]; day: string }
  | { ok: false; reason: "limit" | "missing" | "error" };

/**
 * Aplica un cambio sobre el plan GUARDADO (no sobre la copia de la pantalla) y lo guarda.
 * Sin fila todavía (sin plan), la crea solo con la rutina: el dueño puede insertar su fila (RLS).
 */
export async function commitRoutineChange(
  client: PlanClient,
  userId: string,
  change: (plans: DayPlan[]) => RoutineChange,
): Promise<RoutineCommit> {
  const { data, error } = await client.from("training_plan").select("workouts_json").eq("user_id", userId).maybeSingle();
  if (error) return { ok: false, reason: "error" };
  const current = Array.isArray(data?.workouts_json) ? (data!.workouts_json as DayPlan[]) : [];
  const result = change(current);
  if (!result.ok) return result;
  const { error: saveError } = await client
    .from("training_plan")
    .upsert({ user_id: userId, workouts_json: result.plans, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (saveError) return { ok: false, reason: "error" };
  return result;
}
