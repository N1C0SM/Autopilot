import AppStoreBadges from "@/components/AppStoreBadges";
import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail, Apple, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Zap } from "lucide-react";
import { track } from "@/lib/analytics";
import { authRedirect } from "@/lib/authRedirect";
import { signInWithApple } from "@/lib/nativeAuth";

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
  const selectedPlan: "training" | "full" | null =
    isFree ? null : planParam === "training" ? "training" : planParam === "full" ? "full" : null;
  const [scanCtx, setScanCtx] = useState<any>(null);
  const { signUp } = useAuth();

  useEffect(() => {
    try {
      if (isFree) sessionStorage.removeItem("autopilot_selected_plan");
      else if (selectedPlan) sessionStorage.setItem("autopilot_selected_plan", selectedPlan);
    } catch {}
  }, [isFree, selectedPlan]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("autopilot_scan");
      const p = raw ? JSON.parse(raw) : null;
      if (p?.leadName) setName((v) => v || p.leadName);
      if (p?.leadEmail) setEmail((v) => v || p.leadEmail);
    } catch {}
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
    } catch {}
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

      const { error } = await signUp(email.trim(), password, {
        display_name: name.trim(),
        referral_code: referralCode,
        is_free: isFree ? "true" : "false",
        selected_plan: selectedPlan || "",
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Helmet>
        <title>Crear cuenta · Autopilot</title>
        <meta name="description" content="Crea tu cuenta gratis, empieza tu rutina y registra tu progreso. Sin tarjeta. Entrenador opcional." />
        <link rel="canonical" href="https://autopilotplan.com/signup" />
        <meta property="og:title" content="Crear cuenta · Autopilot" />
        <meta property="og:description" content="Rutina inicial y registro de progreso gratis. Añade seguimiento de entrenador cuando lo necesites." />
        <meta property="og:url" content="https://autopilotplan.com/signup" />
      </Helmet>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-display text-2xl font-bold text-gradient">Autopilot</Link>
          {!fromQuiz && (
            <Link to="/onboarding" className="mt-6 block rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
              ¿Aún no has configurado tu plan? <span className="font-semibold text-primary underline">Diséñalo en 1 minuto gratis</span>
            </Link>
          )}
          <h1 className="text-2xl font-bold font-display mt-6 mb-2">Crea tu cuenta</h1>
          <p className="text-muted-foreground text-sm">
            {isFree
              ? "Crea tu cuenta gratis y prueba una sesión desde el móvil"
              : fromQuiz
              ? "Último paso para desbloquear tu plan"
              : fromScan
              ? "Último paso para desbloquear tu AI Report y plan completo"
               : "Empieza hoy"}
          </p>
        </div>

        {isFree && (
          <p className="mb-5 text-center text-sm text-muted-foreground">
            Sin tarjeta ni prueba que cancelar. El seguimiento de un entrenador es opcional y de pago.
          </p>
        )}

        {fromScan && scanCtx?.result && (
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
            {scanCtx.currentImg && (
              <img
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
                7 días gratis · Sin tarjeta · Cancelas cuando quieras
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
              7 días gratis · Sin tarjeta para empezar
            </p>
          </div>
        )}

        {referralCode && !isFree && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 mb-4 text-center">
            <p className="text-sm text-primary font-medium">🎁 ¡Invitación aplicada!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-8 border border-border card-shadow space-y-5">
          <div>
            <Label htmlFor="name">Tu nombre</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1.5"
              autoComplete="given-name"
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <Label htmlFor="email">Correo electrónico</Label>
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
              className={`mt-1.5 ${emailTaken ? "border-destructive" : ""}`}
              placeholder="tu@ejemplo.com"
            />
            {checkingEmail && <p className="text-xs text-muted-foreground mt-1">Verificando...</p>}
            {emailTaken && <p className="text-xs text-destructive mt-1">Este correo ya está registrado</p>}
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative mt-1.5">
              <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-12" placeholder="Mínimo 6 caracteres" minLength={6} />
              <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-muted-foreground" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>

          <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading || emailTaken}>
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Procesando...</>
            ) : (
              isFree ? "Crear cuenta gratis" : "Crear cuenta"
            )}
          </Button>
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider"><span className="bg-card px-2 text-muted-foreground">o</span></div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={async () => {
               if (selectedPlan) {
                 try { sessionStorage.setItem("autopilot_selected_plan", selectedPlan); } catch {}
               }
              const result = await signInWithApple("/onboarding");
              if (result.error) toast.error("No se pudo continuar con Apple");
            }}
          >
            <Apple className="w-4 h-4 mr-2" /> Continuar con Apple
          </Button>
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
