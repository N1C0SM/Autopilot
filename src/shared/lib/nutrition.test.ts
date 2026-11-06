import { describe, expect, it } from "vitest";
import { parseBodyWeight, parseMacroTargets, resolveNutritionPreview } from "@/shared/lib/nutrition";

describe("nutrition inputs", () => {
  it.each([null, undefined, "", 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not treat %s as a body weight",
    (value) => {
      expect(parseBodyWeight(value)).toBeNull();
    },
  );

  it("accepts a real weight stored as a number or numeric string", () => {
    expect(parseBodyWeight(72.5)).toBe(72.5);
    expect(parseBodyWeight("72.5")).toBe(72.5);
  });

  it("parses complete macro targets and ignores unusable values", () => {
    expect(parseMacroTargets({ protein: 140, carbs: "220", fats: 65, calories: 2025 })).toEqual({
      protein: 140,
      carbs: 220,
      fats: 65,
      calories: 2025,
    });
    expect(parseMacroTargets({})).toBeNull();
    expect(parseMacroTargets({ protein: 0, carbs: 220, fats: 65 })).toBeNull();
    expect(parseMacroTargets(null)).toBeNull();
  });

  it("does not fabricate nutrition numbers without a valid body weight", () => {
    expect(resolveNutritionPreview({ weight: null, goal: "gain_muscle" })).toEqual({
      calories: null,
      protein: null,
      carbs: null,
      fats: null,
      hasWeight: false,
    });
    expect(resolveNutritionPreview({ weight: 72, goal: "gain_muscle" })).toEqual({
      calories: 2604,
      protein: 144,
      carbs: 345,
      fats: 72,
      hasWeight: true,
    });
  });

  it("estimates carbs and fats without a saved plan, like the iPhone (MacroEstimate)", () => {
    // Misma cuenta que en el iPhone: 70 kg, hombre, ganar músculo → 2540 kcal, 140 g P, 335 g C, 71 g G.
    expect(resolveNutritionPreview({ weight: 70, sex: "male", goal: "gain_muscle" })).toEqual({
      calories: 2540, protein: 140, carbs: 335, fats: 71, hasWeight: true,
    });
  });
});

import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("saved plan macros", () => {
  i2("uses saved macros so Nutrición matches the plan", () => {
    e2(resolveNutritionPreview({ weight: 70, goal: "gain_muscle" }, { protein: 140, carbs: 200, fats: 60 }))
      .toEqual({ calories: 1900, protein: 140, carbs: 200, fats: 60, hasWeight: true });
  });
});
