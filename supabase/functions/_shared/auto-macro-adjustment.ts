import { nutritionMacroError, type MacroTargets } from "./nutrition.ts";

type WriteResult = { error: unknown | null };
type AdjustmentStage = "validation" | "nutrition" | "baseline";

interface MacroAdjustmentWrites {
  saveNutrition: () => Promise<WriteResult>;
  saveBaseline: () => Promise<WriteResult>;
  notify: () => Promise<WriteResult>;
}

export type MacroAdjustmentResult =
  | { success: true; warning?: { stage: "notification"; error: unknown } }
  | { success: false; stage: AdjustmentStage; error: unknown };

// Keep the previous weight reference when nutrition fails so the next run
// still detects the weight change and can retry the adjustment.
export async function persistAutoMacroAdjustment(
  macros: MacroTargets,
  writes: MacroAdjustmentWrites,
): Promise<MacroAdjustmentResult> {
  const validationError = nutritionMacroError(macros);
  if (validationError) return { success: false, stage: "validation", error: validationError };

  const stages = [
    ["nutrition", writes.saveNutrition],
    ["baseline", writes.saveBaseline],
  ] as const;

  for (const [stage, write] of stages) {
    try {
      const { error } = await write();
      if (error) return { success: false, stage, error };
    } catch (error) {
      return { success: false, stage, error };
    }
  }

  // The adjustment is already persisted. A notification failure must not
  // make the saved targets and weight look like a failed adjustment.
  try {
    const { error } = await writes.notify();
    if (error) return { success: true, warning: { stage: "notification", error } };
  } catch (error) {
    return { success: true, warning: { stage: "notification", error } };
  }

  return { success: true };
}
