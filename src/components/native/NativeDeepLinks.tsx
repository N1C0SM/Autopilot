import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NATIVE_SCHEME } from "@/lib/authRedirect";

/**
 * Recupera la sesión cuando el usuario vuelve a la app desde un enlace
 * (`autopilot://auth-callback?...`): verificación de correo, recuperación de
 * contraseña y "Continuar con Apple".
 *
 * Cubre los dos casos:
 *  - app abierta en segundo plano → evento `appUrlOpen`
 *  - app cerrada (arranque en frío) → `App.getLaunchUrl()`
 *
 * En web no hace nada.
 */
const NativeDeepLinks = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cleanup: (() => void) | undefined;
    let handled = false;

    const closeBrowser = async () => {
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.close();
      } catch {
        /* el navegador seguro puede haberse cerrado solo */
      }
    };

    const handleUrl = async (rawUrl: string) => {
      if (!rawUrl || !rawUrl.startsWith(`${NATIVE_SCHEME}://`)) return;
      // Evita procesar dos veces el mismo enlace (launchUrl + appUrlOpen)
      if (handled) return;
      handled = true;
      setTimeout(() => {
        handled = false;
      }, 3000);

      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        return;
      }

      const query = new URLSearchParams(url.search);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const get = (key: string) => query.get(key) ?? hash.get(key);

      const errorDescription = get("error_description") || get("error");
      const code = get("code");
      const accessToken = get("access_token");
      const refreshToken = get("refresh_token");
      const tokenHash = get("token_hash");
      const type = get("type") || "";
      const rawNext = get("next") || "";
      const next = /^\/[^/]/.test(rawNext) ? rawNext : "";

      await closeBrowser();

      if (errorDescription) {
        toast.error("No se pudo completar el acceso. Inténtalo de nuevo.");
        navigate("/login", { replace: true });
        return;
      }

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "signup" | "recovery" | "email_change" | "magiclink" | "invite",
          });
          if (error) throw error;
        }
      } catch {
        toast.error("El enlace ha caducado o ya se ha usado. Pide uno nuevo.");
        navigate("/login", { replace: true });
        return;
      }

      if (type === "recovery") {
        navigate("/reset-password", { replace: true });
        return;
      }
      navigate(next || "/dashboard", { replace: true });
    };

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const sub = await App.addListener("appUrlOpen", ({ url }) => {
          void handleUrl(url);
        });
        cleanup = () => {
          void sub.remove();
        };
        const launch = await App.getLaunchUrl();
        if (launch?.url) void handleUrl(launch.url);
      } catch {
        /* plugin no disponible */
      }
    })();

    return () => cleanup?.();
  }, [navigate]);

  return null;
};

export default NativeDeepLinks;
