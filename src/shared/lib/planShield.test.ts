import { describe, expect, it, vi } from "vitest";
import { generatePlanGuarded, isManualPlan, markManual, registerShield } from "@/shared/lib/planShield";

const day = { day: "Lunes", type: "gimnasio" as const, exercises: [] };

describe("escudo de rutina manual", () => {
  it("una rutina guardada desde el editor queda marcada como manual", () => {
    expect(isManualPlan(markManual([day]))).toBe(true);
    expect(isManualPlan([day])).toBe(false);
  });

  it("si el usuario conserva su rutina, no se vuelve a llamar con force", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { protected: true }, error: null });
    registerShield((resolve) => resolve("keep"));
    const res = await generatePlanGuarded({ functions: { invoke } }, { user_id: "u1" });
    expect(res.kept).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("si decide sustituirla, se regenera con force", async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ data: { protected: true }, error: null })
      .mockResolvedValueOnce({ data: { success: true }, error: null });
    registerShield((resolve) => resolve("replace"));
    await generatePlanGuarded({ functions: { invoke } }, { user_id: "u1" });
    expect(invoke).toHaveBeenLastCalledWith("generate-plan", { body: { user_id: "u1", force: true } });
  });
});
