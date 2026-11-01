import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/shared/integrations/supabase/client";
import { useAuth } from "@/shared/contexts/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { AlertCircle, Briefcase, Check } from "lucide-react";
import { TrainerApplyModal } from "@/web/components/TrainerOffer";
import { hapticTap } from "@/shared/lib/native";

type PublicPlan = { name: string; description: string; price: number; currency: string; billing_interval: string; max_clients: number; features: unknown; accepting_new_subscriptions: boolean };

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-10 text-foreground pt-safe pb-safe">
    <div className="w-full max-w-md text-center">{children}</div>
  </div>
);

const Squircle = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[22%] bg-card">{children}</div>
);

/** Landing B2B. Solo existe si el admin lo activó y lo hizo visible (validado en servidor). */
export default function ForTrainers() {
  const [plan, setPlan] = useState<PublicPlan | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => { void supabase.rpc("get_trainer_plan_public").then(({ data }) => setPlan(data?.[0] ?? null)); }, []);
  if (plan === undefined) return <Shell><Spinner size="lg" className="mx-auto" /></Shell>;
  // Sin plan activo la página no existe: quien llegue por un enlace antiguo vuelve a
  // precios en vez de encontrarse un callejón sin salida (el pie ya no la enlaza).
  if (!plan) return <Navigate to="/planes" replace />;
  return (
    <Shell>
      <Squircle><Briefcase className="h-8 w-8 text-primary" strokeWidth={1.75} /></Squircle>
      <p className="mt-6 type-subhead text-primary">Autopilot para entrenadores</p>
      <h1 className="mt-1 type-title1">Gestiona a tus clientes con Autopilot.</h1>
      <p className="mt-3 type-body text-muted-foreground">{plan.description}</p>
      <ul className="mt-8 space-y-3 text-left">{(Array.isArray(plan.features) ? plan.features as string[] : []).filter((f) => !/cliente/i.test(f) || !/\d/.test(f)).map((f) => <li key={f} className="flex items-start gap-3 type-subhead"><Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />{f}</li>)}</ul>
      <p className="mt-6 type-subhead font-semibold">Plan a medida de tu número de clientes y tu forma de trabajar.</p>
      <div className="mt-6">
        {plan.accepting_new_subscriptions
          ? <Button variant="hero" size="lg" className="w-full" onClick={() => { void hapticTap(); setOpen(true); }}>Personalizar mi acceso</Button>
          : <p className="type-subhead text-muted-foreground">Ahora mismo no aceptamos nuevas altas.</p>}
        <Button asChild variant="plain" className="mt-1"><Link to="/" onClick={() => void hapticTap()}>Volver al inicio</Link></Button>
      </div>
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
  return <Shell>{msg ? <EmptyState icon={AlertCircle} title={msg} action={<Button asChild variant="plain"><Link to="/dashboard">Ir a mi panel</Link></Button>} /> : <Spinner size="lg" className="mx-auto" />}</Shell>;
}
