import { describe, expect, it } from "vitest";
import {
  copyPreviousIntoSet,
  createWorkoutSetLogs,
  getWorkoutSetInputError,
  getWorkoutSetRpe,
  isWorkoutSetFailure,
  reindexLiveRecords,
  setWorkoutSetFailure,
  setWorkoutSetRpe,
} from "@/shared/lib/workoutSet";

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

describe("RPE y fallo por serie", () => {
  it("solo escribe los campos cuando tienen valor válido", () => {
    const base = { reps: 8, weight: "40", done: false };
    expect(setWorkoutSetRpe(base, 8)).toEqual({ ...base, rpe: 8 });
    expect(setWorkoutSetRpe({ ...base, rpe: 8 }, null)).toEqual(base);
    expect(setWorkoutSetRpe(base, 11)).toEqual(base);
    expect(getWorkoutSetRpe({ rpe: 7.5 })).toBeNull();
    expect(setWorkoutSetFailure(base, true)).toEqual({ ...base, failure: true });
    expect(setWorkoutSetFailure({ ...base, failure: true }, false)).toEqual(base);
    expect(isWorkoutSetFailure({ failure: "true" })).toBe(false);
  });
});

describe("copyPreviousIntoSet", () => {
  it("copia kg y reps de una serie previa hecha y nunca toca una serie ya hecha", () => {
    const set = { reps: 10, weight: "", done: false };
    expect(copyPreviousIntoSet(set, { reps: 8, weight: "52,5", done: true })).toEqual({ reps: 8, weight: "52,5", done: false });
    expect(copyPreviousIntoSet(set, { reps: 8, weight: "52,5", done: false })).toBe(set);
    const done = { ...set, done: true };
    expect(copyPreviousIntoSet(done, { reps: 8, weight: "52,5", done: true })).toBe(done);
  });
});

describe("reindexLiveRecords", () => {
  it("quita el récord de la serie borrada y sube los de detrás", () => {
    expect(reindexLiveRecords({ "Press#0": "+1 kg", "Press#1": "+2 kg", "Press#2": "+3 kg", "Remo#1": "+5 kg" }, "Press", 1))
      .toEqual({ "Press#0": "+1 kg", "Press#1": "+3 kg", "Remo#1": "+5 kg" });
  });
});
