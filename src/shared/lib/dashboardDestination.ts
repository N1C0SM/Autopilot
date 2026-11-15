import type { MobileTab } from "@/app/components/mobile/MobileTabBar";

/** Explicit section survives unavailable storage and the admin entry redirect. */
export function dashboardDestination(userId: string, section: MobileTab): string {
  return `/dashboard/user/${encodeURIComponent(userId)}?section=${encodeURIComponent(section)}`;
}