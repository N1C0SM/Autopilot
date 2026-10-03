import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { TrainerApplyModal } from "@/components/TrainerOffer";

type PublicPlan = { name: string; description: string; price: number; currency: string; billing_interval: string; max_clients: number; features: unknown; accepting_new_subscriptions: boolean };

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background flex items-center justify-center px-5">
    <div className="max-w-lg w-full rounded-2xl border border-border bg-card p-8 text-center space-y-4">{children}</div>
  </div>
);

/** Landing B2B. Solo existe si el admin lo activó y lo hizo visible (validado en servidor). */
export default function ForTrainers() {
  const [plan, setPlan] = useState<PublicPlan | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => { void supabase.rpc("get_trainer_plan_public").then(({ data }) => setPlan(data?.[0] ?? null)); }, []);
  if (plan === undefined) return <Shell><Loader2 className="mx-auto w-6 h-6 animate-spin text-primary" /></Shell>;
  if (!plan) return <Shell><h1 className="font-display text-xl font-bold">Página no disponible</h1><Button asChild variant="outline"><Link to="/">Volver al inicio</Link></Button></Shell>;
  return (
    <Shell>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Autopilot para entrenadores</p>
      <h1 className="font-display text-2xl font-bold">Gestiona a tus clientes con Autopilot.</h1>
      <p className="text-sm text-muted-foreground">{plan.description}</p>
      <p className="text-sm font-semibold">Plan a medida de tu número de clientes y tu forma de trabajar.</p>
      <ul className="text-sm text-left space-y-1">{(Array.isArray(plan.features) ? plan.features as string[] : []).filter((f) => !/cliente/i.test(f) || !/\d/.test(f)).map((f) => <li key={f}>· {f}</li>)}</ul>
      {plan.accepting_new_subscriptions
        ? <Button variant="hero" className="w-full" onClick={() => setOpen(true)}>Personalizar mi acceso</Button>
        : <p className="text-sm text-muted-foreground">Ahora mismo no aceptamos nuevas altas.</p>}
      <TrainerApplyModal plan={plan} open={open} onClose={() => setOpen(false)} />
    </Shell>
  );
}

const ERRORS: Record<string, string> = {
  b2b_disabled: "Esta invitación no está disponible ahora mismo.",
  invitation_invalid: "Esta invitación ya no es válida.",
  invitation_expired: "Esta invitación ha caducado. Pide a tu entrenador una nueva.",
  invitation_email_mismatch: "Esta invitación es para otro email. Entra con la cuenta invitada.",
  client_limit_reached: "Tu entrenador ha alcanzado su límite de clientes.",
};

/** Aceptar una invitación de un entrenador B2B. */
export function AcceptInvitation() {
  const { token = "" } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate(`/login?redirect=/invitacion/${token}`); return; }
    void supabase.rpc("accept_trainer_invitation", { _token: token }).then(({ error }) => {
      if (!error) { navigate("/dashboard"); return; }
      const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
      setMsg(key ? ERRORS[key] : "No se ha podido aceptar la invitación.");
    });
  }, [user, loading, token, navigate]);
  return <Shell>{msg ? <><p className="text-sm">{msg}</p><Button asChild variant="outline"><Link to="/dashboard">Ir a mi panel</Link></Button></> : <Loader2 className="mx-auto w-6 h-6 animate-spin text-primary" />}</Shell>;
}
