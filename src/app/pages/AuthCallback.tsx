import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import Screen from "@/shared/components/native/Screen";
import { supabase } from "@/shared/integrations/supabase/client";
import { AuthHero, AuthSymbol } from "@/app/components/auth/AuthScreenParts";
import { authSecondaryActionClass } from "@/app/components/auth/authFormHelpers";
import { hapticNotify, hapticTap } from "@/shared/lib/native";
import { track } from "@/shared/lib/analytics";
import { safeNextPath } from "@/shared/lib/signupVerification";
import { MailCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/**
 * `/auth/callback`: convierte el enlace de verificación de correo en una sesión.
 *
 * Este proyecto usa flujo implícito (`flowType: 'implicit'`), así que Supabase
 * devuelve los tokens en el *fragmento* (`#access_token=...&refresh_token=...`),
 * no en la query. `useSearchParams` no lee el fragmento, por eso aquí se parsea
 * `window.location` a mano igual que hace `NativeDeepLinks` en la app nativa.
 *
 * Sin esta ruta, el navegador recibía el enlace pero nadie lo canjeaba: el
 * usuario quedaba sin sesión y tenía que volver a iniciar sesión a mano.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const exchanged = useRef(false);

  useEffect(() => {
    // El efecto puede volver a ejecutarse en React 18 dev; el canje es único.
    if (exchanged.current) return;
    exchanged.current = true;

    const run = async () => {
      // Query y fragmento leídos juntos: el flujo implícito deja los tokens aquí.
      const url = new URL(window.location.href);
      const query = url.searchParams;
      const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
      const param = (key: string) => query.get(key) ?? fragment.get(key);

      const code = param("code");
      const tokenHash = param("token_hash");
      const accessToken = param("access_token");
      const refreshToken = param("refresh_token");
      const type = param("type") || "signup";
      const next = safeNextPath(param("next"), "/onboarding-choice");
      const providerError = param("error_description") || param("error");

      let error: { message: string } | null = null;
      if (accessToken && refreshToken) {
        // Flujo implícito (el real en producción): el enlace ya trae la sesión.
        ({ error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }));
      } else if (tokenHash) {
        // Enlace de tipo «token_hash» (magic link / recovery / signup explícito).
        ({ error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "signup" | "recovery" | "magiclink" | "email",
        }));
      } else if (code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(code));
      }

      // Red de seguridad: si `detectSessionInUrl` ya montó la sesión al cargar
      // la página, no importa el formato exacto del enlace, entramos igual.
      if (!error) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && !accessToken && !tokenHash && !code) {
          error = new Error("El enlace de verificación no es válido o está incompleto.");
        }
      }

      if (error) {
        // El enlace puede haber quedado inutilizado porque la cuenta ya se
        // verificó con el código de 6 dígitos. Si la sesión existe, entramos.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate(next, { replace: true });
          return;
        }
        void hapticNotify("error");
        setErrorMessage(
          providerError ||
            (error.message?.includes("flow_state") || error.message?.includes("expired") || error.message?.includes("otp_expired")
              ? "Este enlace ha caducado. Pide uno nuevo y ábrelo de nuevo."
              : "No hemos podido verificar tu correo. Pide un enlace nuevo o inicia sesión si ya lo habías confirmado."),
        );
        setStatus("error");
        return;
      }

      void hapticNotify("success");
      track("verify_email", { method: "link" });
      // Sustituye el callback por el destino para que «atrás» no vuelva al canje.
      navigate(next, { replace: true });
    };

    void run();
  }, [navigate]);

  if (status === "working") {
    return (
      <Screen hideBack centered maxWidth="sm" contentClassName="py-6">
        <PageHeadStub />
        <div className="flex flex-col items-center gap-4 py-10 text-muted-foreground">
          <Spinner size="lg" />
          <p className="type-subhead">Verificando tu correo…</p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen hideBack centered maxWidth="sm" contentClassName="py-6">
      <PageHeadStub />
      <AuthHero
        mark={<AuthSymbol icon={TriangleAlert} />}
        title="No hemos podido verificar"
        description={errorMessage || "El enlace de verificación no funciona."}
      />
      <div className="mt-6 space-y-3">
        <Button asChild size="lg" className="w-full">
          <Link to="/login" onClick={() => void hapticTap()}>Iniciar sesión</Link>
        </Button>
        <Button asChild variant="plain" size="sm" className={cn(authSecondaryActionClass, "w-full")}>
          <Link to="/signup" onClick={() => void hapticTap()}>Crear una cuenta</Link>
        </Button>
      </div>
    </Screen>
  );
};

/** Título de pestaña mientras se canjea el código; sin meta indexables. */
const PageHeadStub = () => (
  <Helmet>
    <title>Verificando tu correo · Autopilot</title>
    <meta name="robots" content="noindex,nofollow" />
  </Helmet>
);

export default AuthCallback;
