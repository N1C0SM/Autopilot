import AppStoreBadges from "@/components/AppStoreBadges";
import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail, Eye, EyeOff, ChevronLeft } from "lucide-react";
import { AppleSignInButton } from "@/components/auth/AppleSignInButton";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Zap } from "lucide-react";
import { track } from "@/lib/analytics";
import { authRedirect } from "@/lib/authRedirect";
import { signInWithApple } from "@/lib/nativeAuth";
import { usePlanAvailability } from "@/lib/planCatalog";
import { readAnonScanId } from "@/lib/scanAttribution";
import { appleSignInEnabled } from "@/lib/platform";
import { hapticTap } from "@/lib/native";

const Signup = () => {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const emailCheck = useRef(0);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);
  const referralCode = searchParams.get("ref") || "";
  const isFree = searchParams.get("free") === "true";
  const fromQuiz = searchParams.get("from") === "quiz";
  const fromScan = searchParams.get("from") === "scan";
  const planParam = (searchParams.get("plan") || "").toLowerCase();
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
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    void hapticTap();
    if (emailTaken) {
      toast.error("Corrige los campos marcados antes de continuar");
      return;
    }
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
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
        toast.error("Ese correo ya está registrado");
        setLoading(false);
        return;
      }

      const anonScanId = readAnonScanId();
      const { error } = await signUp(email.trim(), password, {
        display_name: name.trim(),
        referral_code: referralCode,
        is_free: isFree ? "true" : "false",
        selected_plan: selectedPlan || "",
        // Atribuye a la cuenta las tarjetas de escaneo subidas sin sesión desde
        // esta pestaña, para poder borrarlas al eliminar la cuenta (RGPD art. 17).
        ...(anonScanId ? { anon_scan_id: anonScanId } : {}),
      });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      // Email verification required — show confirmation screen
      track("register", { from: fromQuiz ? "quiz" : fromScan ? "scan" : "direct", plan: isFree ? "free" : selectedPlan || undefined });
      setResendCooldown(60);
      setEmailSent(true);
    } catch {
      toast.error("No hemos podido crear tu cuenta. Comprueba tu conexión y vuelve a intentarlo.");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <Mail className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold font-display">Verifica tu correo</h1>
          <p className="text-muted-foreground text-sm">
            Te hemos enviado un enlace de verificación a <span className="text-foreground font-medium">{email}</span>. 
            Haz clic en él para activar tu cuenta.
          </p>
          <p className="text-xs text-muted-foreground">Revisa también la carpeta de spam. El enlace te llevará a preparar tu rutina.</p>
          <Button variant="outline" disabled={resending || resendCooldown > 0} onClick={async () => {
            setResending(true);
            try {
              const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: authRedirect("/onboarding") } });
              if (error) toast.error("No se ha podido reenviar. Espera un momento y vuelve a intentarlo.");
              else { setResendCooldown(60); toast.success("Enlace reenviado. Revisa tu correo."); }
            } catch { toast.error("No se ha podido reenviar el correo."); }
            finally { setResending(false); }
          }}>{resending ? "Reenviando…" : resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Reenviar enlace"}</Button>
          <button type="button" className="block mx-auto text-sm underline underline-offset-4" onClick={() => setEmailSent(false)}>Corregir mi correo</button>
          <Link to="/login" className="text-primary hover:underline text-sm block mt-4">Ya lo he verificado: iniciar sesión</Link>
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 space-y-3">
            <p className="font-semibold">Llévate tu plan al gimnasio</p>
            <p className="text-sm text-muted-foreground">Puedes usar Autopilot desde la web o descargar la app para registrar series y descansos desde el móvil.</p>
            <AppStoreBadges size="compact" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center bg-background px-4 py-12"
      style={{ paddingTop: "calc(var(--safe-top, 0px) + 3rem)", paddingBottom: "calc(var(--safe-bottom, 0px) + 3rem)" }}
    >
      <Link
        to="/"
        onClick={() => { void hapticTap(); }}
        aria-label="Volver a Bienvenido"
        className="absolute left-3 inline-flex items-center gap-0.5 h-10 pl-1 pr-2.5 rounded-full text-foreground/85 transition-colors active:bg-secondary/60 no-underline"
        style={{ top: "calc(var(--safe-top, 0px) + 12px)" }}
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="text-[15px] font-medium">Atrás</span>
      </Link>
      <Helmet>
        <title>Crear cuenta · Autopilot</title>
        <meta name="description" content="Crea tu cuenta gratis, empieza tu rutina y registra tu progreso. Sin tarjeta para empezar." />
        <link rel="canonical" href="https://autopilotplan.com/signup" />
        <meta property="og:title" content="Crear cuenta · Autopilot" />
        <meta property="og:description" content="Rutina inicial y registro de progreso gratis. Sin tarjeta para empezar." />
        <meta property="og:url" content="https://autopilotplan.com/signup" />
      </Helmet>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="mx-auto w-16 h-16 rounded-[22%] bg-background border border-primary/20 flex items-center justify-center shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.4)]">
            <svg viewBox="0 0 100 100" aria-hidden="true" className="w-[62%] h-[62%] text-primary" fill="none">
              <path d="M14 86 L50 14 L86 86" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M56 46 L36 66 L48 66 L44 86 L62 60 L50 60 L55 46 Z" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-[28px] font-bold font-display mt-6 tracking-[-0.03em] leading-[1.1]">Crea tu cuenta</h1>
          <p className="text-muted-foreground text-[15px] mt-2 leading-snug">
            {isFree
              ? "Gratis, sin tarjeta. Prueba una sesión desde el móvil."
              : fromQuiz
              ? "Último paso para desbloquear tu plan."
              : fromScan
              ? "Último paso para desbloquear tu AI Report y plan completo."
               : "Empieza hoy."}
          </p>
          {!fromQuiz && (
            <Link to="/onboarding" className="mt-5 inline-flex items-center gap-1.5 text-[14px] text-primary font-medium">
              ¿Aún no has configurado tu plan? Diséñalo gratis →
            </Link>
          )}
        </div>

        {isFree && (
          <p className="mb-5 text-center text-sm text-muted-foreground">
            Sin tarjeta ni prueba que cancelar. El seguimiento de un entrenador es opcional y de pago.
          </p>
        )}

        {fromScan && scanCtx?.result && (
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
            {scanCtx.currentImg && (
              <img loading="lazy" decoding="async"
                src={scanCtx.currentImg}
                alt="Tu scan"
                className="w-14 h-14 rounded-xl object-cover border border-primary/40 flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-primary font-medium flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Tu AI Report está reservado
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Potencial <span className="font-bold text-foreground">{scanCtx.result.potential.toFixed(1)}/10</span> · {scanCtx.result.improvements?.length || 0} mejoras detectadas
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                7 días de prueba · no se cobra hasta el día 8 · cancelas cuando quieras
              </p>
            </div>
          </div>
        )}

        {fromQuiz && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 mb-4 text-center">
            <p className="text-sm text-primary font-medium flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Tu plan personalizado está reservado
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              7 días de prueba · se pide tarjeta al contratar, no se cobra hasta el día 8
            </p>
          </div>
        )}

        {referralCode && !isFree && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 mb-4 text-center">
            <p className="text-sm text-primary font-medium">🎁 ¡Invitación aplicada!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Tu nombre</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-12 bg-secondary border-0 text-[16px]"
              autoComplete="given-name"
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { emailCheck.current++; setCheckingEmail(false); setEmail(e.target.value); setEmailTaken(false); }}
              onBlur={() => void checkEmail(email)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              className={`h-12 bg-secondary border-0 text-[16px] ${emailTaken ? "ring-1 ring-destructive" : ""}`}
              placeholder="tu@ejemplo.com"
            />
            {checkingEmail && <p className="text-xs text-muted-foreground mt-1.5">Verificando…</p>}
            {emailTaken && <p className="text-xs text-destructive mt-1.5">Este correo ya está registrado</p>}
          </div>
          <div>
            <Label htmlFor="password" className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Contraseña</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 bg-secondary border-0 text-[16px] pr-12" placeholder="Mínimo 6 caracteres" minLength={6} />
              <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-muted-foreground" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>

          <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading || emailTaken}>
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Procesando...</>
            ) : (
              isFree ? "Crear cuenta gratis" : "Crear cuenta"
            )}
          </Button>
          {appleSignInEnabled() && (
            <>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider"><span className="bg-card px-2 text-muted-foreground">o</span></div>
              </div>
              <AppleSignInButton
                label="sign-up"
                onClick={async () => {
                  if (selectedPlan) {
                    try { sessionStorage.setItem("autopilot_selected_plan", selectedPlan); } catch { /* Best-effort browser feature; the primary flow remains available. */ }
                  }
                  const result = await signInWithApple("/onboarding");
                  if (result.error) toast.error("No se pudo continuar con Apple");
                }}
              />
            </>
          )}
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta? <Link to="/login" className="text-primary hover:underline">Inicia sesión</Link>
          </p>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Al crear una cuenta aceptas nuestros{" "}
          <Link to="/legal/terminos" className="hover:text-foreground underline">Términos</Link>
          {" y "}
          <Link to="/legal/privacidad" className="hover:text-foreground underline">Política de privacidad</Link>.
        </p>
      </div>
    </div>
  );
};

export default Signup;
