import { describe, expect, it } from "vitest";
import { calcNutritionMacros, detectDiet } from "@/shared/lib/nutritionMacros";

describe("dietas del onboarding", () => {
  it("prioriza las preferencias nutricionales", () => {
    expect(detectDiet("Quiero una dieta keto", "alergia a la lactosa")).toBe("keto");
    expect(detectDiet("Vegana estricta")).toBe("vegana");
    expect(detectDiet("Ovolactovegetariana")).toBe("vegetariana");
    expect(detectDiet("Estilo mediterráneo")).toBe("mediterranea");
    expect(detectDiet("Paleo sin procesados")).toBe("paleo");
  });

  it("cae en las alergias cuando no hay preferencias de dieta", () => {
    expect(detectDiet("", "Celíaca: sin gluten")).toBe("sin_gluten");
    expect(detectDiet(null, "Intolerancia a la lactosa")).toBe("sin_lactosa");
    expect(detectDiet("", "")).toBe("estandar");
    expect(detectDiet(null, null)).toBe("estandar");
  });

  it("no confunde vegana con vegetariana", () => {
    expect(detectDiet("Vegetariano")).toBe("vegetariana");
    expect(detectDiet("Vegano")).toBe("vegana");
  });
});

describe("cálculo de macros con dieta", () => {
  it("aplica los gramos por kilo del objetivo", () => {
    // 80 kg · ganar músculo = 2,2 P / 4 C / 1 G por kilo.
    expect(calcNutritionMacros(80, "gain_muscle")).toEqual({
      protein: 176,
      carbs: 320,
      fats: 80,
      calories: 2704,
    });
  });

  it("mantiene las calorías cuadradas con los macros redondeados", () => {
    const macros = calcNutritionMacros(73.4, "lose_weight", "paleo");
    expect(macros).not.toBeNull();
    expect(macros!.calories).toBe(
      macros!.protein * 4 + macros!.carbs * 4 + macros!.fats * 9,
    );
  });

  it("recorta los carbohidratos en keto y sube la grasa", () => {
    // keto + perder peso: 0,5 C/kg y grasa mínima de 1,8 G/kg.
    expect(calcNutritionMacros(80, "lose_weight", "keto")).toEqual({
      protein: 192,
      carbs: 40,
      fats: 144,
      calories: 2224,
    });
  });

  it("ajusta paleo, vegana y mediterránea como generate-plan", () => {
    expect(calcNutritionMacros(80, "lose_weight", "paleo")).toEqual({
      protein: 192,
      carbs: 112,
      fats: 83,
      calories: 192 * 4 + 112 * 4 + 83 * 9,
    }); // c·0,7 y g·1,3
    expect(calcNutritionMacros(80, "gain_muscle", "vegana")).toEqual({
      protein: 194,
      carbs: 352,
      fats: 80,
      calories: 194 * 4 + 352 * 4 + 80 * 9,
    }); // p·1,1 y c·1,1
    expect(calcNutritionMacros(80, "recomp", "mediterranea")).toEqual({
      protein: 176,
      carbs: 240,
      fats: 83,
      calories: 176 * 4 + 240 * 4 + 83 * 9,
    }); // g·1,15
  });

  it("usa el objetivo por defecto y no inventa macros sin peso", () => {
    expect(calcNutritionMacros(80, "general_health")).toEqual({
      protein: 144,
      carbs: 280,
      fats: 80,
      calories: 144 * 4 + 280 * 4 + 80 * 9,
    });
    expect(calcNutritionMacros(0, "gain_muscle")).toBeNull();
    expect(calcNutritionMacros(Number.NaN, "gain_muscle")).toBeNull();
    expect(calcNutritionMacros(Number.POSITIVE_INFINITY, "gain_muscle")).toBeNull();
  });
});

describe("ajuste del protocolo del scan", () => {
  it("sin ajuste, el resultado es exactamente el mismo de siempre", () => {
    expect(calcNutritionMacros(80, "gain_muscle", "estandar", null))
      .toEqual(calcNutritionMacros(80, "gain_muscle"));
  });

  it("usa la proteína por kilo del scan", () => {
    expect(calcNutritionMacros(80, "gain_muscle", "estandar", { proteinPerKg: 2 })).toEqual({
      protein: 160,
      carbs: 320,
      fats: 80,
      calories: 160 * 4 + 320 * 4 + 80 * 9,
    });
  });

  it("reparte el déficit calórico entre carbohidratos y grasas sin tocar la proteína", () => {
    // 80 kg · ganar músculo = 2000 kcal flexibles (320 C · 4 + 80 G · 9).
    // −500 kcal = escala 0,75 → 240 C y 60 G; la proteína sigue en 176 g.
    expect(calcNutritionMacros(80, "gain_muscle", "estandar", { calorieAdjustmentKcal: -500 })).toEqual({
      protein: 176,
      carbs: 240,
      fats: 60,
      calories: 176 * 4 + 240 * 4 + 60 * 9,
    });
  });

  it("combina proteína y calorías, y respeta los límites del producto", () => {
    expect(calcNutritionMacros(80, "gain_muscle", "estandar", { proteinPerKg: 2.4, calorieAdjustmentKcal: -500 }))
      .toMatchObject({ protein: 192, carbs: 240, fats: 60 });
    // Fuera de rango: proteína 1–3 g/kg y ajuste ±1000 kcal; la escala no baja de 0,55.
    expect(calcNutritionMacros(80, "gain_muscle", "estandar", { proteinPerKg: 9, calorieAdjustmentKcal: -5000 }))
      .toMatchObject({ protein: 240, carbs: 176, fats: 44 });
    // Los mismos topes que valida el editor (350 P / 700 C / 180 G).
    expect(calcNutritionMacros(200, "gain_muscle")).toMatchObject({ protein: 350, carbs: 700, fats: 180 });
  });

  it("mantiene la dieta: un déficit en keto sigue siendo keto", () => {
    const keto = calcNutritionMacros(80, "lose_weight", "keto");
    const adjusted = calcNutritionMacros(80, "lose_weight", "keto", { calorieAdjustmentKcal: -300 });
    expect(keto).not.toBeNull();
    expect(adjusted).not.toBeNull();
    expect(adjusted!.protein).toBe(keto!.protein);
    expect(adjusted!.carbs).toBeLessThan(keto!.carbs);
    expect(adjusted!.fats).toBeLessThan(keto!.fats);
    // La proporción carbohidratos/grasas se conserva.
    expect(adjusted!.carbs / adjusted!.fats).toBeCloseTo(keto!.carbs / keto!.fats, 1);
  });
});
