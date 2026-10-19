import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MailCheck, ShieldCheck } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import Screen from "@/components/native/Screen";
import PageHead from "@/components/PageHead";
import { AuthHero, AuthSymbol } from "@/components/auth/AuthScreenParts";
import { authSecondaryActionClass } from "@/components/auth/authFormHelpers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { track } from "@/lib/analytics";
import { verifyEmailRedirect } from "@/lib/authRedirect";
import { hapticNotify, hapticTap } from "@/lib/native";
import {
  clearSignupEmail,
  clearVerifyContext,
  readVerifyContext,
  saveSignupEmail,
  type VerifyContext,
} from "@/lib/signupVerification";
import { cn } from "@/lib/utils";

/** Mensaje en español para los errores de GoTrue al canjear el código. */
const verifyErrorMessage = (message?: string): string => {
  const normalized = (message || "").toLowerCase();
  if (normalized.includes("expired") || normalized.includes("invalid") || normalized.includes("token")) {
    return "El código no es válido o ha caducado. Pide uno nuevo.";
  }
  if (normalized.includes("too many") || normalized.includes("rate") || normalized.includes("429")) {
    return "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "No hemos podido verificar el código. Comprueba la conexión e inténtalo de nuevo.";
  }
  return "No hemos podido verificar el código. Pide uno nuevo o inténtalo más tarde.";
};

/**
 * Verificación de la cuenta con el código de 6 dígitos del correo.
 *
 * Es el camino principal tras `/signup`: mantener al usuario en la app
 * conserva el contexto de la pestaña (plan elegido, scan, quiz) y evita que el
 * enlace se abra en otro navegador o dispositivo. El enlace del correo sigue
 * funcionando como alternativa (`/auth/callback` web y deep link nativo).
 *
 * `initialCooldown` existe para poder probar el reenvío sin esperar 60 s.
 */
const VerifyEmail = ({ initialCooldown = 60 }: { initialCooldown?: number } = {}) => {
  const [context] = useState<VerifyContext | null>(() => readVerifyContext());
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  // Si viene del error de Login no acabamos de enviar nada: puede reenviar ya.
  const [cooldown, setCooldown] = useState(() => (context?.source === "login" ? 0 : initialCooldown));
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Sin contexto no hay nada que verificar: se vuelve al alta, que es donde se
  // guarda el email y el destino.
  useEffect(() => {
    if (!context) navigate("/signup", { replace: true });
  }, [context, navigate]);

  // Si ya hay sesión (por ejemplo, el usuario verificó por el enlace y volvió
  // atrás), no se le vuelve a pedir el código.
  useEffect(() => {
    if (context && user) navigate(context.next, { replace: true });
  }, [context, user, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!context || loading) return;
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) {
      setFormError("Introduce los 6 dígitos del código.");
      return;
    }
    setFormError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: context.email,
        token,
        type: "signup",
      });
      if (error) {
        setFormError(verifyErrorMessage(error.message));
        void hapticNotify("error");
        return;
      }
      clearVerifyContext();
      clearSignupEmail();
      track("verify_email", { method: "code", from: context.fromScan ? "scan" : "form" });
      void hapticNotify("success");
      navigate(context.next, { replace: true });
    } catch {
      setFormError("No hemos podido verificar el código. Comprueba la conexión e inténtalo de nuevo.");
      void hapticNotify("error");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!context || resending || cooldown > 0) return;
    void hapticTap();
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: context.email,
        options: { emailRedirectTo: verifyEmailRedirect(context.next) },
      });
      if (error) {
        void hapticNotify("error");
        toast.error("No hemos podido reenviar el código. Espera un momento y vuelve a intentarlo.");
      } else {
        setCooldown(60);
        void hapticNotify("success");
        toast.success("Código reenviado. Revisa tu correo.");
      }
    } catch {
      void hapticNotify("error");
      toast.error("No hemos podido reenviar el código.");
    } finally {
      setResending(false);
    }
  };

  const correctEmail = () => {
    void hapticTap();
    if (context) saveSignupEmail(context.email);
    clearVerifyContext();
    navigate("/signup", { replace: true });
  };

  if (!context) {
    return (
      <Screen hideBack centered maxWidth="sm" contentClassName="py-6">
        <PageHead
          title="Verifica tu correo · Autopilot"
          description="Introduce el código de verificación de tu cuenta."
          path="/verify-email"
          noindex
        />
        <div className="flex flex-col items-center gap-4 py-10 text-muted-foreground">
          <Spinner size="lg" />
          <p className="type-subhead">Volviendo al registro…</p>
        </div>
      </Screen>
    );
  }

  const footer = (
    <div className="space-y-3 pb-2">
      <Button
        type="submit"
        form="verify-form"
        size="lg"
        className={cn("w-full", loading && "disabled:opacity-100")}
        disabled={loading || code.replace(/\D/g, "").length !== 6}
      >
        {loading ? (
          <><Spinner size="sm" className="text-primary-foreground" aria-hidden="true" /> Verificando…</>
        ) : (
          "Verificar cuenta"
        )}
      </Button>
      <Button
        type="button"
        variant="plain"
        size="sm"
        className={cn(authSecondaryActionClass, "w-full")}
        onClick={correctEmail}
      >
        Corregir mi correo
      </Button>
      <p className="text-center type-footnote text-muted-foreground">
        ¿Ya verificaste?{" "}
        <Link
          to="/login"
          className="inline-flex min-h-11 items-center font-medium text-primary transition-opacity active:opacity-60"
          onClick={() => void hapticTap()}
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );

  return (
    <Screen
      onBack={correctEmail}
      centered
      maxWidth="sm"
      contentClassName="py-6"
      footer={footer}
    >
      <PageHead
        title="Introduce el código · Autopilot"
        description="Verifica tu cuenta con el código de 6 dígitos que te hemos enviado."
        path="/verify-email"
        noindex
      />

      <AuthHero
        mark={<AuthSymbol icon={MailCheck} />}
        title="Introduce el código"
        description={
          <>
            Te hemos enviado un código de 6 dígitos a{" "}
            <span className="break-all text-foreground">{context.email}</span>. Escríbelo aquí
            para activar tu cuenta.
          </>
        }
      />

      <form id="verify-form" onSubmit={submit} className="mt-8">
        <div className="flex items-center justify-center">
          <InputOTP
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={(value) => {
              setCode(value.replace(/\D/g, ""));
              setFormError(null);
            }}
            aria-label="Código de verificación de 6 dígitos"
            containerClassName="justify-center"
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="h-14 w-12 text-lg first:rounded-l-xl last:rounded-r-xl"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {formError ? (
          <p role="alert" className="mt-3 text-center type-footnote text-destructive">
            {formError}
          </p>
        ) : null}

        <p className="mx-auto mt-4 max-w-[34ch] text-center type-footnote text-muted-foreground">
          Revisa también la carpeta de spam. El código caduca a los pocos minutos.
        </p>

        <div className="mt-4 text-center">
          <Button
            type="button"
            variant="plain"
            size="sm"
            className={cn(authSecondaryActionClass, "tabular-nums")}
            disabled={resending || cooldown > 0}
            onClick={resend}
          >
            {resending ? "Reenviando…" : cooldown > 0 ? `Reenviar en ${cooldown} s` : "Reenviar código"}
          </Button>
        </div>

        <p className="mt-4 text-center type-footnote text-muted-foreground">
          ¿No ves ningún código? Abre el correo y pulsa «Confirmar email»: el enlace también
          activa tu cuenta.
        </p>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-center type-footnote text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Tu cuenta no se activa hasta que verifiques el correo.
        </p>
      </form>
    </Screen>
  );
};

export default VerifyEmail;
