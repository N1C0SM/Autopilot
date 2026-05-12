import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      .single()
      .then(({ data }) => {
        setPlanStatus(data?.plan_status ?? null);
        setChecking(false);
      });
  }, [user]);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // If user hasn't completed onboarding, redirect there (unless already on /onboarding, /admin or /trainer)
  const skipOnboardingRedirect = ["/onboarding", "/admin", "/trainer"].some((p) => location.pathname.startsWith(p));
  if (planStatus === "onboarding" && !skipOnboardingRedirect) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};
