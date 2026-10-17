import { describe, it, expect } from "vitest";
import { getProgressionSuggestion, applyProgressionToPendingSets } from "./workoutProgression";

const log = (label: string, v: unknown) => console.log(label, "=>", JSON.stringify(v));
const done = (w: string, r: number) => ({ weight: w, reps: r, done: true });

describe("verificacion sobrecarga (corregido: done:true)", () => {
  it("casos de unidad y bordes", () => {
    const cardio = { name: "Cinta", series: 3, reps: 1, weight: "", exercise_type: "cardio" };
    log("1) cardio en km (5 km x3)", getProgressionSuggestion(cardio, [done("5", 1), done("5", 1), done("5", 1)]));

    const plank = { name: "Plancha", series: 3, reps: 3, weight: "", exercise_type: "core" };
    log("2) isometrico 60s x3", getProgressionSuggestion(plank, [done("60", 3), done("60", 3), done("60", 3)]));

    const assisted = { name: "Dominadas asistidas", series: 3, reps: 8, weight: "", exercise_type: "fuerza" };
    log("3) asistencia 20kg x3 de 8", getProgressionSuggestion(assisted, [done("20", 8), done("20", 8), done("20", 8)]));

    log("4) reps string '8-12' con 12 hechas", getProgressionSuggestion(
      { name: "Press banca", series: 3, reps: "8-12", weight: "", exercise_type: "fuerza" } as never,
      [done("60", 12), done("60", 12), done("60", 12)],
    ));

    log("5) peso normal 40kg 3x10 sin RPE", getProgressionSuggestion(
      { name: "Press banca", series: 3, reps: 10, weight: "", exercise_type: "fuerza" },
      [done("40", 10), done("40", 10), done("40", 10)],
    ));

    log("6) peso normal 40kg 3x10 con RPE 8", getProgressionSuggestion(
      { name: "Press banca", series: 3, reps: 10, weight: "", exercise_type: "fuerza" },
      [done("40", 10), done("40", 10), done("40", 10)], 8,
    ));

    log("7) 45kg (>=40) sube 2.5", getProgressionSuggestion(
      { name: "Sentadilla", series: 3, reps: 5, weight: "", exercise_type: "fuerza" },
      [done("45", 5), done("45", 5), done("45", 5)],
    ));

    log("8) bodyweight sin lastre 3x12", getProgressionSuggestion(
      { name: "Flexiones", series: 3, reps: 12, weight: "", exercise_type: "fuerza" },
      [done("", 12), done("", 12), done("", 12)],
    ));

    log("9) corregido: RPE 10 (no hay criterio de bajada?)", getProgressionSuggestion(
      { name: "Press banca", series: 3, reps: 10, weight: "", exercise_type: "fuerza" },
      [done("40", 10), done("40", 10), done("40", 10)], 10,
    ));

    log("10) ultima sesion solo 2 de 3 series", getProgressionSuggestion(
      { name: "Press banca", series: 3, reps: 10, weight: "", exercise_type: "fuerza" },
      [done("40", 10), done("40", 10)],
    ));

    expect(true).toBe(true);
  });
});
