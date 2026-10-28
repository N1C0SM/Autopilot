import { useAuth } from "@/shared/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Spinner } from "@/shared/components/ui/spinner";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }
    supabase
      .from("profiles")
      .select("plan_status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setPlanStatus(data?.plan_status ?? null);
        setChecking(false);
      });
  }, [user]);

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
