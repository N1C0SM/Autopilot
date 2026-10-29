import { describe, expect, it } from "vitest";
import { mealMacros, splitExact, sumMacros } from "./mealMacros";

const target = { kcal: 2366, protein: 154, carbs: 280, fats: 70 };
const meals = ["Desayuno", "Almuerzo", "Merienda", "Cena"].map((name) => ({ name, description: name }));

describe("macros por comida", () => {
  it("las comidas suman exactamente el objetivo del día", () => {
    expect(sumMacros(mealMacros(meals, target))).toEqual(target);
  });

  it("respeta el reparto de la IA y sigue cuadrando aunque sus cifras no sumen bien", () => {
    const own = [
      { ...meals[0], protein: 30, carbs: 60, fats: 15 },
      { ...meals[1], protein: 50, carbs: 90, fats: 25 },
      { ...meals[2], protein: 20, carbs: 40, fats: 10 },
      { ...meals[3], protein: 45, carbs: 80, fats: 22 },
    ];
    const split = mealMacros(own, target);
    expect(sumMacros(split)).toEqual(target);
    expect(split[1].protein).toBeGreaterThan(split[2].protein);
  });

  it("sin gramos de la IA, cada comida es una parte igual", () => {
    expect(mealMacros(meals, target).map((m) => m.protein)).toEqual([39, 39, 38, 38]);
  });

  it("reparte enteros exactos", () => {
    expect(splitExact(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(splitExact(7, [0, 0])).toEqual([4, 3]);
    expect(splitExact(5, [])).toEqual([]);
  });
});
