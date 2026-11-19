import { describe, expect, it } from "vitest";
import {
  improvementList, keepTogether, meterFraction, monthsText, objectiveMonths, scanShareFocus, scanShareHeadline, scanShareStats, scoreText,
  signedKcal,
} from "./scanResultFormat";
import { scanSteps } from "./scanLoading";

describe("formato del resultado del scan (igual que ScanFormat en la app)", () => {
  it("notas con coma decimal y «—» sin dato (nunca un 0 que parezca real)", () => {
    expect(scoreText(7.44)).toBe("7,4");
    expect(scoreText(10)).toBe("10,0");
    expect(scoreText(null)).toBe("—");
    expect(scoreText(undefined)).toBe("—");
  });

  it("meses en singular y plural, kcal con signo tipográfico", () => {
    expect(monthsText(1)).toBe("1 mes");
    expect(monthsText(6)).toBe("6 meses");
    expect(signedKcal(300)).toBe("+300 kcal");
    expect(signedKcal(-1250)).toBe("−1.250 kcal");
    expect(signedKcal(0)).toBe("0 kcal");
  });

  it("meses hasta el objetivo solo con objetivo, y sin plan siempre más que con plan", () => {
    expect(objectiveMonths({})).toBeNull();
    expect(objectiveMonths({ months_with_plan: 0.2 })).toEqual({ withPlan: 1, withoutPlan: null });
    expect(objectiveMonths({ months_with_plan: 6, months_without_plan: 4 })).toEqual({ withPlan: 6, withoutPlan: 7 });
    expect(objectiveMonths({ estimated_months: 5, months_without_plan: 14 })).toEqual({ withPlan: 5, withoutPlan: 14 });
  });

  it("«Qué mejorar» no repite lo que más te frena ni filas vacías", () => {
    const list = improvementList({
      bottleneck: "Grasa abdominal",
      improvements: [{ label: "grasa abdominal", priority: "Alta" }, { label: "  ", priority: "Media" }, { label: "Espalda", priority: "" }],
    });
    expect(list).toEqual([{ label: "Espalda", priority: null }]);
  });

  it("notas con «·»: trozos cortos enteros, cifras con sus palabras y el «·» nunca al empezar línea", () => {
    expect(keepTogether("Privado: solo para tu análisis · Sin registro · Menos de 1 minuto"))
      .toBe("Privado: solo para tu análisis\u00A0· Sin\u00A0registro\u00A0· Menos\u00A0de\u00A01\u00A0minuto");
    expect(keepTogether("Tu foto no se publica y se usa solo para tu análisis de 1 minuto"))
      .toBe("Tu foto no se publica y se usa solo para tu análisis de\u00A01\u00A0minuto");
  });

  it("barras entre 0 y 1", () => {
    expect(meterFraction(12)).toBe(1);
    expect(meterFraction(-1)).toBe(0);
    expect(meterFraction(0.9, 1.8)).toBe(0.5);
  });

  it("imagen para compartir: foco con mayúscula, frase y tres cifras (con grasa si la hay)", () => {
    const r = {
      potential: 8.4, attractiveness: 7.1, style: 6.2,
      improvements: [{ label: "pantorrillas", priority: "Baja" }, { label: "espalda alta", priority: "Alta" }],
      headline_diagnosis: "  ", summary: " Buena base. ",
    };
    expect(scanShareFocus(r)).toBe("Espalda alta");
    expect(scanShareFocus({ bottleneck: "grasa abdominal" })).toBe("Grasa abdominal");
    expect(scanShareFocus({})).toBeNull();
    expect(scanShareHeadline(r)).toBe("Buena base.");
    expect(scanShareStats(r)).toEqual([["Potencial", "8,4"], ["Atractivo", "7,1"], ["Estilo", "6,2"]]);
    expect(scanShareStats({ ...r, body_composition: { body_fat_pct: 18.46 } }))
      .toEqual([["Potencial", "8,4"], ["Grasa est.", "18,5 %"], ["Atractivo", "7,1"]]);
  });
});

describe("pasos de la espera del scan (sin porcentajes inventados)", () => {
  it("con cuenta hay un paso de guardado; cada paso se marca cuando termina", () => {
    expect(scanSteps("analyzing", true).map((s) => s.state)).toEqual(["done", "active", "pending", "pending"]);
    expect(scanSteps("saving", true).map((s) => s.state)).toEqual(["done", "done", "active", "pending"]);
    expect(scanSteps("done", true).map((s) => s.state)).toEqual(["done", "done", "done", "done"]);
    expect(scanSteps("analyzing", false).map((s) => s.label)).toEqual(["Fotos preparadas", "Análisis con IA", "Tu resultado"]);
  });
});
