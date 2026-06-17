import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, CheckCircle } from "lucide-react";
import PageHead from "@/components/PageHead";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setDone(true);
      toast.success("Contraseña actualizada correctamente");
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <PageHead
          title="Contraseña actualizada · Autopilot"
          description="Tu contraseña se ha actualizado correctamente."
          path="/reset-password"
          noindex
        />
        <div className="w-full max-w-md text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold font-display">¡Contraseña actualizada!</h1>
          <Link to="/login">
            <Button variant="hero" size="lg">Iniciar sesión</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <PageHead
        title="Nueva contraseña · Autopilot"
        description="Establece una nueva contraseña para tu cuenta de Autopilot."
        path="/reset-password"
        noindex
      />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-display text-2xl font-bold text-gradient">Autopilot</Link>
          <h1 className="text-2xl font-bold font-display mt-6 mb-2">Nueva contraseña</h1>
          <p className="text-muted-foreground text-sm">Establece tu nueva contraseña</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-8 border border-border card-shadow space-y-5">
          <div>
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" placeholder="Mínimo 6 caracteres" minLength={6} />
          </div>
          <div>
            <Label htmlFor="confirm">Confirmar contraseña</Label>
            <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="mt-1.5" placeholder="Repite la contraseña" minLength={6} />
          </div>
          <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Actualizando...</> : "Actualizar contraseña"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
