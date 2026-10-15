import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { HardDrive, LogOut, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { hapticTap } from "@/lib/native";
import LibraryDrive from "@/components/admin/LibraryDrive";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type AccessState = "checking" | "signed-out" | "checking-role" | "allowed" | "denied" | "error";

const Drive = () => {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const [access, setAccess] = useState<AccessState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [roleCheckAttempt, setRoleCheckAttempt] = useState(0);

  useEffect(() => {
    if (authLoading) {
      setAccess("checking");
      return;
    }
    if (!user) {
      setAccess("signed-out");
      return;
    }

    let active = true;
    setAccess("checking-role");
    Promise.resolve(supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }))
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Could not verify admin access to Drive", error);
          setAccess("error");
        } else {
          setAccess(data ? "allowed" : "denied");
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("Could not verify admin access to Drive", error);
        setAccess("error");
      });

    return () => {
      active = false;
    };
  }, [authLoading, roleCheckAttempt, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setLoginError("");
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setLoginError("No se pudo iniciar sesión. Comprueba el correo y la contraseña.");
      } else {
        setPassword("");
      }
    } catch (error) {
      console.error("Could not sign in to Autopilot Drive", error);
      setLoginError("No se pudo iniciar sesión. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setPassword("");
    setLoginError("");
  };

  const checking = access === "checking" || access === "checking-role";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Autopilot Drive</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header className="app-chrome sticky top-0 z-40 pt-safe">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link to="/drive" className="inline-flex min-h-[44px] items-center gap-2 type-headline transition-opacity active:opacity-60">
            <HardDrive className="h-5 w-5 text-primary" />
            <span>Autopilot Drive</span>
          </Link>
          {access === "allowed" && (
            <Button variant="plain" className="min-h-[44px]" onClick={() => { void hapticTap(); void handleSignOut(); }}>
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-safe sm:py-8">
        {checking ? (
          <div className="flex min-h-[50vh] items-center justify-center gap-3 type-subhead text-muted-foreground">
            <Spinner size="md" label="Comprobando acceso" />
            Comprobando acceso…
          </div>
        ) : access === "allowed" ? (
          <LibraryDrive />
        ) : access === "signed-out" ? (
          <div className="mx-auto flex min-h-[65vh] max-w-sm flex-col justify-center">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-[22%] bg-card">
                <LockKeyhole className="h-8 w-8 text-primary" strokeWidth={1.75} />
              </div>
              <h1 className="type-title1">Tu biblioteca, en un solo lugar</h1>
              <p className="mt-2 type-subhead text-muted-foreground">
                Inicia sesión con tu cuenta de administrador para gestionar libros, packs y recursos.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="drive-email" className="mb-1.5 block text-muted-foreground">Correo de administrador</Label>
                <Input
                  id="drive-email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@autopilotplan.com"
                />
              </div>
              <div>
                <Label htmlFor="drive-password" className="mb-1.5 block text-muted-foreground">Contraseña</Label>
                <Input
                  id="drive-password"
                  type="password"
                  enterKeyHint="done"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {loginError && <p role="alert" className="type-footnote text-destructive">{loginError}</p>}
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting} onClick={() => void hapticTap()}>
                {submitting && <Spinner size="sm" className="text-primary-foreground" />}
                {submitting ? "Iniciando sesión…" : "Entrar en Drive"}
              </Button>
            </form>
          </div>
        ) : (
          <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center">
            <EmptyState
              icon={LockKeyhole}
              title={access === "denied" ? "Acceso solo para administradores" : "No se pudo comprobar el acceso"}
              description={
                access === "denied"
                  ? "Esta cuenta no tiene permisos para gestionar Autopilot Drive."
                  : "Ha ocurrido un problema al verificar tu cuenta. Vuelve a intentarlo."
              }
              action={
                access === "denied" ? (
                  <Button variant="plain" onClick={() => { void hapticTap(); void handleSignOut(); }}>
                    Cambiar de cuenta
                  </Button>
                ) : (
                  <Button variant="plain" onClick={() => { void hapticTap(); setRoleCheckAttempt((attempt) => attempt + 1); }}>
                    Reintentar
                  </Button>
                )
              }
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default Drive;
