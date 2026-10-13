import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail, ChevronLeft } from "lucide-react";
import PageHead from "@/components/PageHead";
import { authRedirect } from "@/lib/authRedirect";
import { hapticTap } from "@/lib/native";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    void hapticTap();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirect("/reset-password"),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div
      className="relative min-h-screen flex items-center justify-center bg-background px-4"
      style={{ paddingTop: "var(--safe-top, 0px)", paddingBottom: "var(--safe-bottom, 0px)" }}
    >
      <button
        type="button"
        onClick={() => { void hapticTap(); navigate("/login"); }}
        aria-label="Volver a iniciar sesión"
        className="absolute left-3 inline-flex items-center gap-0.5 h-10 pl-1 pr-2.5 rounded-full text-foreground/85 transition-colors active:bg-secondary/60"
        style={{ top: "calc(var(--safe-top, 0px) + 12px)" }}
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="text-[15px] font-medium">Atrás</span>
      </button>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );

  if (sent) {
    return shell(
      <>
        <PageHead
          title="Recuperar contraseña · Autopilot"
          description="Te enviamos un enlace para restablecer tu contraseña de Autopilot."
          path="/forgot-password"
          noindex
        />
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-[22%] bg-primary/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" strokeWidth={1.75} />
          </div>
          <h1 className="text-[28px] font-bold font-display mt-6 tracking-[-0.03em] leading-[1.1]">Revisa tu correo</h1>
          <p className="text-muted-foreground text-[15px] mt-2 leading-snug">
            Te hemos enviado un enlace para restablecer tu contraseña.
          </p>
          <Button asChild variant="hero" size="lg" className="w-full h-[52px] text-[17px] font-semibold tracking-[-0.015em] mt-10">
            <Link to="/login">Volver al inicio de sesión</Link>
          </Button>
        </div>
      </>
    );
  }

  return shell(
    <>
      <PageHead
        title="Recuperar contraseña · Autopilot"
        description="Introduce tu correo y te enviaremos un enlace para restablecer la contraseña."
        path="/forgot-password"
        noindex
      />
      <div className="text-center mb-10">
        <div className="mx-auto w-16 h-16 rounded-[22%] bg-background border border-primary/20 flex items-center justify-center shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.4)]">
          <svg viewBox="0 0 100 100" aria-hidden="true" className="w-[62%] h-[62%] text-primary" fill="none">
            <path d="M14 86 L50 14 L86 86" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M56 46 L36 66 L48 66 L44 86 L62 60 L50 60 L55 46 Z" fill="currentColor" />
          </svg>
        </div>
        <h1 className="text-[28px] font-bold font-display mt-6 tracking-[-0.03em] leading-[1.1]">Recuperar contraseña</h1>
        <p className="text-muted-foreground text-[15px] mt-2 leading-snug">Te enviaremos un enlace a tu correo.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email" className="block mb-1.5 text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Correo electrónico</Label>
          <Input id="email" type="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 bg-secondary border-0 text-[16px]" placeholder="tu@ejemplo.com" />
        </div>
        <Button variant="hero" size="lg" className="w-full h-[52px] text-[17px] font-semibold tracking-[-0.015em] mt-2" type="submit" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando…</> : "Enviar enlace"}
        </Button>
      </form>
    </>
  );
};

export default ForgotPassword;
