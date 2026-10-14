import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import Screen from "@/components/native/Screen";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Mail } from "lucide-react";
import PageHead from "@/components/PageHead";
import { AuthFieldGroup, AuthFieldNote, AuthFieldRow, AuthHero, AuthSymbol } from "@/components/auth/AuthScreenParts";
import { authFieldInputClass } from "@/components/auth/authFormHelpers";
import { authRedirect } from "@/lib/authRedirect";
import { hapticNotify, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    void hapticTap();
    setFormError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirect("/reset-password"),
    });
    setLoading(false);
    if (error) {
      setFormError(error.message);
      void hapticNotify("error");
    } else {
      void hapticNotify("success");
      setSent(true);
    }
  };

  if (sent) {
    return (
      <Screen
        onBack={() => navigate("/login")}
        centered
        maxWidth="sm"
        contentClassName="py-6"
        footer={
          <div className="pb-2">
            <Button asChild size="lg" className="w-full">
              <Link to="/login" onClick={() => void hapticTap()}>Volver al inicio de sesión</Link>
            </Button>
          </div>
        }
      >
        <PageHead
          title="Recuperar contraseña · Autopilot"
          description="Te enviamos un enlace para restablecer tu contraseña de Autopilot."
          path="/forgot-password"
          noindex
        />
        <AuthHero
          mark={<AuthSymbol icon={Mail} size="lg" />}
          title="Revisa tu correo"
          description={
            <>
              Te hemos enviado un enlace a <span className="break-all text-foreground">{email}</span> para restablecer tu contraseña.
            </>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      onBack={() => navigate("/login")}
      centered
      maxWidth="sm"
      contentClassName="py-6"
      footer={
        <div className="pb-2">
          <Button
            type="submit"
            form="forgot-password-form"
            size="lg"
            className={cn("w-full", loading && "disabled:opacity-100")}
            disabled={loading}
          >
            {loading ? <><Spinner size="sm" className="text-primary-foreground" aria-hidden="true" /> Enviando…</> : "Enviar enlace"}
          </Button>
        </div>
      }
    >
      <PageHead
        title="Recuperar contraseña · Autopilot"
        description="Introduce tu correo y te enviaremos un enlace para restablecer la contraseña."
        path="/forgot-password"
        noindex
      />
      <AuthHero
        mark={<AuthSymbol icon={KeyRound} />}
        title="Recuperar contraseña"
        description="Te enviaremos un enlace a tu correo."
      />
      <form id="forgot-password-form" onSubmit={handleSubmit} className="mt-10">
        <AuthFieldGroup footer={formError ? <AuthFieldNote id="forgot-password-error" tone="error">{formError}</AuthFieldNote> : null}>
          <AuthFieldRow label="Correo electrónico" htmlFor="email">
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="email"
              enterKeyHint="go"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFormError(null); }}
              required
              aria-invalid={formError ? true : undefined}
              aria-describedby={formError ? "forgot-password-error" : undefined}
              className={authFieldInputClass()}
              placeholder="Correo electrónico"
            />
          </AuthFieldRow>
        </AuthFieldGroup>
      </form>
    </Screen>
  );
};

export default ForgotPassword;
