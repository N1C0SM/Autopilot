import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import PageHead from "@/components/PageHead";
import { hapticTap } from "@/lib/native";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    void hapticTap();
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

  const shell = (children: React.ReactNode) => (
    <div
      className="min-h-screen flex items-center justify-center bg-background px-4"
      style={{ paddingTop: "var(--safe-top, 0px)", paddingBottom: "var(--safe-bottom, 0px)" }}
    >
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );

  if (done) {
    return shell(
      <>
        <PageHead
          title="Contraseña actualizada · Autopilot"
          description="Tu contraseña se ha actualizado correctamente."
          path="/reset-password"
          noindex
        />
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-8 h-8 text-primary-foreground" strokeWidth={3} />
          </div>
          <h1 className="text-[28px] font-bold font-display mt-6 tracking-[-0.03em] leading-[1.1]">Contraseña actualizada</h1>
          <p className="text-muted-foreground text-[15px] mt-2 leading-snug">Ya puedes iniciar sesión con la nueva.</p>
          <Button asChild variant="hero" size="lg" className="w-full h-[52px] text-[17px] font-semibold tracking-[-0.015em] mt-10">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </>
    );
  }

  return shell(
    <>
      <PageHead
        title="Nueva contraseña · Autopilot"
        description="Establece una nueva contraseña para tu cuenta de Autopilot."
        path="/reset-password"
        noindex
      />
      <div className="text-center mb-10">
        <div className="mx-auto w-16 h-16 rounded-[22%] bg-background border border-primary/20 flex items-center justify-center shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.4)]">
          <svg viewBox="0 0 100 100" aria-hidden="true" className="w-[62%] h-[62%] text-primary" fill="none">
            <path d="M14 86 L50 14 L86 86" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M56 46 L36 66 L48 66 L44 86 L62 60 L50 60 L55 46 Z" fill="currentColor" />
          </svg>
        </div>
        <h1 className="text-[28px] font-bold font-display mt-6 tracking-[-0.03em] leading-[1.1]">Nueva contraseña</h1>
        <p className="text-muted-foreground text-[15px] mt-2 leading-snug">Elige una contraseña de al menos 6 caracteres.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="password" className="block mb-1.5 text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Nueva contraseña</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 bg-secondary border-0 text-[16px]" minLength={6} />
        </div>
        <div>
          <Label htmlFor="confirm" className="block mb-1.5 text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Confirmar contraseña</Label>
          <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="h-12 bg-secondary border-0 text-[16px]" minLength={6} />
        </div>
        <Button variant="hero" size="lg" className="w-full h-[52px] text-[17px] font-semibold tracking-[-0.015em] mt-2" type="submit" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Actualizando…</> : "Actualizar contraseña"}
        </Button>
      </form>
    </>
  );
};

export default ResetPassword;
