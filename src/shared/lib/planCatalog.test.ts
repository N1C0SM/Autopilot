import { describe, expect, it } from "vitest";
import { parseCatalog } from "@/shared/lib/planCatalog";

describe("plan catalog", () => {
  it("hides plans the admin turned off (only returned rows are shown)", () => {
    const plans = parseCatalog([{ key: "free", name: "Free", price: 0, features: [], not_included: [] }]);
    expect(plans.map((p) => p.key)).toEqual(["free"]);
  });
  it("uses the admin price and trial days", () => {
    const [plus] = parseCatalog([{ key: "training", name: "Plus", price: 35, trial_days: 14, features: ["A"], not_included: [] }]);
    expect(plus.price).toBe(35);
    expect(plus.trial_days).toBe(14);
  });
  it("blocks the button when new sign-ups are closed", () => {
    const [coach] = parseCatalog([{ key: "full", accepting_new_subscriptions: false }]);
    expect(coach.accepting).toBe(false);
  });
});
