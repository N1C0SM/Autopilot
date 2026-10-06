export interface ReviewSet { reps: number; weight: string; done: boolean; isWarmup?: boolean }
export interface ReviewExercise { name: string; sets: ReviewSet[] }
export interface WorkoutReviewItem { name: string; observation: string; proposal: string }

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("es-ES");

// Compare against the previous session with real numbers: top load, reps at equal load, then volume.
// Las series de calentamiento no entran en la comparación (ni en el volumen ni en el recuento).
export function buildWorkoutReview(current: ReviewExercise[], previous: ReviewExercise[], rpe?: number | null): WorkoutReviewItem[] {
  const valid = (sets: ReviewSet[]) => sets.filter(s => s.done && s.isWarmup !== true && Number.isFinite(s.reps) && s.reps > 0);
  const weight = (s: ReviewSet) => {
    const n = Number(s.weight.trim().replace(",", "."));
    return s.weight.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
  };
  return current.flatMap(ex => {
    const now = valid(ex.sets);
    if (!now.length) return [];
    const before = valid(previous.find(p => p.name === ex.name)?.sets || []);
    const weighted = (sets: ReviewSet[]) => sets.length > 0 && sets.every(s => weight(s) !== null);
    const top = (sets: ReviewSet[]) => Math.max(...sets.map(s => weight(s) || 0));
    const vol = (sets: ReviewSet[]) => sets.reduce((t, s) => t + (weight(s) || 0) * s.reps, 0);
    const reps = (sets: ReviewSet[]) => sets.reduce((n, s) => n + s.reps, 0);
    let observation: string;
    let delta: number | null = null;
    if (!before.length) {
      observation = `${now.length} series completadas. Primera referencia disponible para este ejercicio.`;
    } else if (!weighted(now) || !weighted(before)) {
      delta = reps(now) - reps(before);
      observation = `${delta > 0 ? "+" : ""}${delta} repeticiones totales frente a la sesión anterior.`;
    } else if (top(now) !== top(before)) {
      const d = top(now) - top(before);
      delta = d;
      observation = `${d > 0 ? "+" : "−"}${fmt(Math.abs(d))} kg de carga máxima (${fmt(top(now))} kg vs ${fmt(top(before))} kg).`;
    } else if (now.length === before.length && now.every((s, i) => weight(s) === weight(before[i]))) {
      delta = reps(now) - reps(before);
      observation = `${delta > 0 ? "+" : ""}${delta} repeticiones totales con las mismas cargas y el mismo número de series.`;
    } else {
      const d = vol(now) - vol(before);
      delta = d;
      const pct = vol(before) > 0 ? Math.round((d / vol(before)) * 100) : 0;
      observation = `${d > 0 ? "+" : "−"}${fmt(Math.abs(d))} kg de volumen (${pct > 0 ? "+" : ""}${pct} %) frente a la sesión anterior.`;
    }
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
