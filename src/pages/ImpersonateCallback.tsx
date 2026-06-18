import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function ImpersonateCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Aseguramos el flag (ya lo seteó index.html, pero por si acaso).
    try { sessionStorage.setItem("lovable-impersonating", "1"); } catch {}

    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get("th");
    const email = params.get("e");
    const redirect = params.get("to") || "/dashboard";

    if (!token_hash || !email) {
      setError("Faltan parámetros de impersonación");
      return;
    }

    (async () => {
      const { error } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash,
      });
      if (error) {
        setError(error.message);
        return;
      }
      try { sessionStorage.setItem("lovable-impersonating-email", email); } catch {}
      window.location.replace(redirect);
    })();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-bold text-destructive">No se pudo impersonar</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}