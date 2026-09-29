/** Shared client/server rules. Never infer a purchase from signup metadata. */
export interface BillingProfile {
  payment_status?: string | null;
  subscription_tier?: string | null;
  subscription_status?: string | null;
  subscription_end?: string | null;
  stripe_payment_id?: string | null;
}
export function hasCoaching(profile: BillingProfile | null | undefined, now = Date.now()): boolean {
  if (!profile || profile.payment_status !== "paid" || !["training", "full", "transform", "personal"].includes(profile.subscription_tier || "")) return false;
  if (profile.stripe_payment_id) return true; // Existing one-time coaching purchases.
  return ["active", "trialing"].includes(profile.subscription_status || "")
    && (!profile.subscription_end || Date.parse(profile.subscription_end) > now);
}
export function hasNutrition(profile: BillingProfile | null | undefined, now = Date.now()): boolean {
  return hasCoaching(profile, now) && profile?.subscription_tier !== "training";
}
export function resolvePaidTier(priceId: string | undefined, settings: Record<string, unknown>, mode: "test" | "live"): string | null {
  if (!priceId) return null;
  for (const tier of ["training", "full", "transform"]) {
    if (settings[`price_id_${tier}_${mode}`] === priceId) return tier;
  }
  if ([settings[`price_id_${mode}`], settings[`price_id_yearly_${mode}`]].includes(priceId)) return "personal";
  return null; // Unknown products (including ebooks) never grant coaching.
}
export function subscriptionAllowsCoaching(status: string): boolean {
  // Scheduled cancellations remain active in Stripe until the period ends.
  return status === "active" || status === "trialing";
}
