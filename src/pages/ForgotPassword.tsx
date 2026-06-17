import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import PageHead from "@/components/PageHead";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <PageHead
          title="Recuperar contraseña · Autopilot"
          description="Te enviamos un enlace para restablecer tu contraseña de Autopilot."
          path="/forgot-password"
        />
        <div className="w-full max-w-md text-center space-y-4">
          <Mail className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold font-display">Revisa tu correo</h1>
          <p className="text-muted-foreground text-sm">Te hemos enviado un enlace para restablecer tu contraseña.</p>
          <Link to="/login" className="text-primary hover:underline text-sm">Volver al inicio de sesión</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <PageHead
        title="Recuperar contraseña · Autopilot"
        description="Introduce tu correo y te enviaremos un enlace para restablecer la contraseña."
        path="/forgot-password"
      />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-display text-2xl font-bold text-gradient">Autopilot</Link>
          <h1 className="text-2xl font-bold font-display mt-6 mb-2">Recuperar contraseña</h1>
          <p className="text-muted-foreground text-sm">Introduce tu correo y te enviaremos un enlace</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-8 border border-border card-shadow space-y-5">
          <div>
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" placeholder="tu@ejemplo.com" />
          </div>
          <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando...</> : "Enviar enlace"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">Volver al inicio de sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
