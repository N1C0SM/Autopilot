import { describe, expect, it } from "vitest";
import { libraryMusclesFor, parsePriorityMuscles, scanPriorityMuscles, withPriority } from "../../supabase/functions/_shared/scan-focus";

describe("scan → prioridad del plan (compartido con generate-plan)", () => {
  it("traduce cada grupo del scan a la biblioteca de ejercicios", () => {
    expect(libraryMusclesFor("Deltoides")).toEqual(["Hombros"]);
    expect(libraryMusclesFor("Deltoides posterior")).toEqual(["Espalda"]);
    expect(libraryMusclesFor("Antebrazos")).toEqual([]);
    expect(libraryMusclesFor("Espalda alta")).toEqual(["Espalda"]);
    expect(libraryMusclesFor("Dorsales")).toEqual(["Espalda"]);
    expect(libraryMusclesFor("Brazos")).toEqual(["Bíceps", "Tríceps"]);
    expect(libraryMusclesFor("Core/abdomen")).toEqual(["Core"]);
    expect(libraryMusclesFor("Cuádriceps")).toEqual(["Piernas"]);
    expect(libraryMusclesFor("Cadena posterior (glúteo+isquio)")).toEqual(["Glúteos"]);
    expect(libraryMusclesFor("Gemelos")).toEqual(["Gemelos"]);
    expect(libraryMusclesFor("Postura")).toEqual([]);
  });

  it("ignora grupos sin nota o equilibrados", () => {
    expect(scanPriorityMuscles(undefined)).toEqual([]);
    expect(scanPriorityMuscles([{ group: "Pecho", score: Number.NaN }, { group: "Deltoides", score: 7 }])).toEqual([]);
  });

  it("lo que escribe la app lo lee el generador", () => {
    const goal = withPriority("Muscle Up", ["Hombros", "Glúteos"]);
    expect(goal).toBe("Muscle Up · Prioridad: hombros, glúteos");
    expect(parsePriorityMuscles(goal)).toEqual(["Hombros", "Glúteos"]);
    expect(parsePriorityMuscles(withPriority("", ["Bíceps", "Tríceps"]))).toEqual(["Bíceps", "Tríceps"]);
    expect(parsePriorityMuscles("Muscle Up")).toEqual([]);
    // Solo cuenta el segmento que escribe la app, al final.
    expect(parsePriorityMuscles("Mi prioridad: hombros y glúteos")).toEqual([]);
    expect(withPriority("Mi prioridad: dominadas", ["Pecho"])).toBe("Mi prioridad: dominadas · Prioridad: pecho");
  });
});
