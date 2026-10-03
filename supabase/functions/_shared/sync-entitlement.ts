import { tierToPlan } from "./entitlements.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

/** Mirror the Stripe-backed plan into `entitlements` (source = stripe). Backend-only authority. */
export async function syncStripeEntitlement(db: Db, userId: string, tier: string | null, status: string, expiresAt: string | null, externalId?: string) {
  const plan = tierToPlan(tier);
  const active = plan !== "free" && (status === "active" || status === "trialing");
  // Close any other Stripe consumer entitlement (upgrade/downgrade).
  const others = ["plus", "coach"].filter((p) => !active || p !== plan);
  await db.from("entitlements").update({ status: "canceled" }).eq("user_id", userId).eq("source", "stripe").in("plan", others);
  if (!active) return;
  await db.from("entitlements").upsert({
    user_id: userId, plan, source: "stripe", status: status === "trialing" ? "trialing" : "active",
    expires_at: expiresAt, external_id: externalId ?? null,
  }, { onConflict: "user_id,plan,source" });
}
