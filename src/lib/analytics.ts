// Lightweight analytics helper. Fire-and-forget.
// Pushes events to window.dataLayer (GTM-compatible), gtag if present,
// and logs to console in dev. Easy to wire to Plausible/PostHog later.

type EventName =
  | "register"
  | "verify_email"
  | "onboarding_start"
  | "onboarding_step"
  | "onboarding_complete"
  | "plan_preview_view"
  | "paywall_view"
  | "plan_select"
  | "checkout_start"
  | "checkout_success"
  | "checkout_abandoned"
  | "plan_ready"
  | "landing_view"
  | "cta_click"
  | "pricing_view";

export function track(event: EventName, params: Record<string, any> = {}) {
  try {
    const payload = { event, ...params, ts: Date.now() };
    const w: any = typeof window !== "undefined" ? window : {};
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(payload);
    if (typeof w.gtag === "function") {
      w.gtag("event", event, params);
    }
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[analytics]", event, params);
    }
  } catch {
    // never break UX on analytics
  }
}