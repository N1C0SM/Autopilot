import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { availabilityFrom, fallbackCatalog, parseCatalog, type CatalogPlan, type PlanAvailability } from "@/lib/planCatalogCore";

import { useFreeCampaign } from "@/lib/freeCampaign";

export * from "@/lib/planCatalogCore";

const CACHE_KEY = "autopilot:plan-catalog:v1";

/**
 * Initial catalog, in priority order:
 * 1. last catalog seen by this browser (avoids flashing a plan the admin hid),
 * 2. snapshot taken at build time (same data the prerendered HTML uses),
 * 3. static tiers.
 */
function initialCatalog(): CatalogPlan[] {
  try {
    const cached = typeof localStorage !== "undefined" ? localStorage.getItem(CACHE_KEY) : null;
    if (cached) return parseCatalog(JSON.parse(cached));
  } catch { /* storage unavailable */ }
  const snapshot = import.meta.env.VITE_PLAN_SNAPSHOT;
  if (snapshot) {
    try { return parseCatalog(JSON.parse(snapshot)); } catch { /* malformed snapshot */ }
  }
  return fallbackCatalog();
}

// One shared store: every component reads the same catalog and the RPC runs once per page load.
let current: CatalogPlan[] | null = null;
let request: Promise<void> | null = null;
const listeners = new Set<(p: CatalogPlan[]) => void>();

function getCatalog(): CatalogPlan[] {
  if (!current) current = initialCatalog();
  return current;
}

function refresh() {
  if (request) return request;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request = (supabase.rpc as any)("get_consumer_plans_public").then(({ data, error }: { data: unknown; error: unknown }) => {
    if (error || !Array.isArray(data)) return;
    current = parseCatalog(data);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
    const updated = current;
    listeners.forEach((l) => l(updated));
  }, () => undefined);
  return request;
}

/** Public plans exactly as the admin left them (hidden plans are not returned). */
export function usePlanCatalog() {
  const campaign = useFreeCampaign();
  const [plans, setPlans] = useState<CatalogPlan[]>(getCatalog);
  useEffect(() => {
    listeners.add(setPlans);
    void refresh();
    return () => { listeners.delete(setPlans); };
  }, []);
  return campaign ? plans.filter((p) => p.key === "free").map((p) => ({ ...p, features: ["Rutina inicial personalizada", "Registro de series y progreso", "Sobrecarga progresiva", "Scan corporal", "Objetivos de nutrición básica"], notIncluded: [] })) : plans;
}

/**
 * Which plans the admin has published. Use it for any copy that mentions Coach,
 * so hiding Coach in Admin → Planes removes it everywhere at once.
 */
export function usePlanAvailability(): PlanAvailability {
  const campaign = useFreeCampaign();
  return { ...availabilityFrom(usePlanCatalog()), campaign };
}
