import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, CloudOff, Link2Off as LinkIcon, MailX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import Screen from "@/components/native/Screen";
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

  const shell = (children: React.ReactNode, footer?: React.ReactNode) => (
    <Screen hideBack centered maxWidth="sm" footer={footer}>{children}</Screen>
  );

  if (state === "loading" || state === "submitting") {
    return shell(
      <div className="flex flex-col items-center text-center">
        <Spinner size="lg" label={state === "loading" ? "Verificando" : "Dando de baja"} />
        <p className="mt-4 type-subhead text-muted-foreground">{state === "loading" ? "Verificando…" : "Dando de baja…"}</p>
      </div>,
    );
  }

  if (state === "valid") {
    return shell(
      <EmptyState icon={MailX} title="¿Dejar de recibir emails?" description="No recibirás más recordatorios por email de Autopilot." />,
      <Button variant="hero" size="lg" onClick={confirm} className="w-full">Confirmar baja</Button>,
    );
  }

  if (state === "done") {
    return shell(<EmptyState icon={CheckCircle2} title="Listo" description="Te hemos dado de baja de los emails." />);
  }

  if (state === "already") {
    return shell(<EmptyState icon={CheckCircle2} title="Ya estabas dado de baja" description="No te enviaremos más emails." />);
  }

  return shell(
    <EmptyState
      icon={state === "invalid" ? LinkIcon : CloudOff}
      title={state === "invalid" ? "Enlace no válido" : "Algo salió mal"}
      description={state === "invalid" ? "El enlace está caducado o es incorrecto." : "Inténtalo de nuevo más tarde."}
    />,
  );
};

export default Unsubscribe;
