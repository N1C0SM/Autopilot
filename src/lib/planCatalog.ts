import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TIERS, type PlanKey } from "@/config/tiers";

export type CatalogPlan = {
  key: PlanKey;
  name: string;
  tagline: string;
  price: number;
  trial_days: number;
  features: string[];
  notIncluded: string[];
  cta: string;
  accepting: boolean;
};

const ORDER: PlanKey[] = ["free", "training", "full"];
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export const fallbackCatalog = (): CatalogPlan[] => ORDER.map((k) => {
  const t = TIERS[k];
  return { key: k, name: t.name, tagline: t.tagline, price: t.price, trial_days: t.trial_days, features: [...t.features], notIncluded: [...t.notIncluded], cta: t.cta, accepting: true };
});

/** Rows from the admin-editable catalog; malformed rows fall back to the static tier. */
export function parseCatalog(rows: unknown): CatalogPlan[] {
  if (!Array.isArray(rows)) return fallbackCatalog();
  const out: CatalogPlan[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const key = r?.key as PlanKey;
    if (!ORDER.includes(key)) continue;
    const t = TIERS[key];
    out.push({
      key,
      name: typeof r.name === "string" && r.name ? r.name : t.name,
      tagline: typeof r.tagline === "string" ? r.tagline : t.tagline,
      price: Number.isFinite(Number(r.price)) ? Number(r.price) : t.price,
      trial_days: Number.isFinite(Number(r.trial_days)) ? Number(r.trial_days) : t.trial_days,
      features: strings(r.features),
      notIncluded: strings(r.not_included),
      cta: typeof r.cta === "string" && r.cta ? r.cta : t.cta,
      accepting: r.accepting_new_subscriptions !== false,
    });
  }
  return out;
}

export function usePlanCatalog() {
  const [plans, setPlans] = useState<CatalogPlan[]>(fallbackCatalog);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase.rpc as any)("get_consumer_plans_public").then(({ data, error }: { data: unknown; error: unknown }) => {
      if (!error && Array.isArray(data) && data.length) setPlans(parseCatalog(data));
    });
  }, []);
  return plans;
}
