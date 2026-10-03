import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Briefcase, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { track } from "@/lib/analytics";

type Plan = { name: string; description: string; features: unknown; accepting_new_subscriptions: boolean };

const STEPS = [
  { key: "clients", q: "¿A cuántos clientes entrenas ahora?", opts: ["Estoy empezando", "1 a 5", "6 a 15", "16 a 30", "Más de 30"] },
  { key: "tools", q: "¿Cómo los gestionas hoy?", opts: ["WhatsApp y Excel", "PDFs y notas", "Otra aplicación", "Nada organizado"] },
  { key: "goal", q: "¿Qué quieres mejorar?", opts: ["Ahorrar tiempo en rutinas", "Centralizar el chat", "Añadir nutrición", "Todo en uno"] },
] as const;

const contact = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(100),
  email: z.string().trim().email("Email no válido").max(255),
  phone: z.string().trim().max(30).optional(),
});

/** Hook: plan B2B público (null si está apagado u oculto). */
export function useTrainerPlan() {
  const [plan, setPlan] = useState<Plan | null>(null);
  useEffect(() => { void supabase.rpc("get_trainer_plan_public").then(({ data }) => setPlan((data?.[0] as Plan) ?? null)); }, []);
  return plan;
}

export function TrainerApplyModal({ plan, open, onClose }: { plan: Plan; open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(-1); // -1 = vista previa, 0..2 preguntas, 3 contacto, 4 hecho
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [phone, setPhone] = useState("");
  const features = Array.isArray(plan.features) ? (plan.features as string[]).filter((f) => !/cliente/i.test(f) || !/\d/.test(f)) : [];

  useEffect(() => { if (open) { setStep(-1); setAnswers({}); setError(""); } }, [open]);
  useEffect(() => {
    void supabase.rpc("get_contact_phone_public").then(({ data }) => setPhone((data as string) || ""));
  }, []);
  const waDigits = phone.replace(/\D/g, "");
  const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent("Hola, acabo de enviar mi solicitud de Autopilot para entrenadores.")}` : "";

  const submit = async () => {
    const r = contact.safeParse(form);
    if (!r.success) return setError(r.error.issues[0].message);
    setSending(true);
    const { error: e } = await supabase.from("leads").insert({
      email: r.data.email, source: "trainer_application", occupation: "trainer",
      quiz_answers: { ...answers, name: r.data.name, phone: r.data.phone || "" },
    });
    setSending(false);
    if (e) return setError("No se ha podido enviar. Inténtalo de nuevo.");
    track("trainer_apply_submit" as never, { clients: answers.clients });
    setStep(4);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <DialogTitle className="sr-only">Autopilot para entrenadores</DialogTitle>
        {step >= 0 && step < 4 && (
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Atrás" onClick={() => setStep(step - 1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /></button>
            <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
            <span className="text-xs text-muted-foreground">{step + 1}/4</span>
          </div>
        )}

        {step === -1 && (
          <div className="space-y-3">
            <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">Para entrenadores</span>
            <h3 className="font-display text-xl font-bold">{plan.name || "Autopilot para entrenadores"}</h3>
            <p className="text-sm text-muted-foreground leading-snug line-clamp-3">{plan.description}</p>
            {features.length > 0 && (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">{features.map((f) => <li key={f} className="flex gap-2 text-xs sm:text-sm"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />{f}</li>)}</ul>
            )}
            <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm"><span className="font-semibold">Plan a medida.</span> <span className="text-muted-foreground">Se adapta a tu número de clientes y a tu forma de trabajar.</span></div>
            {plan.accepting_new_subscriptions
              ? <Button variant="hero" size="lg" className="w-full" onClick={() => { setStep(0); track("trainer_apply_start" as never, {}); }}>Personalizar mi acceso (1 min) <ArrowRight className="w-4 h-4" /></Button>
              : <p className="text-sm text-muted-foreground text-center">Ahora mismo no aceptamos nuevas altas.</p>}
          </div>
        )}

        {step >= 0 && step < 3 && (
          <div className="space-y-4">
            <h3 className="font-display text-xl font-bold">{STEPS[step].q}</h3>
            <div className="grid gap-2">
              {STEPS[step].opts.map((o) => (
                <button key={o} type="button" onClick={() => { setAnswers({ ...answers, [STEPS[step].key]: o }); setStep(step + 1); }}
                  className={`text-left rounded-xl border px-4 py-3 text-sm transition-colors ${answers[STEPS[step].key] === o ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>{o}</button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <h3 className="font-display text-xl font-bold">¿Dónde te enviamos tu propuesta?</h3>
            <Input placeholder="Nombre" value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input type="email" placeholder="Email" value={form.email} maxLength={255} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Teléfono o WhatsApp (opcional)" value={form.phone} maxLength={30} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button variant="hero" size="lg" className="w-full" disabled={sending} onClick={() => void submit()}>Enviar solicitud</Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
            <h3 className="font-display text-xl font-bold">Solicitud recibida</h3>
            <p className="text-sm text-muted-foreground">Revisaremos tus respuestas ({answers.clients} clientes) y te escribiremos con tu propuesta a medida.</p>
            {waUrl && (
              <Button variant="hero" size="lg" className="w-full" asChild>
                <a href={waUrl} target="_blank" rel="noopener noreferrer">Hablar por WhatsApp para activar hoy</a>
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Tarjeta bajo los planes. Solo aparece si el admin activó y hizo visible el producto. */
export default function TrainerOffer() {
  const plan = useTrainerPlan();
  const [open, setOpen] = useState(false);
  if (!plan) return null;
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); track("trainer_preview_open" as never, {}); }}
        className="group mt-8 w-full max-w-6xl mx-auto text-left rounded-lg border border-border bg-card/60 p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5 hover:border-primary/40 transition-colors">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Briefcase className="w-5 h-5 text-primary" /></div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Para entrenadores</span>
          <h3 className="font-display text-xl font-bold mt-1">¿Entrenas a tus propios clientes?</h3>
          <p className="text-sm text-muted-foreground mt-1">Gestiona sus planes, su progreso y el chat con Autopilot. Plan a medida de tu negocio.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary whitespace-nowrap">Personalizar mi acceso <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></span>
      </button>
      <TrainerApplyModal plan={plan} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
