import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generatePlanGuarded,
  isManualPlan,
  keptRoutines,
  keptRoutinesTitle,
  markManual,
  registerShield,
} from "@/shared/lib/planShield";

const day = { day: "Lunes", type: "gimnasio" as const, exercises: [] };

describe("escudo de rutinas propias", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => registerShield(null));

  it("una rutina guardada desde el editor queda marcada como manual", () => {
    expect(isManualPlan(markManual([day]))).toBe(true);
    expect(isManualPlan([day])).toBe(false);
  });

  it("llama a generate-plan una sola vez y nunca con force", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { success: true, kept_custom: 2, autopilot_days: 2 }, error: null });
    const res = await generatePlanGuarded({ functions: { invoke } }, { user_id: "u1" }, { userId: "u1" });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("generate-plan", { body: { user_id: "u1" } });
    expect(res.keptCustom).toBe(2);
    expect(res.customFull).toBe(false);
    expect(res.kept).toBeUndefined();
  });

  it("explica el escudo la primera vez en este dispositivo y después ya no", async () => {
    const shown = vi.fn();
    registerShield(shown);
    const invoke = vi.fn().mockResolvedValue({ data: { success: true, kept_custom: 1, custom_full: true }, error: null });
    await generatePlanGuarded({ functions: { invoke } }, {}, { userId: "u1" });
    await generatePlanGuarded({ functions: { invoke } }, {}, { userId: "u1" });
    expect(shown).toHaveBeenCalledTimes(1);
    expect(shown).toHaveBeenCalledWith({ count: 1, full: true });
  });

  it("sin rutinas tuyas, con error o con la rutina gratis ya hecha, no hay nada que explicar", async () => {
    const shown = vi.fn();
    registerShield(shown);
    const run = (data: unknown, error: unknown = null) =>
      generatePlanGuarded({ functions: { invoke: vi.fn().mockResolvedValue({ data, error }) } }, {}, { userId: "u1" });
    await run({ success: true, kept_custom: 0 });
    await run(null, new Error("caído"));
    await run({ success: true, existing: true, kept_custom: 3 });
    expect(shown).not.toHaveBeenCalled();
  });

  it("un servidor anterior (protected) deja el plan tal cual y no se reintenta con force", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { protected: true, current: [{ ...day, custom: true }, day] }, error: null });
    const res = await generatePlanGuarded({ functions: { invoke } }, { user_id: "u1" });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(res.kept).toBe(true);
    expect(res.keptCustom).toBe(1);
  });

  it("lee la respuesta con cuidado y dice singular y plural", () => {
    expect(keptRoutines({ kept_custom: 3, custom_full: true })).toEqual({ count: 3, full: true });
    expect(keptRoutines({ kept_custom: 0, custom_full: true })).toEqual({ count: 0, full: false });
    expect(keptRoutines({ kept_custom: "2" })).toEqual({ count: 0, full: false });
    expect(keptRoutines(null)).toEqual({ count: 0, full: false });
    expect(keptRoutinesTitle(1)).toBe("Hemos respetado tu rutina");
    expect(keptRoutinesTitle(4)).toBe("Hemos respetado tus 4 rutinas");
  });
});
