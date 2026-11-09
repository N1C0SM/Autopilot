export const PUBLIC_SITE_ORIGIN = "https://autopilotplan.com";
export const APP_ORIGIN = "https://app.autopilotplan.com";
export const APP_HOSTNAME = new URL(APP_ORIGIN).hostname;

const APP_PATHS = [
  /^\/(?:login|signup|verify-email|forgot-password|reset-password|auth\/callback|onboarding(?:-choice)?|dashboard|settings|my-schedule|admin|drive|trainer|scan|payment-success|unsubscribe)(?:\/|$)/,
  /^\/(?:invitacion|impersonate\/callback|\.lovable\/oauth\/consent)(?:\/|$)/,
];

export function isAppPath(pathname: string): boolean {
  return APP_PATHS.some((pattern) => pattern.test(pathname));
}

export function isAppHostname(hostname: string): boolean {
  return hostname.toLowerCase() === APP_HOSTNAME;
}

export function getDomainRedirect(
  location: Pick<Location, "hostname" | "pathname" | "search" | "hash">,
  nativeApp = false,
): string | null {
  if (nativeApp) return null;

  const { hostname, pathname, search, hash } = location;
  const suffix = `${search}${hash}`;
  if (isAppHostname(hostname)) {
    if (pathname === "/") return `${APP_ORIGIN}/dashboard${suffix}`;
    if (!isAppPath(pathname)) return `${PUBLIC_SITE_ORIGIN}${pathname}${suffix}`;
    return null;
  }

  if ((hostname.toLowerCase() === "autopilotplan.com" || hostname.toLowerCase() === "www.autopilotplan.com") && isAppPath(pathname)) {
    return `${APP_ORIGIN}${pathname}${suffix}`;
  }

  return null;
}
