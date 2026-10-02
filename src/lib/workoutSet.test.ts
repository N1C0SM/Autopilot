import { describe, expect, it } from "vitest";
import { getWorkoutSetInputError } from "./workoutSet";

describe("getWorkoutSetInputError", () => {
  it("requires a positive integer number of reps", () => {
    expect(getWorkoutSetInputError({ reps: 0, weight: "20" })).toContain("repetición");
    expect(getWorkoutSetInputError({ reps: 8.5, weight: "20" })).toContain("repetición");
    expect(getWorkoutSetInputError({ reps: 8, weight: "20" })).toBeNull();
  });

  it("accepts bodyweight, zero load, and decimal-comma loads but rejects malformed weight", () => {
    expect(getWorkoutSetInputError({ reps: 8, weight: "" })).toBeNull();
    expect(getWorkoutSetInputError({ reps: 8, weight: "0" })).toBeNull();
    expect(getWorkoutSetInputError({ reps: 8, weight: "12,5" })).toBeNull();
    expect(getWorkoutSetInputError({ reps: 8, weight: "12kg" })).toContain("carga");
    expect(getWorkoutSetInputError({ reps: 8, weight: "-5" })).toContain("carga");
  });
});
