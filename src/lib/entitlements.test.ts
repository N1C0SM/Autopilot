import { describe, expect, it } from "vitest";
import { hasCoaching, hasNutrition, getConsumerPlan, resolveFeatures, requiredPlan, resolvePaidTier, subscriptionAllowsCoaching } from "../../supabase/functions/_shared/entitlements";
const active = { payment_status: "paid", subscription_tier: "training", subscription_status: "active", subscription_end: "2030-01-01T00:00:00Z" };
describe("free to paid entitlements", () => {
  it("never treats free metadata, a selected plan or a legacy paid flag as a purchase", () => {
    expect(hasCoaching({ payment_status: "unpaid", subscription_tier: "training" })).toBe(false);
    expect(hasCoaching({ payment_status: "paid", subscription_tier: "free", subscription_status: "active" })).toBe(false);
    expect(hasCoaching({ payment_status: "paid", subscription_tier: "personal", subscription_status: "inactive" })).toBe(false);
    expect(hasCoaching(null)).toBe(false);
  });
  it("Plus grants software + nutrition but never a human coach", () => {
    expect(hasCoaching(active)).toBe(true);
    expect(hasNutrition(active)).toBe(true);
    expect(getConsumerPlan(active)).toBe("plus");
    expect(resolveFeatures("plus").has("humanCoach")).toBe(false);
    expect(resolveFeatures("coach").has("humanCoach")).toBe(true);
    expect(getConsumerPlan({ ...active, subscription_tier: "full" })).toBe("coach");
    expect(getConsumerPlan({ payment_status: "unpaid" })).toBe("free");
    expect(requiredPlan("advancedAI")).toBe("plus");
    expect(requiredPlan("coachMessaging")).toBe("coach");
    // A trainer role is not a Coach plan.
    expect(resolveFeatures("free", ["trainer"]).has("humanCoach")).toBe(false);
    expect(resolveFeatures("free", ["trainer"]).has("trainerDashboard")).toBe(true);
    expect(resolveFeatures("free", ["trainer"]).has("trainerInvitations")).toBe(false);
    expect(hasNutrition({ ...active, subscription_tier: "full" })).toBe(true);
    expect(hasCoaching({ ...active, subscription_status: "trialing" })).toBe(true);
  });
  it("revokes expired, cancelled or delinquent access while preserving purchased legacy plans", () => {
    for (const status of ["canceled", "past_due", "unpaid", "incomplete", "inactive"]) {
      expect(hasCoaching({ ...active, subscription_status: status })).toBe(false);
      expect(subscriptionAllowsCoaching(status)).toBe(false);
    }
    expect(hasCoaching({ ...active, subscription_end: "2020-01-01" })).toBe(false);
    expect(hasCoaching({ ...active, subscription_status: "inactive", stripe_payment_id: "pi_legacy" })).toBe(true);
    expect(subscriptionAllowsCoaching("active")).toBe(true);
  });
  it("resolves tiers only from configured prices in the verified Stripe environment", () => {
    const settings = { price_id_training_live: "price_training", price_id_full_test: "price_test", price_id_live: "price_legacy" };
    expect(resolvePaidTier("price_training", settings, "live")).toBe("training");
    expect(resolvePaidTier("price_training", settings, "test")).toBeNull();
    expect(resolvePaidTier("price_test", settings, "test")).toBe("full");
    expect(resolvePaidTier("price_book", settings, "live")).toBeNull();
    expect(resolvePaidTier(undefined, settings, "live")).toBeNull();
    expect(resolvePaidTier("price_legacy", settings, "live")).toBe("personal");
  });
});
