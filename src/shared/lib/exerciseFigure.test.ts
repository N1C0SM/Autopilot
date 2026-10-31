import { describe, expect, it } from "vitest";
import { exerciseFigure, figureProgress, poseAt, resolveFigureKind } from "./exerciseFigure";

describe("exerciseFigure", () => {
  it("reconoce el gesto por el nombre antes que por el patrón", () => {
    expect(resolveFigureKind("Scapular Pull-up", "Tirón")).toBe("pullup");
    expect(resolveFigureKind("Remo con barra", "Tirón")).toBe("row");
    expect(resolveFigureKind("Press banca", "Empuje")).toBe("bench");
    expect(resolveFigureKind("Peso muerto rumano", null)).toBe("hinge");
    expect(resolveFigureKind("Ejercicio raro", "Core")).toBe("plank");
  });

  it("la dominada escapular hace recorrido parcial", () => {
    const spec = exerciseFigure({ name: "Scapular Pull-up", pattern: "Tirón" });
    expect(spec.amplitude).toBe(0.35);
    const top = poseAt(spec, 1);
    expect(top.neck[1]).toBeCloseTo(40 - 20 * 0.35);
  });

  it("sube, aguanta arriba y vuelve al inicio en cada ciclo", () => {
    expect(figureProgress(0)).toBe(0);
    expect(figureProgress(0.35)).toBe(1);
    expect(figureProgress(0.9)).toBe(0);
    expect(figureProgress(1.35)).toBe(1);
  });
});
