import { beforeEach, describe, expect, it } from "vitest";
import { clearActiveWorkout, readActiveWorkout, saveActiveWorkout, type ActiveWorkout } from "./activeWorkout";

const draft: ActiveWorkout = {
  version: 1, userId: "alice", date: "2026-10-18",
  plan: { day: "Viernes", type: "gimnasio", routine_name: "Libre", exercises: [{ exercise_id: "row", name: "Remo", series: 1, reps: 8, weight: "30", rest: "60 s" }] },
  logs: { Remo: [{ reps: 9, weight: "35", done: true, drops: [{ weight: "20", reps: 5 }] }] },
  expandedExercise: 0, swaps: {}, supersets: {}, restChain: null, restDeadline: 100000, restTarget: 60, rpe: null, updatedAt: 40000,
};
beforeEach(() => localStorage.clear());
describe("active workout recovery", () => {
  it("restores the full free plan and edits, without changing the session date", () => {
    expect(saveActiveWorkout(draft)).toBe(true);
    expect(readActiveWorkout("alice")).toEqual(draft);
  });
  it("never reads or removes another user's workout", () => {
    saveActiveWorkout(draft);
    expect(readActiveWorkout("bob")).toBeNull();
    clearActiveWorkout("bob");
    expect(readActiveWorkout("alice")).toEqual(draft);
  });
  it("clears a finished workout and rejects malformed snapshots", () => {
    saveActiveWorkout(draft);
    clearActiveWorkout("alice");
    expect(readActiveWorkout("alice")).toBeNull();
    localStorage.setItem("autopilot:active-session:v1:alice", JSON.stringify({ ...draft, logs: { Remo: "bad" } }));
    expect(readActiveWorkout("alice")).toBeNull();
  });
});