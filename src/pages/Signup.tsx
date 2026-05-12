import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, CheckCircle, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Zap } from "lucide-react";

const Signup = () => {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameTaken, setNameTaken] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingName, setCheckingName] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const referralCode = searchParams.get("ref") || "";
  const isFree = searchParams.get("free") === "true";
  const fromQuiz = searchParams.get("from") === "quiz";
  const fromScan = searchParams.get("from") === "scan";
  const [scanCtx, setScanCtx] = useState<any>(null);
  const { signUp } = useAuth();

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

  const checkAvailability = async (field: "name" | "email", value: string) => {
    if (!value.trim()) return;
    const setter = field === "name" ? setCheckingName : setCheckingEmail;
    const takenSetter = field === "name" ? setNameTaken : setEmailTaken;
    setter(true);
    try {
      const { data } = await supabase.functions.invoke("check-availability", {
        body: { [field]: value.trim() },
      });
      takenSetter(field === "name" ? data?.nameTaken : data?.emailTaken);
    } catch {
      // ignore
    }
    setter(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameTaken || emailTaken) {
      toast.error("Corrige los campos marcados antes de continuar");
      return;
    }
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setLoading(true);

    // Final server-side check
    const { data: avail } = await supabase.functions.invoke("check-availability", {
      body: { name: name.trim(), email: email.trim() },
    });
    if (avail?.nameTaken) {
      setNameTaken(true);
      toast.error("Ese nombre de usuario ya está en uso");
      setLoading(false);
      return;
    }
    if (avail?.emailTaken) {
      setEmailTaken(true);
      toast.error("Ese correo ya está registrado");
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, password, {
      display_name: name.trim(),
      referral_code: referralCode,
      is_free: isFree ? "true" : "false",
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Email verification required — show confirmation screen
    setEmailSent(true);
    setLoading(false);
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
          <Link to="/login" className="text-primary hover:underline text-sm block mt-4">Ir a iniciar sesión</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-display text-2xl font-bold text-gradient">Autopilot</Link>
          <h1 className="text-2xl font-bold font-display mt-6 mb-2">Crea tu cuenta</h1>
          <p className="text-muted-foreground text-sm">
            {isFree
              ? "Acceso completo por invitación"
              : fromQuiz
              ? "Último paso para desbloquear tu plan"
              : fromScan
              ? "Último paso para desbloquear tu AI Report y plan completo"
              : "Empieza tu transformación hoy"}
          </p>
        </div>

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
            <Label htmlFor="name">Nombre de usuario</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameTaken(false); }}
              onBlur={() => checkAvailability("name", name)}
              required
              className={`mt-1.5 ${nameTaken ? "border-destructive" : ""}`}
              placeholder="Tu nombre de usuario"
            />
            {checkingName && <p className="text-xs text-muted-foreground mt-1">Verificando...</p>}
            {nameTaken && <p className="text-xs text-destructive mt-1">Este nombre ya está en uso</p>}
            {name.trim() && !nameTaken && !checkingName && <p className="text-xs text-primary mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Disponible</p>}
          </div>
          <div>
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailTaken(false); }}
              onBlur={() => checkAvailability("email", email)}
              required
              className={`mt-1.5 ${emailTaken ? "border-destructive" : ""}`}
              placeholder="tu@ejemplo.com"
            />
            {checkingEmail && <p className="text-xs text-muted-foreground mt-1">Verificando...</p>}
            {emailTaken && <p className="text-xs text-destructive mt-1">Este correo ya está registrado</p>}
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" placeholder="Mínimo 6 caracteres" minLength={6} />
          </div>

          <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading || nameTaken || emailTaken}>
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Procesando...</>
            ) : (
              "Crear cuenta"
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta? <Link to="/login" className="text-primary hover:underline">Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Signup;
