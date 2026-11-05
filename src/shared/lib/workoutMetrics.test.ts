import { describe, expect, it } from "vitest";
import { buildExerciseHistory, exerciseRecord } from "@/shared/lib/workoutMetrics";

describe("buildExerciseHistory", () => {
  it("summarizes only completed sets and estimates strength from the best set", () => {
    const history = buildExerciseHistory([{
      exercise_name: "Press banca",
      logged_at: "2026-10-02",
      sets_completed: [
        { weight: "60", reps: 8, done: true },
        { weight: "60", reps: 7, done: true },
        { weight: "80", reps: 8, done: false },
      ],
    }]);

    expect(history["Press banca"]).toHaveLength(1);
    expect(history["Press banca"][0]).toMatchObject({
      volumeKg: 900,
      bestEstimated1RmKg: 76,
      completedSets: 2,
      loadedSets: 2,
      reps: 15,
      bestSetLabel: "60 kg × 8",
    });
  });

  it("combines duplicate exercise records on one date and handles bodyweight-only logs", () => {
    const history = buildExerciseHistory([
      {
        exercise_name: "Dominadas",
        logged_at: "2026-10-02",
        sets_completed: [{ weight: "", reps: 8, done: true }],
      },
      {
        exercise_name: "Dominadas",
        logged_at: "2026-10-02",
        sets_completed: [{ weight: "10", reps: 6, done: true }],
      },
    ]);

    expect(history.Dominadas).toHaveLength(1);
    expect(history.Dominadas[0]).toMatchObject({
      volumeKg: 60,
      bestEstimated1RmKg: 12,
      completedSets: 2,
      loadedSets: 1,
      reps: 14,
    });
  });

  it("ignores invalid and unfinished records", () => {
    const history = buildExerciseHistory([
      { exercise_name: "A", logged_at: "2026-10-02", sets_completed: [{ weight: 20, reps: 8, done: false }] },
      { exercise_name: "B", logged_at: "bad-date", sets_completed: [{ weight: 20, reps: 8, done: true }] },
      { exercise_name: "C", logged_at: "2026-10-02", sets_completed: [{ weight: 20, reps: 0, done: true }] },
    ]);

    expect(history).toEqual({});
  });

  it("keeps decimal-comma loads consistent in workout volume and estimated 1RM", () => {
    const history = buildExerciseHistory([{
      exercise_name: "Sentadilla",
      logged_at: "2026-10-02",
      sets_completed: [{ weight: "60,5", reps: 8, done: true }],
    }]);

    expect(history.Sentadilla[0]).toMatchObject({
      volumeKg: 484,
      bestEstimated1RmKg: 76.6,
      bestSetLabel: "60,5 kg × 8",
    });
  });
});

describe("exerciseRecord", () => {
  const entry = (date: string, kg: number | null, reps = 8) => ({
    date, sessionLabel: date, volumeKg: kg ? kg * reps : 0, completedSets: 1, loadedSets: kg ? 1 : 0, reps,
    bestEstimated1RmKg: kg ? Math.round(kg * (1 + reps / 30) * 10) / 10 : null,
    bestSetLabel: kg ? `${kg} kg × ${reps}` : null,
  });
  it("devuelve la mejor serie y lo que ha subido desde la primera sesión con peso", () => {
    expect(exerciseRecord([entry("2026-10-01", null), entry("2026-10-08", 65), entry("2026-10-15", 72.5), entry("2026-10-22", 70)]))
      .toEqual({ label: "72.5 kg × 8", gainKg: 7.5 });
  });
  it("no inventa subida con una sola sesión ni sin peso", () => {
    expect(exerciseRecord([entry("2026-10-08", 65)])).toEqual({ label: "65 kg × 8", gainKg: null });
    expect(exerciseRecord([entry("2026-10-08", null)])).toEqual({ label: null, gainKg: null });
  });
});
