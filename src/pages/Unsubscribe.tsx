import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hapticTap } from "@/lib/native";

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
    void hapticTap();
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

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main
      className="min-h-screen bg-background flex items-center justify-center px-4"
      style={{ paddingTop: "var(--safe-top, 0px)", paddingBottom: "var(--safe-bottom, 0px)" }}
    >
      <div className="w-full max-w-sm text-center">{children}</div>
    </main>
  );

  const Icon = ({ children }: { children: React.ReactNode }) => (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22%] bg-secondary">{children}</div>
  );

  if (state === "loading" || state === "submitting") {
    return (
      <Shell>
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
        <p className="mt-4 text-[15px] text-muted-foreground">{state === "loading" ? "Verificando…" : "Dando de baja…"}</p>
      </Shell>
    );
  }

  if (state === "valid") {
    return (
      <Shell>
        <Icon><MailX className="h-7 w-7 text-primary" strokeWidth={1.75} /></Icon>
        <h1 className="mt-6 text-[28px] font-bold font-display leading-[1.1] tracking-[-0.03em]">¿Dejar de recibir emails?</h1>
        <p className="mt-2 text-[15px] leading-snug text-muted-foreground">No recibirás más recordatorios por email de Autopilot.</p>
        <Button variant="hero" size="lg" onClick={confirm} className="mt-10 h-[52px] w-full text-[17px] font-semibold tracking-[-0.015em]">
          Confirmar baja
        </Button>
      </Shell>
    );
  }

  if (state === "done") {
    return (
      <Shell>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary">
          <CheckCircle2 className="h-8 w-8 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <h1 className="mt-6 text-[28px] font-bold font-display leading-[1.1] tracking-[-0.03em]">Listo</h1>
        <p className="mt-2 text-[15px] leading-snug text-muted-foreground">Te hemos dado de baja de los emails.</p>
      </Shell>
    );
  }

  if (state === "already") {
    return (
      <Shell>
        <Icon><CheckCircle2 className="h-7 w-7 text-muted-foreground" strokeWidth={1.75} /></Icon>
        <h1 className="mt-6 text-[28px] font-bold font-display leading-[1.1] tracking-[-0.03em]">Ya estabas dado de baja</h1>
      </Shell>
    );
  }

  return (
    <Shell>
      <Icon><XCircle className="h-7 w-7 text-destructive" strokeWidth={1.75} /></Icon>
      <h1 className="mt-6 text-[28px] font-bold font-display leading-[1.1] tracking-[-0.03em]">
        {state === "invalid" ? "Enlace no válido" : "Algo salió mal"}
      </h1>
      <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
        {state === "invalid" ? "El enlace está caducado o es incorrecto." : "Inténtalo de nuevo más tarde."}
      </p>
    </Shell>
  );
};

export default Unsubscribe;
