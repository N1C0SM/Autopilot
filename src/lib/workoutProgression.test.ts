import { describe, expect, it } from "vitest";
import { applyProgressionToPendingSets, getProgressionSuggestion } from "./workoutProgression";

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

  describe("applyProgressionToPendingSets", () => {
    it("applies the suggested load only to unfinished sets", () => {
      const sets = [
        { weight: "62.5", reps: 8, done: false },
        { weight: "60", reps: 8, done: true },
        { weight: "60", reps: 8, done: false },
      ];

      expect(applyProgressionToPendingSets(sets, {
        label: "Subir",
        weight: "62.5",
        reason: "Sugerencia",
      })).toEqual([
        { weight: "62.5", reps: 8, done: false },
        { weight: "60", reps: 8, done: true },
        { weight: "62.5", reps: 8, done: false },
      ]);
    });

    it("adds one rep only to unfinished bodyweight sets", () => {
      const sets = [
        { weight: "", reps: 9, done: false },
        { weight: "", reps: 8, done: true },
      ];

      expect(applyProgressionToPendingSets(sets, {
        label: "Añadir rep",
        weight: "",
        reason: "Sugerencia",
      })).toEqual([
        { weight: "", reps: 10, done: false },
        { weight: "", reps: 8, done: true },
      ]);
    });
  });

  it("keeps the previous weight when target reps were missed", () => {
    const result = getProgressionSuggestion(exercise, [
      { weight: "60", reps: 8, done: true },
      { weight: "60", reps: 6, done: true },
      { weight: "60", reps: 8, done: true },
    ]);
    expect(result).toMatchObject({ label: "Repetir", weight: "60" });
  });

  it("does not increase the load when the last session has fewer than the prescribed sets", () => {
    const result = getProgressionSuggestion(exercise, [
      { weight: "60", reps: 10, done: true },
      { weight: "60", reps: 10, done: true },
    ]);

    expect(result).toMatchObject({ label: "Repetir", weight: "60" });
  });

  it("parses decimal-comma weights without truncating the suggested load", () => {
    const result = getProgressionSuggestion(exercise, [
      { weight: "60,5", reps: 8, done: true },
      { weight: "60,5", reps: 8, done: true },
      { weight: "60,5", reps: 8, done: true },
    ]);

    expect(result).toMatchObject({ label: "Subir", weight: "63" });
  });

  it("ignores invalid weights instead of suggesting an unsafe load", () => {
    const result = getProgressionSuggestion(exercise, [
      { weight: "60kg", reps: 10, done: true },
      { weight: "60", reps: 8, done: true },
      { weight: "60", reps: 8, done: true },
    ]);

    expect(result).toMatchObject({ label: "Repetir", weight: "60" });
  });

  it("adds one rep per set for bodyweight exercises after meeting the target", () => {
    const result = getProgressionSuggestion(
      { ...exercise, weight: "" },
      [
        { weight: "", reps: 8, done: true },
        { weight: "", reps: 9, done: true },
        { weight: "", reps: 8, done: true },
      ],
    );

    expect(result).toMatchObject({ label: "Añadir rep", weight: "" });
  });

  it("does not increase load after a very hard session", () => {
    const result = getProgressionSuggestion(exercise, [
      { weight: "60", reps: 8, done: true },
      { weight: "60", reps: 9, done: true },
      { weight: "60", reps: 8, done: true },
    ], 9);

    expect(result).toMatchObject({ label: "Mantener", weight: "60" });
  });

  it("holds progression until the working sets use a consistent load", () => {
    const result = getProgressionSuggestion(exercise, [
      { weight: "55", reps: 10, done: true },
      { weight: "60", reps: 10, done: true },
      { weight: "60", reps: 10, done: true },
    ]);

    expect(result).toMatchObject({ label: "Mantener", weight: "60" });
  });
});
