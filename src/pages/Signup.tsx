import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import Screen from "@/components/native/Screen";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, Gift, Sparkles, Camera } from "lucide-react";
import { AppleSignInButton } from "@/components/auth/AppleSignInButton";
import { AuthAppMark, AuthFieldGroup, AuthFieldNote, AuthFieldRow, AuthHero, AuthImage, AuthNotice } from "@/components/auth/AuthScreenParts";
import { authFieldInputClass, authSecondaryActionClass, focusNextOnEnter, hideWithKeyboardClass } from "@/components/auth/authFormHelpers";
import { useAuth } from "@/contexts/AuthContext";
import { track } from "@/lib/analytics";
import { postVerificationPath, readSignupEmail, readVerifyContext, saveSignupEmail, saveVerifyContext } from "@/lib/signupVerification";
import { signInWithApple } from "@/lib/nativeAuth";
import { usePlanAvailability } from "@/lib/planCatalog";
import { readAnonScanId } from "@/lib/scanAttribution";
import { appleSignInEnabled } from "@/lib/platform";
import { hapticNotify, hapticSelection, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";

const Signup = () => {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const emailCheck = useRef(0);
  const navigate = useNavigate();
  const referralCode = searchParams.get("ref") || "";
  const isFree = searchParams.get("free") === "true";
  const fromQuiz = searchParams.get("from") === "quiz";
  const fromScan = searchParams.get("from") === "scan";
  const planParam = (searchParams.get("plan") || "").toLowerCase();
  const nextParam = searchParams.get("next");
  const plans = usePlanAvailability();
  // A Coach link from an old email or ad falls back to Plus while Coach is hidden in Admin.
  const selectedPlan: "training" | "full" | null =
    isFree ? null : planParam === "training" ? "training" : planParam === "full" ? (plans.coach ? "full" : "training") : null;
  const [scanCtx, setScanCtx] = useState<{ currentImg?: string; result?: { potential: number; improvements?: unknown[] } } | null>(null);
  const { signUp } = useAuth();

  useEffect(() => {
    try {
      if (isFree) sessionStorage.removeItem("autopilot_selected_plan");
      else if (selectedPlan) sessionStorage.setItem("autopilot_selected_plan", selectedPlan);
    } catch { /* Best-effort browser feature; the primary flow remains available. */ }
  }, [isFree, selectedPlan]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("autopilot_scan");
      const p = raw ? JSON.parse(raw) : null;
      if (p?.leadName) setName((v) => v || p.leadName);
      if (p?.leadEmail) setEmail((v) => v || p.leadEmail);
    } catch { /* Best-effort browser feature; the primary flow remains available. */ }
    const savedEmail = readSignupEmail();
    if (savedEmail) setEmail((value) => value || savedEmail);
  }, []);

  // Si esta pestaña tiene una verificación pendiente (por ejemplo, el usuario
  // recargó o volvió atrás desde el correo), el formulario no sirve: el email
  // ya está "tomado" por su propia cuenta sin verificar. Le llevamos al código.
  useEffect(() => {
    const pending = readVerifyContext();
    if (pending) navigate("/verify-email", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!fromScan) return;
    try {
      const raw = sessionStorage.getItem("autopilot_scan");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Expira a las 24h
      if (Date.now() - (parsed.createdAt || 0) > 24 * 60 * 60 * 1000) {
        sessionStorage.removeItem("autopilot_scan");
        return;
      }
      setScanCtx(parsed);
    } catch { /* Best-effort browser feature; the primary flow remains available. */ }
  }, [fromScan]);

  const checkEmail = async (value: string) => {
    if (!value.trim()) return;
    const requestId = ++emailCheck.current;
    setCheckingEmail(true);
    try {
      const { data } = await supabase.functions.invoke("check-availability", { body: { email: value.trim() } });
      if (requestId === emailCheck.current) setEmailTaken(!!data?.emailTaken);
    } catch {
      // Availability is advisory; signup still validates the email on the server.
    } finally {
      if (requestId === emailCheck.current) setCheckingEmail(false);
    }
  };

  const fail = (message: string) => {
    setFormError(message);
    void hapticNotify("error");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    void hapticTap();
    setFormError(null);
    if (emailTaken) {
      // The note under the fields already says why.
      void hapticNotify("error");
      return;
    }
    if (!name.trim()) {
      fail("El nombre es obligatorio.");
      return;
    }
    setLoading(true);

    try {
      // Final server-side check
      const { data: avail } = await supabase.functions.invoke("check-availability", {
        body: { email: email.trim() },
      });
      if (avail?.emailTaken) {
        setEmailTaken(true);
        void hapticNotify("error");
        setLoading(false);
        return;
      }

      const anonScanId = readAnonScanId();
      // Quien viene del quiz ya respondió el cuestionario: tras verificar vuelve
      // al configurador, no a la pantalla de elección scan/formulario.
      const nextAfterVerify = postVerificationPath(nextParam ?? (fromQuiz ? "/onboarding" : null), fromScan);
      const { error } = await signUp(email.trim(), password, {
        display_name: name.trim(),
        referral_code: referralCode,
        is_free: isFree ? "true" : "false",
        selected_plan: selectedPlan || "",
        // Atribuye a la cuenta las tarjetas de escaneo subidas sin sesión desde
        // esta pestaña, para poder borrarlas al eliminar la cuenta (RGPD art. 17).
        ...(anonScanId ? { anon_scan_id: anonScanId } : {}),
      }, { next: nextAfterVerify });
      if (error) {
        fail(error.message);
        setLoading(false);
        return;
      }

      // La verificación ya no exige salir de la app: el código de 6 dígitos se
      // introduce en /verify-email y el contexto de esta pestaña se conserva
      // (plan elegido, scan, quiz).
      saveVerifyContext({ email: email.trim(), next: nextAfterVerify, fromScan, source: "signup" });
      saveSignupEmail(email.trim());
      track("register", { from: fromQuiz ? "quiz" : fromScan ? "scan" : "direct", plan: isFree ? "free" : selectedPlan || undefined });
      void hapticNotify("success");
      navigate("/verify-email", { replace: true });
    } catch {
      fail("No hemos podido crear tu cuenta. Comprueba tu conexión y vuelve a intentarlo.");
    } finally {
      setLoading(false);
    }
  };

  const fieldError = emailTaken ? "Este correo ya está registrado." : formError;

  const footer = (
    <div className="space-y-3 pb-2">
      <Button
        type="submit"
        form="signup-form"
        size="lg"
        className={cn("w-full", loading && "disabled:opacity-100")}
        disabled={loading || emailTaken}
      >
        {loading ? (
          <><Spinner size="sm" className="text-primary-foreground" aria-hidden="true" /> Creando cuenta…</>
        ) : (
          isFree ? "Crear cuenta gratis" : "Crear cuenta"
        )}
      </Button>
      {appleSignInEnabled() && (
        <AppleSignInButton
          label="sign-up"
          onClick={async () => {
            if (selectedPlan) {
              try { sessionStorage.setItem("autopilot_selected_plan", selectedPlan); } catch { /* Best-effort browser feature; the primary flow remains available. */ }
            }
            const result = await signInWithApple("/onboarding-choice");
            if (result.error) { void hapticNotify("error"); toast.error("No se pudo continuar con Apple"); }
          }}
        />
      )}
      <Button asChild variant="plain" size="sm" className={cn(authSecondaryActionClass, hideWithKeyboardClass)}>
        <Link to="/login" onClick={() => void hapticTap()}>Ya tengo cuenta</Link>
      </Button>
      <p className="text-center type-footnote text-muted-foreground">
        Al crear una cuenta aceptas nuestros{" "}
        <Link to="/legal/terminos" className="underline underline-offset-2 active:opacity-60">términos</Link>
        {" y la "}
        <Link to="/legal/privacidad" className="underline underline-offset-2 active:opacity-60">política de privacidad</Link>.
      </p>
    </div>
  );

  const hasNotices = (fromScan && Boolean(scanCtx?.result)) || fromQuiz || (Boolean(referralCode) && !isFree);

  return (
    <Screen onBack={() => navigate("/")} centered maxWidth="sm" contentClassName="py-6" footer={footer}>
      <Helmet>
        <title>Crear cuenta · Autopilot</title>
        <meta name="description" content="Crea tu cuenta gratis, empieza tu rutina y registra tu progreso. Sin tarjeta para empezar." />
        <link rel="canonical" href="https://autopilotplan.com/signup" />
        <meta property="og:title" content="Crear cuenta · Autopilot" />
        <meta property="og:description" content="Rutina inicial y registro de progreso gratis. Sin tarjeta para empezar." />
        <meta property="og:url" content="https://autopilotplan.com/signup" />
      </Helmet>

      <AuthHero
        mark={<AuthAppMark />}
        title="Crea tu cuenta"
        description={
          isFree
            ? "Gratis, sin tarjeta. Prueba una sesión desde el móvil."
            : fromQuiz
            ? "Último paso para desbloquear tu plan."
            : fromScan
            ? "Último paso para desbloquear tu AI Report y plan completo."
            : "Empieza hoy."
        }
      />

      {hasNotices && (
        <div className="mt-8 space-y-6">
          {fromScan && scanCtx?.result && (
            <AuthNotice
              icon={
                <AuthImage
                  src={scanCtx.currentImg}
                  alt="Tu scan"
                  className="h-10 w-10 rounded-[10px] object-cover"
                  fallback={<Camera strokeWidth={1.75} />}
                />
              }
              title="Tu AI Report está reservado"
            >
              <p>
                Potencial <span className="tabular-nums text-foreground">{scanCtx.result.potential.toFixed(1)}/10</span> · {scanCtx.result.improvements?.length || 0} mejoras detectadas
              </p>
              <p className="mt-1">7 días de prueba · no se cobra hasta el día 8 · cancelas cuando quieras</p>
            </AuthNotice>
          )}

          {fromQuiz && (
            <AuthNotice icon={<Sparkles strokeWidth={1.75} />} title="Tu plan personalizado está reservado">
              7 días de prueba · se pide tarjeta al contratar, no se cobra hasta el día 8
            </AuthNotice>
          )}

          {referralCode && !isFree && <AuthNotice icon={<Gift strokeWidth={1.75} />} title="Invitación aplicada" />}
        </div>
      )}

      <form id="signup-form" onSubmit={handleSubmit} className={hasNotices ? "mt-8" : "mt-10"}>
        <AuthFieldGroup
          footer={
            <>
              {fieldError ? <AuthFieldNote id="signup-error" tone="error">{fieldError}</AuthFieldNote> : null}
              {isFree ? (
                <AuthFieldNote>Sin tarjeta ni prueba que cancelar. El seguimiento de un entrenador es opcional y de pago.</AuthFieldNote>
              ) : null}
            </>
          }
        >
          <AuthFieldRow label="Tu nombre" htmlFor="name">
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setFormError(null); }}
              required
              autoCapitalize="words"
              autoComplete="given-name"
              enterKeyHint="next"
              onKeyDown={focusNextOnEnter("email")}
              className={authFieldInputClass()}
              placeholder="Nombre"
            />
          </AuthFieldRow>
          <AuthFieldRow
            label="Correo electrónico"
            htmlFor="email"
            trailing={checkingEmail ? <Spinner size="sm" label="Verificando correo" className="mr-4" /> : null}
          >
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => { emailCheck.current++; setCheckingEmail(false); setEmail(e.target.value); setEmailTaken(false); setFormError(null); }}
              onBlur={() => void checkEmail(email)}
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              onKeyDown={focusNextOnEnter("password")}
              required
              aria-invalid={emailTaken || undefined}
              aria-describedby={fieldError ? "signup-error" : undefined}
              className={authFieldInputClass(checkingEmail)}
              placeholder="Correo electrónico"
            />
          </AuthFieldRow>
          <AuthFieldRow
            label="Contraseña"
            htmlFor="password"
            trailing={
              <button
                type="button"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground transition-opacity active:opacity-60"
                onClick={() => { void hapticSelection(); setShowPassword(value => !value); }}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            }
          >
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFormError(null); }}
              required
              minLength={6}
              aria-describedby={fieldError ? "signup-error" : undefined}
              className={authFieldInputClass(true)}
              placeholder="Contraseña, mínimo 6 caracteres"
            />
          </AuthFieldRow>
        </AuthFieldGroup>
      </form>

      {!fromQuiz && (
        <p className="mt-6 text-center type-subhead text-muted-foreground">
          ¿Aún no has configurado tu plan?{" "}
          <Link to="/onboarding-choice" onClick={() => void hapticTap()} className="inline-flex min-h-11 items-center font-medium text-primary transition-opacity active:opacity-60">
            Diséñalo gratis
          </Link>
        </p>
      )}
    </Screen>
  );
};

export default Signup;
