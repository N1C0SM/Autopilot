import { tierToPlan, type BillingProfile } from "./entitlements";

/** Presentation only: a free account's legacy unpaid flag is not a debt. */
export function showsPaymentIndicator(profile: BillingProfile): boolean {
  return tierToPlan(profile.subscription_tier) !== "free"
    && (profile.payment_status === "paid" || profile.payment_status === "unpaid");
}