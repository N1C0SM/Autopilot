import { describe, expect, it } from "vitest";
import type { DayPlan } from "@/shared/types/training";
import { countLabel, estimateMinutes, sessionLine, sessionMuscles, sessionName } from "@/shared/lib/sessionSummary";

const ex = (name: string, series: number, rest: string, muscle_group?: string) => ({ exercise_id: name, name, series, reps: 10, weight: "", rest, muscle_group });
const gym = (exercises: ReturnType<typeof ex>[], extra: Partial<DayPlan> = {}): DayPlan => ({ day: "Lunes", type: "gimnasio", routine_name: "Full Body A", exercises, ...extra });

describe("resumen de una sesión (Hoy y Entrenar)", () => {
  it("cuenta en singular o plural con un espacio que no se parte", () => {
    expect(countLabel(1, "ejercicio", "ejercicios")).toBe("1\u00a0ejercicio");
    expect(countLabel(7, "ejercicio", "ejercicios")).toBe("7\u00a0ejercicios");
  });

  it("estima la duración: 45 s por serie más su descanso, redondeada a 5 min", () => {
    expect(estimateMinutes(gym([ex("Press", 3, "90 s"), ex("Remo", 3, "90 s")]))).toBe(15);
    expect(estimateMinutes(gym([ex("Press", 4, "2 min")]))).toBe(10);
    expect(estimateMinutes(gym([ex("Plancha", 1, "")]))).toBe(5);
    expect(estimateMinutes(gym([]))).toBeNull();
  });

  it("la línea de Entrenar: «N ejercicios · ≈ min», la invitación sin ejercicios y la actividad", () => {
    expect(sessionLine(gym([ex("Press", 3, "90 s"), ex("Remo", 3, "90 s")]))).toBe("2\u00a0ejercicios · ≈\u00a015\u00a0min");
    expect(sessionLine(gym([]))).toBe("Añade sus ejercicios");
    expect(sessionLine({ day: "Sábado", type: "actividad", sport: "Running", intensity: "Media", duration: "45 min" })).toBe("Intensidad media · 45 min");
    expect(sessionLine({ day: "Sábado", type: "actividad", sport: "Yoga" })).toBe("Actividad");
  });

  it("músculos: los del título tras el «·» o, sin foco, los de sus ejercicios sin repetir", () => {
    expect(sessionMuscles(gym([ex("Press", 3, "90 s")], { muscle_focus: "Pecho, espalda y piernas" }))).toBe("Pecho, espalda y piernas");
    expect(sessionMuscles(gym([ex("Press", 3, "90 s", "Pecho"), ex("Remo", 3, "90 s", "Espalda"), ex("Aperturas", 3, "60 s", "Pecho")]))).toBe("Pecho y espalda");
    expect(sessionMuscles(gym([ex("Press", 3, "90 s")]), () => "Pecho")).toBe("Pecho");
    expect(sessionMuscles({ day: "Sábado", type: "actividad", sport: "Running" })).toBe("");
    expect(sessionName("Full Body A · Pecho y espalda")).toBe("Full Body A");
  });
});
