import { describe, expect, it } from "vitest";
import { buildScanPlanUpdates, hasScanInferences } from "./scanApply";

describe("scan plan updates (solo se aplica lo que el usuario aprueba)", () => {
  it("no propone ningún cambio cuando el scan no inferió nada", () => {
    expect(buildScanPlanUpdates({})).toEqual({});
    expect(hasScanInferences({})).toBe(false);
    expect(hasScanInferences({ inferred_specific_goals: [] })).toBe(false);
  });

  it("traduce el enfoque inferido a equipo de entrenamiento", () => {
    expect(buildScanPlanUpdates({ inferred_focus: "gimnasio" })).toEqual({
      primary_focus: "gimnasio",
      equipment_type: "Gimnasio",
    });
    expect(buildScanPlanUpdates({ inferred_focus: "calistenia" })).toEqual({
      primary_focus: "calistenia",
      equipment_type: "Calistenia",
    });
    expect(buildScanPlanUpdates({ inferred_focus: "ambos" })).toEqual({
      primary_focus: "ambos",
      equipment_type: "Mixto",
    });
  });

  it("guarda el objetivo y las metas específicas tal como las vio el usuario", () => {
    expect(
      buildScanPlanUpdates({
        inferred_goal: "lose_fat",
        inferred_intensity: 3,
        inferred_specific_goals: ["ganar fuerza", "marcar abdomen"],
      })
    ).toEqual({
      goal: "lose_fat",
      intensity_level: 3,
      specific_goal: "ganar fuerza, marcar abdomen",
    });
  });

  it("ignora una intensidad que no sea un número", () => {
    expect(buildScanPlanUpdates({ inferred_goal: "gain_muscle", inferred_intensity: undefined })).toEqual({
      goal: "gain_muscle",
    });
  });
});
