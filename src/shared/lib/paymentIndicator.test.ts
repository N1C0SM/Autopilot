import { describe, expect, it } from "vitest";
import { showsPaymentIndicator } from "./paymentIndicator";

describe("payment indicator", () => {
  it("does not treat a free account as unpaid", () => {
    expect(showsPaymentIndicator({ subscription_tier: "free", payment_status: "unpaid" })).toBe(false);
  });
  it("does not invent a payment for a free account", () => {
    expect(showsPaymentIndicator({ subscription_tier: "free", payment_status: "paid" })).toBe(false);
  });
  it.each(["training", "plus", "full", "transform", "personal", "coach"])("retains billing status for %s", (subscription_tier) => {
    expect(showsPaymentIndicator({ subscription_tier, payment_status: "unpaid" })).toBe(true);
    expect(showsPaymentIndicator({ subscription_tier, payment_status: "paid" })).toBe(true);
  });
  it("does not infer a purchase from an unknown tier or status", () => {
    expect(showsPaymentIndicator({ payment_status: "unpaid" })).toBe(false);
    expect(showsPaymentIndicator({ subscription_tier: "unknown", payment_status: "paid" })).toBe(false);
    expect(showsPaymentIndicator({ subscription_tier: "training", payment_status: "pending" })).toBe(false);
  });
});