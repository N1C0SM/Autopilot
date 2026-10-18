import { beforeEach, describe, expect, it } from "vitest";
import { clearActiveWorkout, readActiveWorkout, remainingRestSeconds, saveActiveWorkout, type ActiveWorkout } from "./activeWorkout";
import { getWorkoutView, setWorkoutView } from "./workoutPreferences";

const draft: ActiveWorkout = { version: 1, userId: "athlete", date: "2026-10-18",
  plan: { day: "Domingo", type: "gimnasio", routine_name: "Entrenamiento libre", exercises: [{ exercise_id: "row", name: "Remo", series: 3, reps: 10, weight: "20", rest: "60 s" }] },
  logs: { Remo: [{ reps: 10, weight: "25", done: true, drops: [{ weight: "15", reps: 8 }] }] },
  swaps: { Remo: "Remo en anillas" }, supersetLinks: {}, expandedExercise: 0, restEndsAt: 61000, restTarget: 60 };
beforeEach(() => localStorage.clear());
describe("active workout recovery", () => {
  it("keeps the free plan, edited sets and deadline after reloading storage", () => {
    expect(saveActiveWorkout(draft)).toBe(true);
    expect(readActiveWorkout("athlete")).toEqual(draft);
  });
  it("never recovers another account's workout", () => {
    saveActiveWorkout(draft);
    expect(readActiveWorkout("other")).toBeNull();
  });
  it("removes completed drafts", () => {
    saveActiveWorkout(draft);
    clearActiveWorkout("athlete");
    expect(readActiveWorkout("athlete")).toBeNull();
  });
  it("accounts for 45 seconds in the background and expires after 60 seconds", () => {
    expect(remainingRestSeconds(61000, 46000)).toBe(15);
    expect(remainingRestSeconds(61000, 61000)).toBeNull();
    expect(remainingRestSeconds(61000, 91000)).toBeNull();
  });
  it("keeps either display choice per account", () => {
    expect(getWorkoutView("athlete")).toBe("list");
    setWorkoutView("athlete", "focus");
    expect(getWorkoutView("athlete")).toBe("focus");
    expect(getWorkoutView("other")).toBe("list");
    setWorkoutView("athlete", "list");
    expect(getWorkoutView("athlete")).toBe("list");
  });
});