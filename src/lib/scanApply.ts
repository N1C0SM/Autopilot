import type { TablesUpdate } from "@/integrations/supabase/types";

/** Inferencias que el análisis del scan puede proponer. Nunca se aplican solas. */
export type ScanInferences = {
  inferred_goal?: string;
  inferred_focus?: string;
  inferred_intensity?: number;
  inferred_specific_goals?: string[];
};

/**
 * ¿Este scan propone algún cambio? Si no, no hay nada que el usuario pueda aprobar.
 */
export function hasScanInferences(r: ScanInferences): boolean {
  return !!(r.inferred_goal || r.inferred_focus || r.inferred_specific_goals?.length);
}

/**
 * Traduce las inferencias del scan a los campos de `onboarding`.
 * Devuelve `{}` cuando el scan no inferió nada: así el plan no se toca.
 */
export function buildScanPlanUpdates(r: ScanInferences): TablesUpdate<"onboarding"> {
  const updates: TablesUpdate<"onboarding"> = {};
  if (r.inferred_goal) updates.goal = r.inferred_goal;
  if (r.inferred_focus) {
    updates.primary_focus = r.inferred_focus;
    updates.equipment_type =
      r.inferred_focus === "gimnasio" ? "Gimnasio" :
      r.inferred_focus === "calistenia" ? "Calistenia" : "Mixto";
  }
  if (typeof r.inferred_intensity === "number") updates.intensity_level = r.inferred_intensity;
  if (r.inferred_specific_goals?.length) {
    updates.specific_goal = r.inferred_specific_goals.join(", ");
  }
  return updates;
}
