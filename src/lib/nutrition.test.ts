import { describe, expect, it } from "vitest";
import { parseBodyWeight, parseMacroTargets } from "./nutrition";

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
});
