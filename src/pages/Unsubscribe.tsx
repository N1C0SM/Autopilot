import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } }
        );
        const data = await r.json();
        if (data.valid) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch { setState("error"); }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON },
        body: JSON.stringify({ token }),
      });
      const data = await r.json();
      if (data.success || data.reason === "already_unsubscribed") setState("done");
      else setState("error");
    } catch { setState("error"); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center">
        {state === "loading" && (<><Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" /><p className="text-muted-foreground">Verificando...</p></>)}
        {state === "valid" && (
          <>
            <h1 className="font-display text-2xl font-bold mb-3">¿Cancelar suscripción a emails?</h1>
            <p className="text-muted-foreground text-sm mb-6">No recibirás más recordatorios por email de Autopilot.</p>
            <Button onClick={confirm} className="w-full">Confirmar baja</Button>
          </>
        )}
        {state === "submitting" && (<Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />)}
        {state === "done" && (<><CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" /><h1 className="font-display text-xl font-bold mb-2">Listo</h1><p className="text-muted-foreground text-sm">Has sido dado de baja de los emails.</p></>)}
        {state === "already" && (<><CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Ya estabas dado de baja.</p></>)}
        {state === "invalid" && (<><XCircle className="w-12 h-12 text-destructive mx-auto mb-4" /><p className="text-muted-foreground">Enlace inválido o caducado.</p></>)}
        {state === "error" && (<><XCircle className="w-12 h-12 text-destructive mx-auto mb-4" /><p className="text-muted-foreground">Error. Inténtalo más tarde.</p></>)}
      </div>
    </div>
  );
};

export default Unsubscribe;