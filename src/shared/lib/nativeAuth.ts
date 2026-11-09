import { Capacitor } from "@capacitor/core";
import { supabase } from "@/shared/integrations/supabase/client";
import { lovable } from "@/shared/integrations/lovable";
import { authRedirect } from "@/shared/lib/authRedirect";

/**
 * "Continuar con Apple".
 *
 * Web  → flujo gestionado por Lovable Cloud (redirección normal del navegador).
 * iOS  → abre la hoja de Apple en el navegador seguro del sistema
 *        (ASWebAuthenticationSession) y vuelve a la app por deep link
 *        `autopilot://auth-callback`, donde NativeDeepLinks canjea el código
 *        por la sesión de Supabase.
 */
export async function signInWithApple(next = "/dashboard"): Promise<{ error: Error | null }> {
  if (!Capacitor.isNativePlatform()) {
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    });
    return { error: (result.error as Error) ?? null };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: authRedirect(next),
      skipBrowserRedirect: true,
    },
  });

  if (error) return { error: error as Error };
  if (!data?.url) return { error: new Error("No se pudo iniciar el flujo de Apple") };

  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: data.url, presentationStyle: "popover" });
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
  return { error: null };
}

/**
 * "Continuar con Google" (solo web): mismo flujo gestionado por Lovable Cloud que
 * Apple en la web. Google bloquea su acceso dentro de WebViews, por eso las apps
 * empaquetadas no lo muestran (`googleSignInEnabled`).
 */
export async function signInWithGoogle(next = "/dashboard"): Promise<{ error: Error | null }> {
  try {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    });
    return { error: (result.error as Error) ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}
