export interface ReviewSet { reps: number; weight: string; done: boolean }
export interface ReviewExercise { name: string; sets: ReviewSet[] }
export interface WorkoutReviewItem { name: string; observation: string; proposal: string }

// Compare like-for-like work only. A heavier or longer session is not a performance percentage.
export function buildWorkoutReview(current: ReviewExercise[], previous: ReviewExercise[], rpe?: number | null): WorkoutReviewItem[] {
  const valid = (sets: ReviewSet[]) => sets.filter(s => s.done && Number.isFinite(s.reps) && s.reps > 0);
  const weight = (s: ReviewSet) => {
    const n = Number(s.weight.trim().replace(",", "."));
    return s.weight.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
  };
  return current.flatMap(ex => {
    const now = valid(ex.sets);
    if (!now.length) return [];
    const before = valid(previous.find(p => p.name === ex.name)?.sets || []);
    const comparable = before.length === now.length && now.every((s, i) => weight(s) !== null && weight(s) === weight(before[i]));
    const reps = now.reduce((n, s) => n + s.reps, 0);
    const delta = comparable ? reps - before.reduce((n, s) => n + s.reps, 0) : null;
    const observation = !before.length
      ? `${now.length} series completadas. Primera referencia disponible para este ejercicio.`
      : delta === null
      ? "Las cargas o las series no son comparables; no calculamos una mejora de rendimiento."
      : `${delta > 0 ? "+" : ""}${delta} repeticiones totales con las mismas cargas y el mismo número de series.`;
    const proposal = rpe != null && rpe >= 9
      ? "Revisar esfuerzo y recuperación antes de aumentar la carga."
      : delta !== null && delta < 0
      ? "Revisar descanso, técnica y sensaciones antes de cambiar la carga."
      : delta !== null && delta > 0
      ? "Valorar con el entrenador si procede una progresión, comprobando técnica y esfuerzo."
      : "Mantener el plan como referencia y reunir otra sesión comparable.";
    return [{ name: ex.name, observation, proposal }];
  });
}
