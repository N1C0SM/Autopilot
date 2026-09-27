import { describe, expect, it } from "vitest";
import { getProgressionSuggestion } from "./workoutProgression";

const exercise = { exercise_id: "1", name: "Press banca", series: 3, reps: 8, weight: "60", rest: "90 s" };

describe("getProgressionSuggestion", () => {
  it("suggests a small increase after all target reps", () => {
    const result = getProgressionSuggestion(exercise, [
      { weight: "60", reps: 8, done: true },
      { weight: "60", reps: 9, done: true },
      { weight: "60", reps: 8, done: true },
    ]);
    expect(result).toMatchObject({ label: "Subir", weight: "62.5" });
  });

  it("keeps the previous weight when target reps were missed", () => {
    const result = getProgressionSuggestion(exercise, [
      { weight: "60", reps: 8, done: true },
      { weight: "60", reps: 6, done: true },
      { weight: "60", reps: 8, done: true },
    ]);
    expect(result).toMatchObject({ label: "Repetir", weight: "60" });
  });
});
