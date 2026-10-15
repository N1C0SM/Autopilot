import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { getConsumerPlan, type BillingProfile } from "@/lib/entitlements";

type Client = typeof import("@/integrations/supabase/client").supabase;

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

/**
 * Plus y Coach rehacen su plan con un scan; Free conserva su rutina inicial
 * (generate-plan no la regenera). Un admin siempre puede, para probarlo.
 */
export function canApplyScanToPlan(billing: BillingProfile | null | undefined, isAdmin: boolean): boolean {
  return isAdmin || getConsumerPlan(billing) !== "free";
}

export type ScanApplyOutcome =
  /** Plan regenerado con el scan. */
  | "applied"
  /** Coach: el entrenador revisa el plan con el scan. */
  | "sent_to_coach"
  /** El scan no propone cambios: no se toca nada. */
  | "no_changes"
  /** Sin onboarding no hay con qué generar el plan. */
  | "needs_profile"
  /** El servidor conservó la rutina (cuenta Free): se deshacen los cambios. */
  | "kept"
  /** Algo falló: se deshacen los cambios y el plan queda como estaba. */
  | "failed";

const functionStatus = (error: unknown) => (error as { context?: Response } | null)?.context?.status;

/**
 * Aplica las inferencias aprobadas al onboarding y regenera el plan. Si el
 * servidor no lo regenera, devuelve el onboarding y el estado del plan a como
 * estaban, para que «tu plan no ha cambiado» sea verdad.
 */
export async function applyScanPlan(client: Client, userId: string, r: ScanInferences): Promise<ScanApplyOutcome> {
  const updates = buildScanPlanUpdates(r);
  const keys = Object.keys(updates) as (keyof TablesUpdate<"onboarding">)[];
  if (keys.length === 0) return "no_changes";

  const [{ data: onboarding, error: onboardingError }, { data: profile }] = await Promise.all([
    client.from("onboarding").select("*").eq("user_id", userId).maybeSingle(),
    client.from("profiles").select("plan_status").eq("user_id", userId).maybeSingle(),
  ]);
  if (onboardingError) return "failed";
  if (!onboarding) return "needs_profile";

  const previous: TablesUpdate<"onboarding"> = {};
  for (const key of keys) {
    (previous as Record<string, unknown>)[key] = (onboarding as Tables<"onboarding">)[key as keyof Tables<"onboarding">];
  }
  const previousStatus = profile?.plan_status ?? null;

  const restore = async () => {
    const results = await Promise.all([
      client.from("onboarding").update(previous).eq("user_id", userId),
      previousStatus
        ? client.from("profiles").update({ plan_status: previousStatus }).eq("user_id", userId)
        : Promise.resolve({ error: null }),
    ]);
    for (const { error } of results) if (error) console.error("applyScanPlan restore", error);
  };

  const { data: updated, error: updateError } = await client
    .from("onboarding").update(updates).eq("user_id", userId).select("id");
  if (updateError || !updated?.length) return "failed";

  const { error: statusError } = await client.from("profiles").update({ plan_status: "plan_pending" }).eq("user_id", userId);
  if (statusError) {
    await restore();
    return "failed";
  }

  const { data, error } = await client.functions.invoke("generate-plan", { body: { user_id: userId } });
  if (error) {
    // Coach: el plan lo prepara su entrenador; el scan y los datos quedan para él.
    if (functionStatus(error) === 403) return "sent_to_coach";
    await restore();
    return "failed";
  }
  if ((data as { existing?: boolean } | null)?.existing) {
    await restore();
    return "kept";
  }
  return "applied";
}
