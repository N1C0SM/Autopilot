import { describe, expect, it, vi } from "vitest";
import { persistAutoMacroAdjustment } from "../../supabase/functions/_shared/auto-macro-adjustment.ts";

const targets = { protein: 176, carbs: 240, fats: 72 };
const saved = { error: null };

function createWrites() {
  return {
    saveNutrition: vi.fn().mockResolvedValue(saved),
    saveBaseline: vi.fn().mockResolvedValue(saved),
    notify: vi.fn().mockResolvedValue(saved),
  };
}

describe("automatic macro adjustment persistence", () => {
  it("does not write invalid calculated targets or send a success notification", async () => {
    const writes = createWrites();
    const result = await persistAutoMacroAdjustment({ ...targets, fats: 500 }, writes);

    expect(result).toMatchObject({ success: false, stage: "validation" });
    expect(writes.saveNutrition).not.toHaveBeenCalled();
    expect(writes.saveBaseline).not.toHaveBeenCalled();
    expect(writes.notify).not.toHaveBeenCalled();
  });

  it("retains the previous weight after a nutrition error and succeeds on retry", async () => {
    let weightReference = 78;
    const currentWeight = 80;
    const writes = createWrites();
    writes.saveNutrition.mockResolvedValueOnce({ error: new Error("Nutrition write rejected") });
    writes.saveBaseline.mockImplementation(async () => {
      weightReference = currentWeight;
      return saved;
    });

    expect(await persistAutoMacroAdjustment(targets, writes))
      .toMatchObject({ success: false, stage: "nutrition" });
    expect(weightReference).toBe(78);
    expect(writes.saveBaseline).not.toHaveBeenCalled();
    expect(writes.notify).not.toHaveBeenCalled();

    expect(await persistAutoMacroAdjustment(targets, writes)).toEqual({ success: true });
    expect(weightReference).toBe(80);
    expect(writes.saveNutrition).toHaveBeenCalledTimes(2);
    expect(writes.notify).toHaveBeenCalledTimes(1);
  });

  it("retries an interrupted baseline update even when nutrition already contains the new targets", async () => {
    let storedTargets = { protein: 172, carbs: 234, fats: 70 };
    const writes = createWrites();
    writes.saveNutrition.mockImplementation(async () => {
      storedTargets = { ...targets };
      return saved;
    });
    writes.saveBaseline.mockResolvedValueOnce({ error: new Error("Weight write rejected") });

    expect(await persistAutoMacroAdjustment(targets, writes))
      .toMatchObject({ success: false, stage: "baseline" });
    expect(storedTargets).toEqual(targets);
    expect(writes.notify).not.toHaveBeenCalled();

    expect(await persistAutoMacroAdjustment(targets, writes)).toEqual({ success: true });
    expect(writes.saveBaseline).toHaveBeenCalledTimes(2);
    expect(writes.notify).toHaveBeenCalledTimes(1);
  });

  it("handles thrown nutrition failures without moving the weight reference", async () => {
    const writes = createWrites();
    writes.saveNutrition.mockRejectedValueOnce(new Error("Connection lost"));

    expect(await persistAutoMacroAdjustment(targets, writes))
      .toMatchObject({ success: false, stage: "nutrition" });
    expect(writes.saveBaseline).not.toHaveBeenCalled();
    expect(writes.notify).not.toHaveBeenCalled();
  });

  it.each(["returned", "thrown"])("keeps a persisted adjustment successful and reports a %s notification error separately", async (failure) => {
    const writes = createWrites();
    const error = new Error("Notification write rejected");
    if (failure === "returned") {
      writes.notify.mockResolvedValueOnce({ error });
    } else {
      writes.notify.mockRejectedValueOnce(error);
    }

    expect(await persistAutoMacroAdjustment(targets, writes))
      .toEqual({ success: true, warning: { stage: "notification", error } });
    expect(writes.saveNutrition).toHaveBeenCalledOnce();
    expect(writes.saveBaseline).toHaveBeenCalledOnce();
    expect(writes.notify).toHaveBeenCalledOnce();
  });

  it("confirms nutrition, then weight, before notifying success", async () => {
    const order: string[] = [];
    const record = (stage: string) => async () => {
      order.push(stage);
      return saved;
    };
    const writes = {
      saveNutrition: record("saveNutrition"),
      saveBaseline: record("saveBaseline"),
      notify: record("notify"),
    };

    expect(await persistAutoMacroAdjustment(targets, writes)).toEqual({ success: true });
    expect(order).toEqual(["saveNutrition", "saveBaseline", "notify"]);
  });
});
