import { describe, expect, it } from "vitest";
import { createWorkoutSetLogs, getWorkoutSetInputError } from "./workoutSet";

describe("getWorkoutSetInputError", () => {
  it("requires a positive integer number of reps", () => {
    expect(getWorkoutSetInputError({ reps: 0, weight: "20" })).toContain("repetición");
    expect(getWorkoutSetInputError({ reps: 8.5, weight: "20" })).toContain("repetición");
    expect(getWorkoutSetInputError({ reps: 8, weight: "20" })).toBeNull();
  });

  describe("createWorkoutSetLogs", () => {
    it("prefills only completed sets from the previous session and leaves them unchecked", () => {
      expect(createWorkoutSetLogs(
        [{ name: "Press banca", series: 3, reps: 8, weight: "40" }],
        {
          "Press banca": [
            { weight: "50", reps: 10, done: true },
            { weight: "52.5", reps: 8, done: true },
            { weight: "55", reps: 6, done: false },
          ],
        },
      )).toEqual({
        "Press banca": [
          { weight: "50", reps: 10, done: false },
          { weight: "52.5", reps: 8, done: false },
          { weight: "40", reps: 8, done: false },
        ],
      });
    });

    it("keeps bodyweight sets empty while reusing previous reps", () => {
      expect(createWorkoutSetLogs(
        [{ name: "Dominadas", series: 1, reps: 8 }],
        { Dominadas: [{ weight: "", reps: 9, done: true }] },
      )).toEqual({ Dominadas: [{ weight: "", reps: 9, done: false }] });
    });
  });

  it("accepts bodyweight, zero load, and decimal-comma loads but rejects malformed weight", () => {
    expect(getWorkoutSetInputError({ reps: 8, weight: "" })).toBeNull();
    expect(getWorkoutSetInputError({ reps: 8, weight: "0" })).toBeNull();
    expect(getWorkoutSetInputError({ reps: 8, weight: "12,5" })).toBeNull();
    expect(getWorkoutSetInputError({ reps: 8, weight: "12kg" })).toContain("carga");
    expect(getWorkoutSetInputError({ reps: 8, weight: "-5" })).toContain("carga");
  });
});
