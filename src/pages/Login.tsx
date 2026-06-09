import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const Login = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let email = identifier.trim();

    if (!isEmail(email)) {
      // Lookup email by username via edge function
      const { data, error: fnError } = await supabase.functions.invoke("check-availability", {
        body: { name: email, lookup: true },
      });

      if (fnError || !data?.email) {
        setLoading(false);
        toast.error("No se encontró ningún usuario con ese nombre");
        return;
      }
      email = data.email;
    }

    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      if (error.message.includes("Email not confirmed")) {
        toast.error("Debes verificar tu correo electrónico antes de iniciar sesión");
      } else {
        toast.error("Credenciales incorrectas");
      }
    } else {
      // Resolve destination based on role
      const { data: { user: authedUser } } = await supabase.auth.getUser();
      if (authedUser) {
        const [{ data: isAdmin }, { data: isTrainer }] = await Promise.all([
          supabase.rpc("has_role", { _user_id: authedUser.id, _role: "admin" }),
          supabase.rpc("has_role", { _user_id: authedUser.id, _role: "trainer" as any }),
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Helmet>
        <title>Iniciar sesión · Autopilot</title>
        <meta name="description" content="Accede a tu plan de Autopilot: entrenamiento, nutrición y chat con tu entrenador." />
        <link rel="canonical" href="https://autopilotplan.com/login" />
        <meta property="og:title" content="Iniciar sesión · Autopilot" />
        <meta property="og:description" content="Entra a tu cuenta de Autopilot." />
        <meta property="og:url" content="https://autopilotplan.com/login" />
      </Helmet>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-display text-2xl font-bold text-gradient">Autopilot</Link>
          <h1 className="text-2xl font-bold font-display mt-6 mb-2">Bienvenido de vuelta</h1>
          <p className="text-muted-foreground text-sm">Inicia sesión para acceder a tu plan</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-8 border border-border card-shadow space-y-5">
          <div>
            <Label htmlFor="identifier">Nombre o correo electrónico</Label>
            <Input id="identifier" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className="mt-1.5" placeholder="tu nombre o tu@ejemplo.com" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">¿Olvidaste tu contraseña?</Link>
            </div>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" />
          </div>
          <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Iniciando sesión...</> : "Iniciar Sesión"}
          </Button>
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
