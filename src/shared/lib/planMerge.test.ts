import { describe, expect, it } from "vitest";
import type { DayPlan } from "@/shared/types/training";
import { ROUTINE_KEYS } from "@/shared/lib/routineOrder";
import {
  autopilotKeys,
  autopilotSlots,
  customDays,
  hasAutopilotSessions,
  mergePlan,
  PLAN_KEYS,
  planAutopilotRun,
} from "../../../supabase/functions/_shared/planMerge";

/** Sesión del piloto automático en una clave (como las que devuelve buildWeeklyPlan). */
const auto = (day: string, routine = `Auto ${day}`): DayPlan => ({
  day,
  type: "gimnasio",
  routine_name: routine,
  muscle_focus: "Pecho · Espalda",
  exercises: [{ exercise_id: `e-${day}`, name: `Press ${day}`, series: 3, reps: 10, weight: "40", rest: "90s" }],
});

/** Rutina del usuario, con campos que el servidor no conoce y que tampoco se pueden perder. */
const mine = (day: string, routine: string): DayPlan => ({
  day,
  type: "gimnasio",
  routine_name: routine,
  muscle_focus: "",
  session_icon: "🔥",
  cover_url: "https://example.com/portada.jpg",
  exercises: [{ exercise_id: "x1", name: "Sentadilla", series: 5, reps: "8-12" as unknown as number, weight: "62.5", rest: "75 s" }],
  custom: true,
});

/** Lo que haría generate-plan: una sesión del piloto en cada clave que le toca. */
const generateFor = (keys: number[]) => keys.map((index) => auto(PLAN_KEYS[index], `Nueva ${PLAN_KEYS[index]}`));

const json = (value: unknown) => JSON.stringify(value);

describe("generate-plan con rutinas propias (planMerge)", () => {
  it("usa las mismas claves de orden que la web", () => {
    expect([...PLAN_KEYS]).toEqual(ROUTINE_KEYS);
  });

  it("plan mezclado: tus rutinas quedan idénticas y en su clave; el piloto rehace las suyas en las claves libres", () => {
    const pierna = mine("Martes", "Pierna pesada");
    const brazos = mine("Jueves", "Brazos");
    const current = [auto("Lunes"), pierna, auto("Miércoles"), brazos, auto("Viernes")];
    const before = json([pierna, brazos]);

    // 5 días de entreno (lunes a viernes) con 2 rutinas tuyas: el piloto prepara 3.
    const run = planAutopilotRun(current, { frequency: 5, chosenDays: [0, 1, 2, 3, 4] });
    expect(run.kept).toEqual([pierna, brazos]);
    expect(run.slots).toBe(3);
    expect(run.keys).toEqual([0, 2, 4]);
    expect(run.full).toBe(false);

    const merged = mergePlan(current, generateFor(run.keys), 5);
    expect(merged.map((d) => d.day)).toEqual(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]);
    // Las tuyas, byte a byte iguales (el mismo objeto) y con su clave.
    expect(json(merged.filter((d) => d.custom))).toBe(before);
    expect(merged[1]).toBe(pierna);
    expect(merged[3]).toBe(brazos);
    // Las del piloto son las nuevas, sin la marca `custom`.
    expect(merged.filter((d) => !d.custom).map((d) => d.routine_name)).toEqual(["Nueva Lunes", "Nueva Miércoles", "Nueva Viernes"]);
    expect(merged.filter((d) => !d.custom).every((d) => !("custom" in d))).toBe(true);
  });

  it("solo con rutinas tuyas: el piloto completa los días de entreno que faltan, hasta 7", () => {
    const current = [mine("Lunes", "Empuje"), mine("Martes", "Tirón")];
    // Eligió lunes, miércoles y viernes; el lunes ya es suyo.
    const three = planAutopilotRun(current, { frequency: 3, chosenDays: [0, 2, 4] });
    expect(three.slots).toBe(1);
    expect(three.keys).toEqual([2]);
    const merged = mergePlan(current, generateFor(three.keys), 3);
    expect(merged.map((d) => d.day)).toEqual(["Lunes", "Martes", "Miércoles"]);
    expect(customDays(merged)).toEqual(current);

    // 7 días: 5 sesiones del piloto en las 5 claves libres, 7 en total y ni una más.
    const seven = planAutopilotRun(current, { frequency: 7, chosenDays: [] });
    expect(seven.slots).toBe(5);
    expect(seven.keys).toEqual([2, 3, 4, 5, 6]);
    const full = mergePlan(current, generateFor([0, 1, 2, 3, 4, 5, 6]), 7);
    expect(full).toHaveLength(7);
    expect(full.slice(0, 2)).toEqual(current);

    // Más de 7 no existe: la frecuencia se queda en 7.
    expect(autopilotSlots(12, current)).toBe(5);
  });

  it("force con rutinas tuyas: las tuyas no cambian; solo se rehacen las del piloto", () => {
    const mia = mine("Miércoles", "Full body");
    const current = [auto("Lunes", "Vieja A"), mia, auto("Viernes", "Vieja B")];
    const snapshot = json(current);
    const run = planAutopilotRun(current, { frequency: 3, chosenDays: [0, 2, 4], force: true });
    expect(run.kept).toEqual([mia]);
    expect(run.keys).toEqual([0, 4]);

    const merged = mergePlan(current, generateFor(run.keys), 3);
    expect(merged[1]).toBe(mia);
    expect(merged.map((d) => d.routine_name)).toEqual(["Nueva Lunes", "Full body", "Nueva Viernes"]);
    // Aunque el generador devolviera algo en su clave, nunca la pisa.
    expect(mergePlan(current, [auto("Miércoles", "Intruso"), ...generateFor(run.keys)], 3)[1]).toBe(mia);
    // El plan leído no se modifica.
    expect(json(current)).toBe(snapshot);
  });

  it("tus rutinas ya cubren tus días: el piloto no añade nada y lo dice", () => {
    const current = [mine("Lunes", "A"), auto("Martes"), mine("Miércoles", "B"), mine("Viernes", "C")];
    const run = planAutopilotRun(current, { frequency: 3, chosenDays: [0, 2, 4] });
    expect(run.slots).toBe(0);
    expect(run.keys).toEqual([]);
    expect(run.full).toBe(true);
    // La sesión vieja del piloto sobra (ya no cabe en tus días); las tuyas siguen todas.
    const merged = mergePlan(current, [], 3);
    expect(merged.map((d) => d.routine_name)).toEqual(["A", "B", "C"]);
    expect(merged.every((d) => d.custom === true)).toBe(true);
    // Con más rutinas que días elegidos, ninguna se pierde.
    expect(mergePlan([...current, mine("Sábado", "D")], [], 2)).toHaveLength(4);
  });

  it("una rutina guardada mientras se preparaba el plan también se queda", () => {
    const generated = generateFor([0, 1, 2]);
    const latest = [mine("Martes", "Recién guardada")];
    const merged = mergePlan(latest, generated, 3);
    expect(merged.map((d) => [d.day, d.routine_name])).toEqual([["Lunes", "Nueva Lunes"], ["Martes", "Recién guardada"], ["Miércoles", "Nueva Miércoles"]]);
  });

  it("cuenta gratis: un plan vacío o solo con tus rutinas aún necesita las sesiones del piloto", () => {
    expect(hasAutopilotSessions([])).toBe(false);
    expect(hasAutopilotSessions([mine("Lunes", "A")])).toBe(false);
    expect(hasAutopilotSessions([mine("Lunes", "A"), auto("Martes")])).toBe(true);
    expect(hasAutopilotSessions([null, { day: "Lunes" }])).toBe(false);
  });

  it("claves: primero los días elegidos libres, luego el resto libre, nunca las tuyas", () => {
    const custom = [mine("Lunes", "A"), mine("Miércoles", "B")];
    expect(autopilotKeys(custom, [0, 2, 4], 3)).toEqual([1, 3, 4]);
    expect(autopilotKeys(custom, [], 2)).toEqual([1, 3]);
    expect(autopilotKeys(custom, [4], 0)).toEqual([]);
    expect(autopilotSlots(Number.NaN, custom)).toBe(0);
  });
});
