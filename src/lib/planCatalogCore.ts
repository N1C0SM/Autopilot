// Pure plan-catalog helpers: no browser or Supabase imports, so the build (vite.config.ts) can use them too.
import { TIERS, type PlanKey } from "../config/tiers";

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
      notIncluded: strings(r.not_included ?? r.notIncluded),
      cta: typeof r.cta === "string" && r.cta ? r.cta : t.cta,
      accepting: r.accepting_new_subscriptions !== false && r.accepting !== false,
    });
  }
  return out.length ? out : fallbackCatalog();
}

export type PlanAvailability = {
  campaign?: boolean;
  plans: CatalogPlan[];
  /** Coach is shown in the public catalog. */
  coach: boolean;
  /** Plus is shown in the public catalog. */
  plus: boolean;
  coachPrice: number;
  plusPrice: number;
  coachName: string;
  plusName: string;
  /** Paid plans currently offered, for copy such as "Plus y Coach piden tarjeta". */
  paidNames: string;
};

export function availabilityFrom(plans: CatalogPlan[]): PlanAvailability {
  const coachPlan = plans.find((p) => p.key === "full");
  const plusPlan = plans.find((p) => p.key === "training");
  const paid = [plusPlan, coachPlan].filter(Boolean).map((p) => p!.name);
  return {
    plans,
    coach: Boolean(coachPlan),
    plus: Boolean(plusPlan),
    coachPrice: coachPlan?.price ?? TIERS.full.price,
    plusPrice: plusPlan?.price ?? TIERS.training.price,
    coachName: coachPlan?.name ?? TIERS.full.name,
    plusName: plusPlan?.name ?? TIERS.training.name,
    paidNames: paid.length ? paid.join(" y ") : "Los planes de pago",
  };
}

/** Spanish price format: "29 €". */
export const euro = (n: number) => `${n.toLocaleString("es-ES")} €`;
