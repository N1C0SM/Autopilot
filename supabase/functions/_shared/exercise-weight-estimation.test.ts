import { describe, expect, it } from "vitest";
import { applyWeightEstimation, estimateExerciseWeight } from "./exercise-weight-estimation";

/**
 * `generate-plan` pasa `userData.weight` tal cual viene de la base de datos, y en
 * Postgres la columna es numérica: llega como `number`, no como `string`. La
 * estimación tiene que aceptar las dos formas o revienta al generar el plan.
 */
describe("estimateExerciseWeight", () => {
  it("estima con el peso del onboarding en número (no revienta)", () => {
    expect(() => estimateExerciseWeight("Sentadilla trasera con barra alta", null, { weight: 80 })).not.toThrow();
    expect(estimateExerciseWeight("Sentadilla trasera con barra alta", null, { weight: 80 })).not.toBe("");
  });

  it("estima igual con el peso en texto", () => {
    expect(estimateExerciseWeight("Sentadilla trasera con barra alta", null, { weight: "80" })).toBe(
      estimateExerciseWeight("Sentadilla trasera con barra alta", null, { weight: 80 }),
    );
  });

  it("acepta peso con coma decimal", () => {
    expect(estimateExerciseWeight("Press banca con barra", null, { weight: "82,5" })).not.toBe("");
  });

  it("no inventa peso sin datos", () => {
    expect(estimateExerciseWeight("Sentadilla trasera con barra alta", null, { weight: "" })).toBe("");
    expect(estimateExerciseWeight("Sentadilla trasera con barra alta", null, null)).toBe("");
  });

  it("prioriza la masa magra del scan", () => {
    const fromScan = estimateExerciseWeight("Peso muerto convencional", { lean_mass_kg: 70 }, { weight: 80 });
    const fromBody = estimateExerciseWeight("Peso muerto convencional", null, { weight: 80 });
    expect(Number(fromScan)).toBeGreaterThan(Number(fromBody));
  });

  it("elige el coeficiente más específico (RDL ≠ peso muerto convencional)", () => {
    const rdl = estimateExerciseWeight("Peso muerto rumano con mancuernas", null, { weight: 80 });
    const conventional = estimateExerciseWeight("Peso muerto convencional", null, { weight: 80 });
    expect(Number(rdl)).toBeLessThan(Number(conventional));
  });
});

describe("applyWeightEstimation", () => {
  it("respeta los pesos ya puestos y estima los vacíos sin romperse", () => {
    const result = applyWeightEstimation(
      [
        { name: "Sentadilla trasera con barra alta", weight: "" },
        { name: "Curl Zottman", weight: "12" },
        { name: "Advanced Tuck Back Lever", weight: "" },
      ],
      null,
      { weight: 80 },
    );
    expect(result[0].weight).not.toBe("");
    expect(result[1].weight).toBe("12");
    expect(result[2].weight).toBe("");
  });
});
