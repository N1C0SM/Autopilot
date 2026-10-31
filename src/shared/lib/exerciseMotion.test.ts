import { describe, expect, it } from "vitest";
import { MOTION_FLOOR, exerciseMotion, motionKeyTimes } from "./exerciseMotion";

const numbers = (d: string): number[] => d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];

describe("huella de movimiento", () => {
  it("sin patrón no hay huella: la pantalla pinta la foto", () => {
    expect(exerciseMotion({ name: "Algo suelto" })).toBeNull();
    expect(exerciseMotion({ name: "Algo suelto", pattern: "Lo que sea" })).toBeNull();
  });

  it("cada patrón dibuja su propia trayectoria", () => {
    const paths = ["Empuje", "Tirón", "Sentadilla", "Bisagra", "Core"].map(
      (pattern) => exerciseMotion({ name: "Prueba", pattern })?.d,
    );
    expect(paths).toHaveLength(5);
    expect(new Set(paths).size).toBe(5);
  });

  it("es determinista: el mismo ejercicio dibuja siempre lo mismo", () => {
    const a = exerciseMotion({ name: "Sentadilla búlgara", pattern: "Sentadilla", stimulus: "Hipertrofia" });
    const b = exerciseMotion({ name: "Sentadilla búlgara", pattern: "Sentadilla", stimulus: "Hipertrofia" });
    expect(a?.d).toBe(b?.d);
    expect(a?.duration).toBe(b?.duration);
  });

  it("el ritmo sale del estímulo: fuerza es más lenta que resistencia", () => {
    const fuerza = exerciseMotion({ name: "Press banca", pattern: "Empuje", stimulus: "Fuerza" });
    const resistencia = exerciseMotion({ name: "Press banca", pattern: "Empuje", stimulus: "Resistencia" });
    expect(fuerza?.duration).toBeCloseTo(4.65, 2);
    expect(resistencia?.duration).toBeCloseTo(1.32, 2);
    expect(fuerza!.duration).toBeGreaterThan(resistencia!.duration);
    expect(resistencia?.reps).toBe(6);
  });

  it("el isométrico viaja una vez y aguanta", () => {
    const iso = exerciseMotion({ name: "Plancha", pattern: "Core", stimulus: "Isométrico" });
    expect(iso?.hold).toBe(true);
    expect(motionKeyTimes(iso!)).toEqual({ keyPoints: "0;1;1", keyTimes: "0;0.28;1" });
  });

  it("el bucle normal sube rápido, baja despacio y descansa", () => {
    const spec = exerciseMotion({ name: "Dominadas", pattern: "Tirón", stimulus: "Hipertrofia" })!;
    const { keyPoints, keyTimes } = motionKeyTimes(spec);
    expect(keyPoints).toBe("0;1;0;0");
    const times = keyTimes.split(";").map(Number);
    expect(times).toHaveLength(4);
    expect(times[0]).toBe(0);
    expect(times[3]).toBe(1);
    expect(times[1]).toBeLessThan(times[2]);
    // la excéntrica (bajada) dura más que la concéntrica (subida)
    expect(times[2] - times[1]).toBeGreaterThan(times[1] - times[0]);
  });

  it("la carga manda en el grosor y en la apertura", () => {
    const alta = exerciseMotion({ name: "Peso muerto", pattern: "Bisagra", stimulus: "Fuerza", load: "Alta" })!;
    const baja = exerciseMotion({ name: "Peso muerto", pattern: "Bisagra", stimulus: "Fuerza", load: "Baja" })!;
    expect(alta.stroke).toBeGreaterThan(baja.stroke);
    expect(Math.abs(alta.end.x - 50)).toBeGreaterThan(Math.abs(baja.end.x - 50));
  });

  it("la trayectoria cabe en el lienzo", () => {
    for (const pattern of ["Empuje", "Tirón", "Sentadilla", "Bisagra", "Core"]) {
      for (const load of ["Alta", "Media", "Baja"]) {
        const spec = exerciseMotion({ name: `Prueba ${pattern} ${load}`, pattern, load })!;
        const nums = numbers(spec.d);
        const xs = nums.filter((_, i) => i % 2 === 0);
        const ys = nums.filter((_, i) => i % 2 === 1);
        expect(Math.min(...xs)).toBeGreaterThan(0);
        expect(Math.max(...xs)).toBeLessThan(100);
        expect(Math.min(...ys)).toBeGreaterThan(0);
        expect(Math.max(...ys)).toBeLessThan(MOTION_FLOOR + 6);
      }
    }
  });

  it("la huella llena el cuadro: no se encoge en un rincón", () => {
    for (const pattern of ["Empuje", "Tirón", "Sentadilla", "Bisagra", "Core"]) {
      const spec = exerciseMotion({ name: `Llena ${pattern}`, pattern, load: "Alta" })!;
      const nums = numbers(spec.d);
      const xs = nums.filter((_, i) => i % 2 === 0);
      const ys = nums.filter((_, i) => i % 2 === 1);
      expect(Math.max(...xs) - Math.min(...xs) + (Math.max(...ys) - Math.min(...ys))).toBeGreaterThanOrEqual(40);
    }
  });
    expect(exerciseMotion({ name: "Press banca", pattern: "Empuje", stimulus: "Fuerza" })?.label).toBe("Empuje · Fuerza");
    expect(exerciseMotion({ name: "Press banca", pattern: "Empuje" })?.label).toBe("Empuje");
  });
});
