import { describe, expect, it } from "vitest";
import { buildExerciseHistory } from "./workoutMetrics";

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
      bestSetLabel: "60.5 kg × 8",
    });
  });
});
