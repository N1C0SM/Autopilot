import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import Screen from "@/components/native/Screen";

export default function ImpersonateCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Aseguramos el flag (ya lo seteó index.html, pero por si acaso).
    try { sessionStorage.setItem("lovable-impersonating", "1"); } catch { /* Best-effort browser feature; the primary flow remains available. */ }

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
      try { sessionStorage.setItem("lovable-impersonating-email", email); } catch { /* Best-effort browser feature; the primary flow remains available. */ }
      window.location.replace(redirect);
    })();
  }, []);

  if (error) {
    return (
      <Screen hideBack centered maxWidth="sm">
        <EmptyState icon={ShieldAlert} title="No se pudo impersonar" description={error} />
      </Screen>
    );
  }

  return (
    <main className="flex h-dvh items-center justify-center bg-background">
      <Spinner size="lg" />
    </main>
  );
}
