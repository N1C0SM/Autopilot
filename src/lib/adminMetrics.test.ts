import { describe, expect, it } from "vitest";
import { clientActivity, clientProfiles, countCompletedWorkSets, summarizeClientPlans } from "./adminMetrics";

const now = Date.parse("2026-10-07T12:00:00Z");
const active = { payment_status: "paid", subscription_status: "active", subscription_end: "2026-11-01T00:00:00Z" };

describe("admin client metrics", () => {
  it("uses one client population for plans and activity without deleting staff", () => {
    const profiles = [
      { user_id: "client", ...active, subscription_tier: "full" },
      { user_id: "admin", ...active, subscription_tier: "full" },
      { user_id: "trainer", ...active, subscription_tier: "full" },
    ];
    const clients = clientProfiles(profiles, new Set(["admin", "trainer"]));
    expect(summarizeClientPlans(clients, now)).toMatchObject({ total: 1, counts: { free: 0, plus: 0, coach: 1 }, estimatedMonthly: 49 });
    expect(clientActivity(profiles.map(({ user_id }) => ({ user_id })), clients)).toEqual([{ user_id: "client" }]);
    expect(profiles).toHaveLength(3);
  });

  it("normalizes legacy tiers and excludes inactive, expired or unpaid plans", () => {
    const profiles = [
      { user_id: "training", ...active, subscription_tier: "training" },
      { user_id: "plus", ...active, subscription_tier: "plus" },
      ...["full", "coach", "transform", "personal"].map((subscription_tier) => ({ user_id: subscription_tier, ...active, subscription_tier })),
      { user_id: "expired", ...active, subscription_tier: "full", subscription_end: "2026-09-01" },
      { user_id: "inactive", ...active, subscription_tier: "full", subscription_status: "inactive" },
      { user_id: "unpaid", ...active, subscription_tier: "full", payment_status: "unpaid" },
    ];
    expect(summarizeClientPlans(profiles, now)).toMatchObject({ total: 9, counts: { free: 3, plus: 2, coach: 4 }, activePlans: 6, estimatedMonthly: 254 });
  });

  it("includes trial/manual access and legacy purchases as catalog estimates only", () => {
    const profiles = [
      { user_id: "trial", ...active, subscription_tier: "training", subscription_status: "trialing" },
      { user_id: "manual", ...active, subscription_tier: "full" },
      { user_id: "legacy", ...active, subscription_tier: "personal", subscription_status: "inactive", stripe_payment_id: "pi_legacy" },
    ];
    expect(summarizeClientPlans(profiles, now)).toMatchObject({ activePlans: 3, estimatedMonthly: 127, estimatedPerPlan: 42 });
    expect(summarizeClientPlans([], now)).toMatchObject({ total: 0, activePlans: 0, estimatedMonthly: 0, estimatedPerPlan: 0 });
  });

  it("counts completed work sets instead of all saved slots", () => {
    expect(countCompletedWorkSets([{ done: true }, { done: false }, { done: true, isWarmup: true }, null, "invalid"])).toBe(1);
    expect(countCompletedWorkSets(null)).toBe(0);
  });
});
