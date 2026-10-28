import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Spinner } from "@/shared/components/ui/spinner";
import Screen from "@/shared/components/native/Screen";
import { supabase } from "@/shared/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, LockKeyhole } from "lucide-react";
import PageHead from "@/web/components/PageHead";
import { AuthFieldGroup, AuthFieldNote, AuthFieldRow, AuthHero, AuthSymbol } from "@/app/components/auth/AuthScreenParts";
import { authFieldInputClass, focusNextOnEnter } from "@/app/components/auth/authFormHelpers";
import { hapticNotify, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fail = (message: string) => {
    setFormError(message);
    void hapticNotify("error");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    void hapticTap();
    setFormError(null);
    if (password !== confirm) {
      fail("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      fail("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      fail(error.message);
    } else {
      setDone(true);
      void hapticNotify("success");
      toast.success("Contraseña actualizada correctamente");
    }
  };

  if (done) {
    return (
      <Screen
        hideBack
        centered
        maxWidth="sm"
        contentClassName="py-6"
        footer={
          <div className="pb-2">
            <Button asChild size="lg" className="w-full rounded-full">
              <Link to="/login" onClick={() => void hapticTap()}>Iniciar sesión</Link>
            </Button>
          </div>
        }
      >
        <PageHead
          title="Contraseña actualizada · Autopilot"
          description="Tu contraseña se ha actualizado correctamente."
          path="/reset-password"
          noindex
        />
        <AuthHero
          mark={<AuthSymbol icon={Check} />}
          title="Contraseña actualizada"
          description="Ya puedes iniciar sesión con la nueva."
        />
      </Screen>
    );
  }

  const describedBy = formError ? "reset-password-error" : undefined;

  return (
    <Screen
      hideBack
      centered
      maxWidth="sm"
      contentClassName="py-6"
      footer={
        <div className="pb-2">
          <Button
            type="submit"
            form="reset-password-form"
            size="lg"
            className={cn("w-full rounded-full", loading && "disabled:opacity-100")}
            disabled={loading}
          >
            {loading ? <><Spinner size="sm" className="text-primary-foreground" aria-hidden="true" /> Actualizando…</> : "Actualizar contraseña"}
          </Button>
        </div>
      }
    >
      <PageHead
        title="Nueva contraseña · Autopilot"
        description="Establece una nueva contraseña para tu cuenta de Autopilot."
        path="/reset-password"
        noindex
      />
      <AuthHero
        mark={<AuthSymbol icon={LockKeyhole} />}
        title="Nueva contraseña"
        description="Elige una contraseña de al menos 6 caracteres."
      />
      <form id="reset-password-form" onSubmit={handleSubmit} className="mt-10">
        <AuthFieldGroup footer={formError ? <AuthFieldNote id="reset-password-error" tone="error">{formError}</AuthFieldNote> : null}>
          <AuthFieldRow label="Nueva contraseña" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              onKeyDown={focusNextOnEnter("confirm")}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFormError(null); }}
              required
              minLength={6}
              aria-invalid={formError ? true : undefined}
              aria-describedby={describedBy}
              className={authFieldInputClass()}
              placeholder="Nueva contraseña"
            />
          </AuthFieldRow>
          <AuthFieldRow label="Confirmar contraseña" htmlFor="confirm">
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setFormError(null); }}
              required
              minLength={6}
              aria-invalid={formError ? true : undefined}
              aria-describedby={describedBy}
              className={authFieldInputClass()}
              placeholder="Repite la contraseña"
            />
          </AuthFieldRow>
        </AuthFieldGroup>
      </form>
    </Screen>
  );
};

export default ResetPassword;
