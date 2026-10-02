import {
  comparisonKey,
  resultLabel,
  stats,
  validResult,
  type Session,
  type TrackedExercise,
} from "./model";
export function allowedMetrics(e?: TrackedExercise) {
  return e?.kind === "legacy"
    ? []
    : e?.kind === "isometric" || e?.kind === "cardio"
      ? ["seconds", "rpe"]
      : e?.kind === "weight" && e.mode === "load"
        ? ["reps", "kg", "e1rm", "volume", "rpe"]
        : ["reps", "rpe"];
}
export function seriesPoints(
  sessions: Session[],
  key: string,
  metric: string,
  fixed = "",
) {
  return sessions
    .filter((s) => stats(s).performed)
    .slice()
    .sort((a, b) => a.payload.startedAt.localeCompare(b.payload.startedAt))
    .flatMap((s) => {
      const e = s.payload.exercises.find((e) => comparisonKey(e) === key);
      if (!e || !allowedMetrics(e).includes(metric)) return [];
      const sets = e.sets.filter((st) => st.done && validResult(e, st.actual));
      if (
        ["reps", "kg", "seconds"].includes(metric) &&
        e.mode !== "bodyweight" &&
        fixed === ""
      )
        return [];
      const compatible = sets.filter(
        (st) =>
          fixed === "" ||
          (metric === "kg"
            ? st.actual.reps === Number(fixed)
            : st.actual.kg === Number(fixed)),
      );
      const values = compatible.flatMap((st) => {
        const r = st.actual;
        const v =
          metric === "e1rm"
            ? r.kg !== null && r.kg > 0 && r.reps !== null && r.reps <= 12
              ? r.kg * (1 + r.reps / 30)
              : null
            : r[metric as "seconds" | "reps" | "kg" | "rpe"];
        return typeof v === "number" && Number.isFinite(v)
          ? [{ value: v, label: resultLabel(e, r) }]
          : [];
      });
      if (metric !== "volume" && !values.length) return [];
      const best = values.reduce<{ value: number; label: string } | null>(
        (best, v) => (!best || v.value > best.value ? v : best),
        null,
      );
      const value =
        metric === "volume"
          ? sets.reduce(
              (n, st) => n + (st.actual.kg || 0) * (st.actual.reps || 0),
              0,
            )
          : metric === "rpe"
            ? values.reduce((a, b) => a + b.value, 0) / values.length
            : best!.value;
      return [
        {
          id: s.id,
          date: s.local_date,
          value: Math.round(value * 100) / 100,
          sets: sets.length,
          best: metric === "volume" || metric === "rpe" ? null : best?.label,
        },
      ];
    });
}
