/**
 * La portada vive en autopilotplan.com y la app en app.autopilotplan.com.
 * En preview/localhost todo sigue en el mismo sitio.
 */
export const APP_ORIGIN = "https://app.autopilotplan.com";
const MAIN_HOSTS = /^(www\.)?autopilotplan\.com$/i;
const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"];

export const isMainHost = (hostname: string) => MAIN_HOSTS.test(hostname);

/** Devuelve la URL de la app conservando los datos de campaña de la visita. */
export function appHref(path: string, loc: { hostname: string; search: string } = window.location): string {
  if (!isMainHost(loc.hostname)) return path;
  const url = new URL(path, APP_ORIGIN);
  const current = new URLSearchParams(loc.search);
  for (const key of CAMPAIGN_KEYS) {
    const v = current.get(key);
    if (v && !url.searchParams.has(key)) url.searchParams.set(key, v);
  }
  return url.toString();
}

const PRIVATE_PREFIXES = ["/dashboard", "/onboarding", "/login", "/signup", "/admin", "/tracker", "/workout", "/settings", "/ajustes"];

export const isPrivatePath = (pathname: string) =>
  PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}-`));
