import { Capacitor } from "@capacitor/core";

/**
 * Esquema propio de la app nativa. Debe coincidir con:
 *  - iOS:     ios/App/App/Info.plist → CFBundleURLTypes → CFBundleURLSchemes
 *  - Android: android/app/src/main/AndroidManifest.xml → intent-filter
 *  - Supabase Auth → Redirect URLs (allowlist)
 */
export const NATIVE_SCHEME = "autopilot";
export const NATIVE_AUTH_CALLBACK = `${NATIVE_SCHEME}://auth-callback`;

/**
 * URL de retorno para emails de verificación / recuperación y para OAuth.
 *
 * En web devuelve la URL real del sitio.
 * En la app nativa devuelve el deep link `autopilot://auth-callback?next=...`,
 * de forma que el enlace abre la app (esté abierta o cerrada) en lugar del
 * navegador. Nunca usamos `window.location.origin` en nativo: en el WebView
 * apunta a `capacitor://localhost`, que no es una URL válida de retorno.
 */
export function authRedirect(path = "/dashboard"): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  if (Capacitor.isNativePlatform()) {
    return `${NATIVE_AUTH_CALLBACK}?next=${encodeURIComponent(safePath)}`;
  }
  return `${window.location.origin}${safePath}`;
}
