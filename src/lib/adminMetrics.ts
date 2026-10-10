import { PLAN_PRICE } from "@/config/tiers";
import { getConsumerPlan, type BillingProfile, type ConsumerPlan } from "@/lib/entitlements";

export interface MetricsProfile extends BillingProfile {
  user_id: string;
  created_at?: string | null;
  plan_status?: string | null;
}

/** Staff remain in account management, but never inflate consumer metrics. */
export function clientProfiles<T extends MetricsProfile>(profiles: T[], staffIds: ReadonlySet<string>): T[] {
  return profiles.filter((profile) => !staffIds.has(profile.user_id));
}

export function summarizeClientPlans(profiles: MetricsProfile[], now = Date.now()) {
  const counts: Record<ConsumerPlan, number> = { free: 0, plus: 0, coach: 0 };
  profiles.forEach((profile) => { counts[getConsumerPlan(profile, now)]++; });
  const activePlans = counts.plus + counts.coach;
  // Catalog value, including trials and manual grants; never Stripe receipts.
  const estimatedMonthly = counts.plus * PLAN_PRICE.plus + counts.coach * PLAN_PRICE.coach;
  return {
    total: profiles.length,
    counts,
    activePlans,
    estimatedMonthly,
    estimatedPerPlan: activePlans ? Math.round(estimatedMonthly / activePlans) : 0,
  };
}

export function clientActivity<T extends { user_id: string }>(records: T[], profiles: MetricsProfile[]): T[] {
  const ids = new Set(profiles.map((profile) => profile.user_id));
  return records.filter((record) => ids.has(record.user_id));
}

/** Saved logs contain unchecked/planned slots; count completed work sets only. */
export function countCompletedWorkSets(sets: unknown): number {
  if (!Array.isArray(sets)) return 0;
  return sets.filter((set) => set !== null && typeof set === "object"
    && set.done === true && set.isWarmup !== true).length;
}

export const MONTHLY_ESTIMATE_NOTE = "Estimación por tarifas de los planes activos, incluidas pruebas y accesos manuales. No representa cobros ni ingresos confirmados de Stripe. Solo se cuentan clientes; se excluyen administradores y entrenadores.";
