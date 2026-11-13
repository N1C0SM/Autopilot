import { forgetAccount, rememberSession } from "@/shared/lib/accounts";
import { supportsMultipleAccounts } from "@/shared/lib/platform";
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { authRedirect, verifyEmailRedirect } from "@/shared/lib/authRedirect";
import { clearAnonScanId } from "@/shared/lib/scanAttribution";
import { clearPendingScanContext } from "@/shared/lib/pendingScan";
import { clearConfiguratorDraft } from "@/shared/lib/configuratorDraft";
import { clearScreenCache } from "@/shared/lib/screenCache";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, string>, options?: { next?: string }) => Promise<{ error: Error | null; exists?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; user: User | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * La sesión guardada en este navegador, leída sin red. Con el token caducado (más de una hora
 * sin abrir) supabase lo renueva antes de contestar y la app esperaba con un spinner; así se
 * pinta al instante con lo guardado y la renovación sigue por detrás: las consultas la esperan
 * solas y, si no se puede renovar, llega el cierre de sesión como siempre. Igual que la app
 * nativa (`emitLocalSessionAsInitialSession`). En una pestaña de suplantación no se adelanta nada.
 */
function readStoredSession(): Session | null {
  try {
    if (sessionStorage.getItem("lovable-impersonating") === "1") return null;
    const key = (supabase.auth as unknown as { storageKey?: unknown }).storageKey;
    if (typeof key !== "string") return null;
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Partial<Session> | null) : null;
    return parsed?.user?.id && parsed.refresh_token ? (parsed as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(readStoredSession);
  const [user, setUser] = useState<User | null>(stored?.user ?? null);
  const [session, setSession] = useState<Session | null>(stored);
  const [loading, setLoading] = useState(!stored);
  /**
   * Misma persona, mismo objeto: al confirmar la sesión guardada (o renovar el token cada hora)
   * no cambia `user`, así que las pantallas no repiten sus consultas ni sus suscripciones.
   */
  const applyUser = useCallback((next: User | null) => {
    setUser((prev) => (prev && next && prev.id === next.id && prev.updated_at === next.updated_at ? prev : next));
  }, []);
  const authEventReceived = useRef(false);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventReceived.current = true;
      // En las apps nativas cada sesión queda guardada para poder cambiar de cuenta.
      if (session && supportsMultipleAccounts()) rememberSession(session);
      setSession(session);
      applyUser(session?.user ?? null);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active || authEventReceived.current) return;
      if (error) {
        console.error("Failed to restore the saved authentication session", error);
        toast.error("No se pudo recuperar tu sesión. Comprueba la conexión e inténtalo de nuevo.");
      }
      setSession(session);
      applyUser(session?.user ?? null);
      setLoading(false);
    }).catch((error: unknown) => {
      if (!active || authEventReceived.current) return;
      console.error("Failed to restore the saved authentication session", error);
      toast.error("No se pudo recuperar tu sesión. Comprueba la conexión e inténtalo de nuevo.");
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applyUser]);

  const signUp = async (email: string, password: string, metadata?: Record<string, string>, options?: { next?: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: verifyEmailRedirect(options?.next || "/onboarding-choice"),
        data: metadata,
      },
    });
    // Correo ya registrado: Supabase devuelve un usuario sin identidades y no envía nada.
    return { error: error as Error | null, exists: data?.user?.identities?.length === 0 };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null, user: data.user };
  };

  const signOut = async () => {
    // Al cerrar sesión olvidamos el id anónimo de escaneo: si otra persona
    // escanea o se registra después en este mismo navegador, no debe heredar la
    // atribución de fotos ajenas.
    clearAnonScanId();
    // El informe anónimo del scan es PII de salud: no debe sobrevivir a la
    // sesión ni quedar visible para otra persona que use este navegador.
    clearPendingScanContext();
    // El borrador del configurador puede contener datos de salud y de la
    // pareja del usuario anterior en un navegador compartido.
    clearConfiguratorDraft();
    // Cerrar sesión revoca la sesión: esta cuenta deja de estar guardada en el dispositivo.
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      // Nada de lo cacheado de esta cuenta queda en un navegador compartido.
      clearScreenCache(data.session.user.id);
      forgetAccount(data.session.user.id);
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
