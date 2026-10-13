import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { signInWithApple } from "@/lib/nativeAuth";
import { Loader2, ChevronLeft } from "lucide-react";
import { AppleSignInButton } from "@/components/auth/AppleSignInButton";

const Login = () => {
  const [email, setEmail] = useState(() => {
    try { return JSON.parse(localStorage.getItem("autopilot:last-login") || "null")?.id || ""; } catch { return ""; }
  });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
      toast.error("No se pudo iniciar sesión con Apple");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      if (error.message.includes("Email not confirmed")) {
        toast.error("Debes verificar tu correo electrónico antes de iniciar sesión");
      } else if (error.message === "rate_limited") {
        toast.error("Demasiados intentos. Espera un minuto");
      } else {
        toast.error("Usuario o contraseña incorrectos");
      }
    } else {
      // Resolve destination based on role
      const { data: { user: authedUser } } = await supabase.auth.getUser();
      if (authedUser) {
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

  return (
    <div
      className="relative min-h-screen flex items-center justify-center bg-background px-4"
      style={{ paddingTop: "var(--safe-top, 0px)", paddingBottom: "var(--safe-bottom, 0px)" }}
    >
      <button
        type="button"
        onClick={() => navigate("/")}
        aria-label="Volver a Bienvenido"
        className="absolute left-3 inline-flex items-center gap-0.5 h-10 pl-1 pr-2.5 rounded-full text-foreground/85 active:bg-secondary/60 transition-colors"
        style={{ top: "calc(var(--safe-top, 0px) + 12px)" }}
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="text-[15px] font-medium">Atrás</span>
      </button>
      <Helmet>
        <title>Iniciar sesión · Autopilot</title>
        <meta name="description" content="Accede a tu cuenta de Autopilot: tu rutina, tu registro y tu progreso." />
        <meta name="robots" content="noindex,follow" />
        <link rel="canonical" href="https://autopilotplan.com/login" />
        <meta property="og:title" content="Iniciar sesión · Autopilot" />
        <meta property="og:description" content="Entra a tu cuenta de Autopilot." />
        <meta property="og:url" content="https://autopilotplan.com/login" />
      </Helmet>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-display text-2xl font-bold text-gradient">Autopilot</Link>
          <AnimatePresence>
            {known && (
              <motion.div key="avatar" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="mt-6 flex justify-center">
                {known.avatar
                  ? <img src={known.avatar} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/60" />
                  : <span className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary font-display text-2xl font-bold ring-2 ring-primary/60">{(known.name || known.id).charAt(0).toUpperCase()}</span>}
              </motion.div>
            )}
          </AnimatePresence>
          <h1 className="text-2xl font-bold font-display mt-6 mb-2">{known?.name ? `Hola, ${known.name.split(" ")[0]}` : "Bienvenido de vuelta"}</h1>
          <p className="text-muted-foreground text-sm">Inicia sesión para acceder a tu plan</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-8 border border-border card-shadow space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="email">Usuario o correo</Label>
              {remembered && known && <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { localStorage.removeItem("autopilot:last-login"); setRemembered(null); setEmail(""); }}>No soy yo</button>}
            </div>
            <Input id="email" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" placeholder="tu nombre o tu@ejemplo.com" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">¿Olvidaste tu contraseña?</Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" autoFocus={!!remembered} value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" />
          </div>
          <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Iniciando sesión...</> : "Iniciar Sesión"}
          </Button>
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider"><span className="bg-card px-2 text-muted-foreground">o</span></div>
          </div>
          <AppleSignInButton label="sign-in" onClick={handleApple} />
          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta? <Link to="/signup" className="text-primary hover:underline">Regístrate</Link>
          </p>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/legal/terminos" className="hover:text-foreground">Términos</Link>
          {" · "}
          <Link to="/legal/privacidad" className="hover:text-foreground">Privacidad</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
