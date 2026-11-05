import { listAccounts, openAccountPicker, setRequirePassword } from "@/shared/lib/accounts";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Spinner } from "@/shared/components/ui/spinner";
import Screen from "@/shared/components/native/Screen";
import { useAuth } from "@/shared/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/shared/integrations/supabase/client";
import { signInWithApple } from "@/shared/lib/nativeAuth";
import { AppleSignInButton } from "@/app/components/auth/AppleSignInButton";
import { AuthAppMark, AuthFieldGroup, AuthFieldNote, AuthFieldRow, AuthHero, AuthImage } from "@/app/components/auth/AuthScreenParts";
import { authFieldInputClass, authSecondaryActionClass, focusNextOnEnter, hideWithKeyboardClass } from "@/app/components/auth/authFormHelpers";
import { appleSignInEnabled, supportsMultipleAccounts } from "@/shared/lib/platform";
import { hapticNotify, hapticTap } from "@/shared/lib/native";
import { clearVerifyContext, saveSignupEmail, saveVerifyContext } from "@/shared/lib/signupVerification";
import { cn } from "@/shared/lib/utils";

const swap = { type: "spring", stiffness: 380, damping: 36 } as const;

const Login = () => {
  const [email, setEmail] = useState(() => {
    // Volver a entrar en una cuenta guardada: el correo llega ya escrito.
    const fromLink = new URLSearchParams(window.location.search).get("email");
    if (fromLink) return fromLink;
    try { return JSON.parse(localStorage.getItem("autopilot:last-login") || "null")?.id || ""; } catch { return ""; }
  });
  const [password, setPassword] = useState("");
  // Con otra cuenta ya guardada en el dispositivo se puede proteger esta con contraseña.
  const [offerLock] = useState(() => supportsMultipleAccounts() && listAccounts().length > 0);
  const [lockAccount, setLockAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Si las credenciales son correctas pero el correo no está verificado, se
  // ofrece introducir el código de 6 dígitos sin salir de la app.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawNext = searchParams.get("next") || "";
  const nextPath = /^\/[^/]/.test(rawNext) && !rawNext.startsWith("//") ? rawNext : "";

  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  // Último usuario de ESTE dispositivo: la foto solo se muestra si ya entró aquí antes.
  const [remembered, setRemembered] = useState<{ id: string; name: string; avatar: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem("autopilot:last-login") || "null"); } catch { return null; }
  });
  const known = remembered && email.trim() && email.trim().toLowerCase() === remembered.id.toLowerCase() ? remembered : null;

  const handleApple = async () => {
    const result = await signInWithApple(nextPath || "/dashboard");
    if (result.error) {
      void hapticNotify("error");
      toast.error("No se pudo iniciar sesión con Apple");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    void hapticTap();
    setFormError(null);
    setLoading(true);

    const cleaned = email.trim();
    if (!cleaned) { setLoading(false); return; }

    let error: Error | null = null;
    if (isEmail(cleaned)) {
      ({ error } = await signIn(cleaned, password));
    } else {
      const { data, error: fnError } = await supabase.functions.invoke("login-identifier", { body: { identifier: cleaned, password } });
      if (fnError || !data?.access_token) {
        let code = "invalid_credentials";
        try { code = (await (fnError as { context?: Response })?.context?.json())?.error || code; } catch { /* noop */ }
        error = new Error(code === "email_not_confirmed" ? "Email not confirmed" : code);
      } else {
        const { error: sessionError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
        error = sessionError;
      }
    }
    setLoading(false);
    if (error) {
      void hapticNotify("error");
      if (error.message.includes("Email not confirmed")) {
        setFormError("Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada (o spam) o introduce el código de verificación.");
        setUnconfirmedEmail(isEmail(cleaned) ? cleaned : null);
      } else if (error.message === "rate_limited") {
        setFormError("Demasiados intentos. Espera un minuto.");
      } else {
        setFormError("Usuario o contraseña incorrectos.");
      }
    } else {
      // Si había una verificación pendiente de otra cuenta, ya no aplica.
      clearVerifyContext();
      // Resolve destination based on role
      const { data: { user: authedUser } } = await supabase.auth.getUser();
      if (authedUser) {
        if (offerLock) setRequirePassword(authedUser.id, lockAccount);
        const { data: prof } = await supabase.from("profiles").select("name, avatar_url").eq("user_id", authedUser.id).maybeSingle();
        const memo = { id: cleaned, name: prof?.name || "", avatar: prof?.avatar_url || "" };
        try { localStorage.setItem("autopilot:last-login", JSON.stringify(memo)); } catch { /* noop */ }
        if (nextPath) { navigate(nextPath); return; }
        const [{ data: isAdmin }, { data: isTrainer }] = await Promise.all([
          supabase.rpc("has_role", { _user_id: authedUser.id, _role: "admin" }),
          supabase.rpc("has_role", { _user_id: authedUser.id, _role: "trainer" }),
        ]);
        if (isAdmin) navigate("/admin");
        else if (isTrainer) navigate("/trainer");
        else navigate("/dashboard");
      } else {
        navigate("/dashboard");
      }
    }
  };

  const openVerification = () => {
    if (!unconfirmedEmail) return;
    void hapticTap();
    saveSignupEmail(unconfirmedEmail);
    saveVerifyContext({ email: unconfirmedEmail, next: nextPath || "/onboarding-choice", fromScan: false, source: "login" });
    navigate("/verify-email");
  };

  const forget = () => {
    void hapticTap();
    localStorage.removeItem("autopilot:last-login");
    setRemembered(null);
    setEmail("");
  };

  const footer = (
    <div className="space-y-3 pb-2">
      <Button
        type="submit"
        form="login-form"
        size="lg"
        className={cn("w-full rounded-full", loading && "disabled:opacity-100")}
        disabled={loading}
      >
        {loading ? <><Spinner size="sm" className="text-primary-foreground" aria-hidden="true" /> Iniciando sesión…</> : "Iniciar sesión"}
      </Button>
      {appleSignInEnabled() && <AppleSignInButton label="sign-in" onClick={handleApple} />}
      <div className={hideWithKeyboardClass}>
        <Button asChild variant="plain" size="sm" className={authSecondaryActionClass}>
          <Link to="/onboarding" onClick={() => void hapticTap()}>Crear una cuenta gratis</Link>
        </Button>
        <p className="flex justify-center type-footnote text-muted-foreground">
          <Link to="/legal/terminos" className="inline-flex h-11 items-center px-2 transition-opacity active:opacity-60">Términos</Link>
          <span aria-hidden="true" className="inline-flex h-11 items-center">·</span>
          <Link to="/legal/privacidad" className="inline-flex h-11 items-center px-2 transition-opacity active:opacity-60">Privacidad</Link>
        </p>
      </div>
    </div>
  );

  return (
    <Screen onBack={() => navigate("/")} centered maxWidth="sm" contentClassName="py-6" footer={footer}>
      <Helmet>
        <title>Iniciar sesión · Autopilot</title>
        <meta name="description" content="Accede a tu cuenta de Autopilot: tu rutina, tu registro y tu progreso." />
        <meta name="robots" content="noindex,follow" />
        <link rel="canonical" href="https://autopilotplan.com/login" />
        <meta property="og:title" content="Iniciar sesión · Autopilot" />
        <meta property="og:description" content="Entra a tu cuenta de Autopilot." />
        <meta property="og:url" content="https://autopilotplan.com/login" />
      </Helmet>

      <AuthHero
        mark={
          <AnimatePresence mode="wait" initial={false}>
            {known ? (
              <motion.div key="avatar" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={swap} className="mx-auto h-20 w-20">
                <AuthImage
                  src={known.avatar}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover"
                  fallback={<span className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary type-title1">{(known.name || known.id).charAt(0).toUpperCase()}</span>}
                />
              </motion.div>
            ) : (
              <motion.div key="mark" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={swap}>
                <AuthAppMark />
              </motion.div>
            )}
          </AnimatePresence>
        }
        title={known?.name ? `Hola, ${known.name.split(" ")[0]}` : "Hola de nuevo"}
        description={known?.name ? "Introduce tu contraseña para continuar." : "Inicia sesión para acceder a tu plan."}
      >
        {remembered && known && (
          <Button type="button" variant="plain" size="sm" className="mt-1 h-11 font-medium" onClick={forget}>
            No soy yo
          </Button>
        )}
      </AuthHero>

      {/* En las apps nativas, las cuentas ya guardadas entran sin contraseña. */}
      {supportsMultipleAccounts() && listAccounts().length > 0 && (
        <button type="button" onClick={() => { void hapticTap(); openAccountPicker(); }}
          className="mx-auto mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-card px-5 type-headline transition-transform active:scale-[0.98]">
          <span className="flex -space-x-2" aria-hidden="true">
            {listAccounts().slice(0, 3).map((a) => <span key={a.id} className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary/60 ring-2 ring-card type-caption1 font-bold text-primary-foreground">{a.avatar ? <img src={a.avatar} alt="" className="h-full w-full object-cover" /> : (a.name || a.email).charAt(0).toUpperCase()}</span>)}
          </span>
          Elegir una cuenta guardada
        </button>
      )}

      <form id="login-form" onSubmit={handleSubmit} className="mt-8">
        <AuthFieldGroup footer={formError ? <AuthFieldNote id="login-error" tone="error">{formError}</AuthFieldNote> : null}>
          <AuthFieldRow label="Usuario o correo" htmlFor="email">
            <Input
              id="email"
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              enterKeyHint="next"
              onKeyDown={focusNextOnEnter("password")}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFormError(null); setUnconfirmedEmail(null); }}
              required
              aria-invalid={formError ? true : undefined}
              aria-describedby={formError ? "login-error" : undefined}
              className={authFieldInputClass()}
              placeholder="Usuario o correo"
            />
          </AuthFieldRow>
          <AuthFieldRow label="Contraseña" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              autoFocus={!!remembered}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFormError(null); }}
              required
              aria-invalid={formError ? true : undefined}
              aria-describedby={formError ? "login-error" : undefined}
              className={authFieldInputClass()}
              placeholder="Contraseña"
            />
          </AuthFieldRow>
        </AuthFieldGroup>
        {offerLock && (
          <label htmlFor="lock-account" className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 px-1">
            <Checkbox id="lock-account" checked={lockAccount} onCheckedChange={(v) => { void hapticTap(); setLockAccount(v === true); }} />
            <span className="type-subhead text-muted-foreground">Pedir contraseña al elegir esta cuenta</span>
          </label>
        )}
      </form>

      <div className="mt-3 text-center">
        <Button asChild variant="plain" size="sm" className="h-11 font-medium">
          <Link to="/forgot-password" onClick={() => void hapticTap()}>¿Olvidaste la contraseña?</Link>
        </Button>
      </div>

      {unconfirmedEmail ? (
        <div className="mt-1 text-center">
          <Button type="button" variant="plain" size="sm" className="h-11 font-medium" onClick={openVerification}>
            Introducir código de verificación
          </Button>
        </div>
      ) : null}
    </Screen>
  );
};

export default Login;
