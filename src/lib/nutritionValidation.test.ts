import { describe, expect, it } from "vitest";
import { nutritionMacroError } from "./nutritionValidation";

describe("nutrition input review", () => {
  it("allows missing targets without fabricating values", () => {
    expect(nutritionMacroError({})).toBeNull();
    expect(nutritionMacroError({ protein: "", carbs: "", fats: "" })).toBeNull();
  });
  it("rejects the observed 500g fat outlier without mutating it", () => {
    const stored = { protein: 50, carbs: 100, fats: 500 };
    expect(nutritionMacroError(stored)).toContain("grasas");
    expect(stored.fats).toBe(500);
  });
  it("accepts complete reasonable numeric inputs and rejects partial/invalid inputs", () => {
    expect(nutritionMacroError({ protein: "140", carbs: 220, fats: 65, calories: 2025 })).toBeNull();
    for (const fats of [0, -2, 181, "abc", Infinity]) {
      expect(nutritionMacroError({ protein: 140, carbs: 220, fats })).not.toBeNull();
    }
    expect(nutritionMacroError({ protein: 140 })).not.toBeNull();
  });
  it("flags contradictory explicit calories", () => {
    expect(nutritionMacroError({ protein: 140, carbs: 220, fats: 65, calories: 5000 })).toContain("no coinciden");
  });
  it("rejects coerced types and string formats that the database rejects", () => {
    const valid = { protein: 140, carbs: 220, fats: 65 };
    for (const protein of [true, [140], { valueOf: () => 140 }, " 140 ", "1.4e2", "+140", "0x8c"]) {
      expect(nutritionMacroError({ ...valid, protein })).not.toBeNull();
    }
    for (const calories of [true, [2025], { valueOf: () => 2025 }, " 2025 ", "2.025e3"]) {
      expect(nutritionMacroError({ ...valid, calories })).not.toBeNull();
    }
    expect(nutritionMacroError({ protein: "140.5", carbs: "220", fats: "65", calories: "2027" })).toBeNull();
  });
});
