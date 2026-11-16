import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/shared/contexts/AuthContext";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";

/** Resolve the generic app entry before mounting the explicitly addressable client view. */
export default function DashboardRedirect() {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const [result, setResult] = useState<{ userId: string; admin: boolean } | null>(null);
  const [failedUserId, setFailedUserId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading || !userId) return;
    let active = true;
    setFailedUserId(null);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
        if (!active) return;
        if (error || typeof data !== "boolean") {
          setFailedUserId(userId);
          return;
        }
        setResult({ userId, admin: data });
      } catch {
        if (active) setFailedUserId(userId);
      }
    })();
    return () => { active = false; };
  }, [loading, userId, attempt]);

  if (!loading && !userId) return <Navigate to="/login" replace />;
  if (!loading && userId && result?.userId === userId) {
    return <Navigate to={result.admin ? "/admin" : `/dashboard/user/${userId}`} replace />;
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      {userId && failedUserId === userId ? (
        <>
          <p className="text-muted-foreground">No se pudo comprobar tu acceso.</p>
          <Button onClick={() => setAttempt((value) => value + 1)}>Reintentar</Button>
        </>
      ) : <Spinner size="lg" />}
    </div>
  );
}