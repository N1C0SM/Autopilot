import { beforeEach, describe, expect, it } from "vitest";
import { formatRestLabel, getExerciseRestChoices, setExerciseRestChoice } from "@/shared/lib/workoutPreferences";

describe("descanso por ejercicio", () => {
  beforeEach(() => localStorage.clear());

  it("formatea como la app", () => {
    expect([45, 60, 90, 120, 135].map(formatRestLabel)).toEqual(["45 s", "1 min", "1:30", "2 min", "2:15"]);
  });

  it("se guarda por usuario, se limita a 15–600 s y se puede quitar", () => {
    expect(setExerciseRestChoice("u1", "Press banca", 90)).toEqual({ "Press banca": 90 });
    expect(setExerciseRestChoice("u1", "Remo", 5)).toEqual({ "Press banca": 90, Remo: 15 });
    expect(getExerciseRestChoices("u2")).toEqual({});
    expect(setExerciseRestChoice("u1", "Press banca", null)).toEqual({ Remo: 15 });
    expect(getExerciseRestChoices("u1")).toEqual({ Remo: 15 });
  });

  it("ignora datos dañados", () => {
    localStorage.setItem("autopilot:workout-rest-exercise:u1", "no-json");
    expect(getExerciseRestChoices("u1")).toEqual({});
    localStorage.setItem("autopilot:workout-rest-exercise:u1", JSON.stringify({ A: "90", B: 9000, C: 60 }));
    expect(getExerciseRestChoices("u1")).toEqual({ C: 60 });
  });
});
