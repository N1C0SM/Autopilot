import type { DayPlan } from "@/shared/types/training";
import { formatTrainingTitle } from "@/shared/lib/trainingDisplay";

/**
 * Lo que se lee de una sesión en una línea (Hoy y Entrenar): sus músculos, cuánto dura y cuántos
 * ejercicios tiene. Una sola regla para la web; en la app son `DayPlan.sessionMuscles`,
 * `DayPlan.estimatedMinutes` y `DayPlan.summaryLine` (`native/Autopilot/Core/Training.swift`).
 */

/** «1 ejercicio» / «7 ejercicios», con un espacio que no se parte: la cifra nunca queda sola al final de una línea. */
export const countLabel = (count: number, one: string, many: string) => `${count}\u00a0${count === 1 ? one : many}`;

// Misma lectura del descanso que el registro de series («90 s», «2 min», «60-90 s»): sin número, 60 s.
const restOf = (rest: string) => {
  const values = rest.match(/\d+/g)?.map(Number) || [];
  if (values.length === 0) return 60;
  const value = values[values.length - 1];
  return /min/i.test(rest) ? value * 60 : value;
};

/** Duración orientativa: unos 45 s por serie más su descanso, redondeada a 5 min (null sin series). */
export const estimateMinutes = (plan: DayPlan): number | null => {
  const seconds = (plan.exercises ?? []).reduce(
    (total, exercise) => total + (Number(exercise.series) || 0) * (45 + restOf(String(exercise.rest ?? ""))),
    0,
  );
  return seconds > 0 ? Math.max(5, Math.round(seconds / 300) * 5) : null;
};

/** El nombre de la sesión sin sus músculos: «Full Body A» de «Full Body A · Pecho y espalda». */
export const sessionName = (title: string) => title.split(" · ")[0];

/**
 * Músculos de la sesión, sin repetirlos: lo que el título lleva tras el «·» o, sin foco, los de sus
 * ejercicios (hasta tres). `metaMuscle` lee el músculo de la biblioteca cuando el plan no lo guarda.
 */
export const sessionMuscles = (
  plan: DayPlan,
  metaMuscle?: (exercise: { exercise_id: string; name: string }) => string | null | undefined,
) => {
  if (plan.type !== "gimnasio") return "";
  const parts = formatTrainingTitle(plan.routine_name, plan.muscle_focus).split(" · ");
  if (parts.length > 1) return parts.slice(1).join(" · ");
  if (plan.muscle_focus?.trim()) return "";
  const groups = [...new Set((plan.exercises ?? [])
    .map((exercise) => (exercise.muscle_group || metaMuscle?.(exercise) || "").trim())
    .filter(Boolean))].slice(0, 3);
  return groups.length ? formatTrainingTitle(null, groups.join(", ")) : "";
};

/**
 * La línea de la sesión en Entrenar: «6 ejercicios · ≈ 45 min» en el gimnasio (sin ejercicios, la
 * invitación a añadirlos) e «Intensidad media · 45 min» en una actividad.
 */
export const sessionLine = (plan: DayPlan) => {
  if (plan.type === "gimnasio") {
    const count = plan.exercises?.length ?? 0;
    if (count === 0) return "Añade sus ejercicios";
    const minutes = estimateMinutes(plan);
    return [countLabel(count, "ejercicio", "ejercicios"), minutes ? `≈\u00a0${minutes}\u00a0min` : null].filter(Boolean).join(" · ");
  }
  return [plan.intensity ? `Intensidad ${plan.intensity.toLocaleLowerCase("es-ES")}` : null, plan.duration].filter(Boolean).join(" · ") || "Actividad";
};
