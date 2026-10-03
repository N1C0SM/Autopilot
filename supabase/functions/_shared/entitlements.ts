/** Shared client/server rules. Never infer a purchase from signup metadata. */
export interface BillingProfile {
  payment_status?: string | null;
  subscription_tier?: string | null;
  subscription_status?: string | null;
  subscription_end?: string | null;
  stripe_payment_id?: string | null;
}

/** Consumer plan (what the user bought). Never confuse with a role (user/trainer/admin). */
export type ConsumerPlan = "free" | "plus" | "coach";
export type UserRole = "user" | "trainer" | "admin";

/** Stored tier keys: "training" = Plus, "full"/"transform"/"personal" = Coach (legacy names kept for existing data). */
const PLUS_TIERS = ["training", "plus"];
const COACH_TIERS = ["full", "transform", "personal", "coach"];

/** True when the user has any paid consumer plan currently in force. */
export function hasCoaching(profile: BillingProfile | null | undefined, now = Date.now()): boolean {
  if (!profile || profile.payment_status !== "paid" || ![...PLUS_TIERS, ...COACH_TIERS].includes(profile.subscription_tier || "")) return false;
  if (profile.stripe_payment_id) return true; // Existing one-time coaching purchases.
  return ["active", "trialing"].includes(profile.subscription_status || "")
    && (!profile.subscription_end || Date.parse(profile.subscription_end) > now);
}

export function getConsumerPlan(profile: BillingProfile | null | undefined, now = Date.now()): ConsumerPlan {
  if (!hasCoaching(profile, now)) return "free";
  return COACH_TIERS.includes(profile?.subscription_tier || "") ? "coach" : "plus";
}

/** Plus includes the AI nutrition plan; Coach adds human follow-up. */
export function hasNutrition(profile: BillingProfile | null | undefined, now = Date.now()): boolean {
  return getConsumerPlan(profile, now) !== "free";
}

export const FEATURES = [
  "basicTracking", "basicAI", "basicAnalytics",
  "advancedTracking", "advancedAI", "adaptiveTraining", "advancedAnalytics", "bodyAnalysis", "nutritionPlan",
  "humanCoach", "coachCheckins", "coachMessaging", "coachFeedback",
  "trainerDashboard", "trainerClientManagement", "trainerInvitations",
] as const;
export type Feature = typeof FEATURES[number];

const FREE: Feature[] = ["basicTracking", "basicAI", "basicAnalytics"];
const PLUS: Feature[] = [...FREE, "advancedTracking", "advancedAI", "adaptiveTraining", "advancedAnalytics", "bodyAnalysis", "nutritionPlan"];
const COACH: Feature[] = [...PLUS, "humanCoach", "coachCheckins", "coachMessaging", "coachFeedback"];
const TRAINER: Feature[] = ["trainerDashboard", "trainerClientManagement"];

export const PLAN_FEATURES: Record<ConsumerPlan, Feature[]> = { free: FREE, plus: PLUS, coach: COACH };

/** Single source of capabilities: consumer plan + roles (+ B2B entitlement for invitations). */
export function resolveFeatures(plan: ConsumerPlan, roles: UserRole[] = [], hasTrainerSubscription = false): Set<Feature> {
  const set = new Set<Feature>(PLAN_FEATURES[plan]);
  if (roles.includes("trainer") || roles.includes("admin")) TRAINER.forEach((f) => set.add(f));
  if (hasTrainerSubscription) set.add("trainerInvitations");
  return set;
}

/** Minimum plan that unlocks a consumer feature (for paywalls). */
export function requiredPlan(feature: Feature): ConsumerPlan | null {
  if (FREE.includes(feature)) return "free";
  if (PLUS.includes(feature)) return "plus";
  if (COACH.includes(feature)) return "coach";
  return null;
}

/** Map a Stripe price to a stored tier. "training" price slot sells Plus, "full" sells Coach. */
export function resolvePaidTier(priceId: string | undefined, settings: Record<string, unknown>, mode: "test" | "live"): string | null {
  if (!priceId) return null;
  for (const tier of ["training", "full", "transform"]) {
    if (settings[`price_id_${tier}_${mode}`] === priceId) return tier;
  }
  if ([settings[`price_id_${mode}`], settings[`price_id_yearly_${mode}`]].includes(priceId)) return "personal";
  return null; // Unknown products (including ebooks) never grant a plan.
}

export function tierToPlan(tier: string | null | undefined): ConsumerPlan {
  if (COACH_TIERS.includes(tier || "")) return "coach";
  if (PLUS_TIERS.includes(tier || "")) return "plus";
  return "free";
}

export function subscriptionAllowsCoaching(status: string): boolean {
  // Scheduled cancellations remain active in Stripe until the period ends.
  return status === "active" || status === "trialing";
}
