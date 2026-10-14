import { describe, expect, it } from "vitest";
import { getExerciseGuide } from "./exerciseGuide";

const firstStep = (input: Parameters<typeof getExerciseGuide>[0]) => getExerciseGuide(input).steps[0];

describe("getExerciseGuide", () => {
  it("matches common exercises by name, accents and case aside", () => {
    expect(firstStep({ name: "Press banca pesado >85% 1RM" })).toMatch(/ojos bajo la barra/);
    expect(getExerciseGuide({ name: "Press banca pesado >85% 1RM" }).safety).toBeTruthy();
    expect(firstStep({ name: "Dominada con lastre 25kg+" })).toMatch(/Cuelga de la barra/);
    expect(firstStep({ name: "Sentadilla goblet" })).toMatch(/pegada al pecho/);
    expect(firstStep({ name: "Remo Yates" })).toMatch(/Inclina el torso/);
    expect(firstStep({ name: "Abdominales declinados con peso" })).toMatch(/banco declinado/);
    expect(firstStep({ name: "Hip Thrust con barra" })).toMatch(/parte alta de la espalda/);
    expect(firstStep({ name: "Advanced Tuck Back Lever" })).toMatch(/Calienta muñecas/);
  });

  it("prefers the specific rule over the general one", () => {
    expect(firstStep({ name: "Curl femoral tumbado" })).toMatch(/talones|rodilla alineada/);
    expect(firstStep({ name: "Jalón de tríceps en polea" })).toMatch(/codos/i);
    expect(firstStep({ name: "Jalón de tríceps en polea" })).not.toMatch(/rodillo/);
    expect(firstStep({ name: "Plancha abdominal" })).toMatch(/Antebrazos en el suelo/);
    expect(firstStep({ name: "Plancha tuck" })).toMatch(/Calienta muñecas/);
    expect(firstStep({ name: "Peso muerto rumano" })).toMatch(/rodillas ligeramente/);
  });

  it("falls back to the movement pattern, then the muscle group, then general advice", () => {
    expect(firstStep({ name: "Ejercicio raro", movementPattern: "Tirón" })).toMatch(/escápulas/);
    expect(firstStep({ name: "Ejercicio raro", muscleGroup: "Glúteos" })).toMatch(/espalda neutra/);
    const generic = getExerciseGuide({ name: "Ejercicio raro" });
    expect(generic.steps.length).toBeGreaterThan(0);
    expect(generic.cues.length).toBeGreaterThan(0);
  });
});
