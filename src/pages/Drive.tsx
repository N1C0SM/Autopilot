import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { HardDrive, Loader2, LogOut, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })
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

      <header className="app-chrome sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link to="/drive" className="inline-flex items-center gap-2 font-display font-bold">
            <HardDrive className="h-5 w-5 text-primary" />
            <span>Autopilot Drive</span>
          </Link>
          {access === "allowed" && (
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {checking ? (
          <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Comprobando acceso…
          </div>
        ) : access === "allowed" ? (
          <LibraryDrive />
        ) : access === "signed-out" ? (
          <div className="mx-auto flex min-h-[65vh] max-w-md flex-col justify-center">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <LockKeyhole className="h-7 w-7 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-bold">Tu biblioteca, en un solo lugar</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Inicia sesión con tu cuenta de administrador para gestionar libros, packs y recursos.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 card-shadow">
              <div>
                <Label htmlFor="drive-email">Correo de administrador</Label>
                <Input
                  id="drive-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5"
                  placeholder="tu@autopilotplan.com"
                />
              </div>
              <div>
                <Label htmlFor="drive-password">Contraseña</Label>
                <Input
                  id="drive-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1.5"
                />
              </div>
              {loginError && <p role="alert" className="text-sm text-destructive">{loginError}</p>}
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                {submitting ? "Iniciando sesión…" : "Entrar en Drive"}
              </Button>
            </form>
          </div>
        ) : (
          <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
              <LockKeyhole className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="font-display text-2xl font-bold">
              {access === "denied" ? "Acceso solo para administradores" : "No se pudo comprobar el acceso"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {access === "denied"
                ? "Esta cuenta no tiene permisos para gestionar Autopilot Drive."
                : "Ha ocurrido un problema al verificar tu cuenta. Vuelve a intentarlo."}
            </p>
            {access === "denied" ? (
              <Button variant="outline" className="mt-5" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                Cambiar de cuenta
              </Button>
            ) : (
              <Button variant="outline" className="mt-5" onClick={() => setRoleCheckAttempt((attempt) => attempt + 1)}>
                Reintentar
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Drive;
