import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { authRedirect } from "@/lib/authRedirect";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, string>) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const authEventReceived = useRef(false);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventReceived.current = true;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active || authEventReceived.current) return;
      if (error) {
        console.error("Failed to restore the saved authentication session", error);
        toast.error("No se pudo recuperar tu sesión. Comprueba la conexión e inténtalo de nuevo.");
      }
      setSession(session);
      setUser(session?.user ?? null);
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
  }, []);

  const signUp = async (email: string, password: string, metadata?: Record<string, string>) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authRedirect("/onboarding"),
        data: metadata,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
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
