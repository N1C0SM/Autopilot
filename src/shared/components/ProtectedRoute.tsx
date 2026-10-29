import { useAuth } from "@/shared/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Spinner } from "@/shared/components/ui/spinner";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { readScreen, writeScreen } from "@/shared/lib/screenCache";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  /**
   * El estado del plan se recuerda: sin esto, cada entrada a una pantalla privada
   * esperaba a la red con un spinner a pantalla completa. Con copia se entra de
   * inmediato y la comprobación sigue por detrás (si cambió, redirige igual).
   */
  const [cachedStatus] = useState<string | null>(
    () => (user ? readScreen<string>(user.id, "plan-status") : null),
  );
  const [planStatus, setPlanStatus] = useState<string | null>(cachedStatus);
  const [checking, setChecking] = useState(!cachedStatus);

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }
    // Si la sesión se restauró después del primer render, la copia se busca aquí.
    if (!cachedStatus) {
      const cached = readScreen<string>(user.id, "plan-status");
      if (cached) {
        setPlanStatus(cached);
        setChecking(false);
      }
    }
    supabase
      .from("profiles")
      .select("plan_status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const status = data?.plan_status ?? null;
        setPlanStatus(status);
        if (status) writeScreen(user.id, "plan-status", status);
        setChecking(false);
      });
  }, [user, cachedStatus]);

  if (loading || checking) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // If user hasn't completed onboarding, redirect there (unless already on /onboarding, /admin or /trainer)
  const skipOnboardingRedirect = ["/onboarding", "/onboarding-choice", "/admin", "/trainer"].some((p) => location.pathname.startsWith(p));
  if (planStatus === "onboarding" && !skipOnboardingRedirect) {
    return <Navigate to="/onboarding-choice" replace />;
  }

  return <>{children}</>;
};
