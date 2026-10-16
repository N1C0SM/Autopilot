import { useEffect, useState } from "react";
import { z } from "zod";
import { Briefcase, Check, CheckCircle2, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Spinner } from "@/components/ui/spinner";
import { hapticTap } from "@/lib/native";
import { track } from "@/lib/analytics";
import { isIOSNative } from "@/lib/platform";

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
      <DialogContent className="sm:max-w-xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">Autopilot para entrenadores</DialogTitle>
        {step >= 0 && step < 4 && (
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Atrás" onClick={() => { void hapticTap(); setStep(step - 1); }} className="-ml-2 flex h-11 w-11 items-center justify-center text-primary transition-opacity active:opacity-60"><ChevronLeft className="h-6 w-6" strokeWidth={2.25} /></button>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all duration-300 ease-ios" style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
            <span className="type-footnote tabular-nums text-muted-foreground">{step + 1}/4</span>
          </div>
        )}

        {step === -1 && (
          <div className="space-y-4">
            <div>
              <p className="type-subhead text-primary">Para entrenadores</p>
              <h3 className="mt-1 type-title2">{plan.name || "Autopilot para entrenadores"}</h3>
              <p className="mt-2 line-clamp-3 type-subhead text-muted-foreground">{plan.description}</p>
            </div>
            {features.length > 0 && (
              <ul className="space-y-2.5">{features.map((f) => <li key={f} className="flex items-start gap-3 type-subhead"><Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />{f}</li>)}</ul>
            )}
            <p className="type-subhead"><span className="font-semibold">Plan a medida.</span> <span className="text-muted-foreground">Se adapta a tu número de clientes y a tu forma de trabajar.</span></p>
            {plan.accepting_new_subscriptions
              ? <Button variant="hero" size="lg" className="w-full" onClick={() => { void hapticTap(); setStep(0); track("trainer_apply_start" as never, {}); }}>Personalizar mi acceso (1 min)</Button>
              : <p className="text-center type-subhead text-muted-foreground">Ahora mismo no aceptamos nuevas altas.</p>}
          </div>
        )}

        {step >= 0 && step < 3 && (
          <div className="space-y-4">
            <h3 className="type-title2">{STEPS[step].q}</h3>
            <ListGroup inset>
              {STEPS[step].opts.map((o) => (
                <ListRow key={o} title={o} value={answers[STEPS[step].key] === o ? <Check className="h-5 w-5 text-primary" aria-hidden="true" /> : undefined}
                  onClick={() => { setAnswers({ ...answers, [STEPS[step].key]: o }); setStep(step + 1); }} />
              ))}
            </ListGroup>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <h3 className="type-title2">¿Dónde te enviamos tu propuesta?</h3>
            <Input placeholder="Nombre" value={form.name} maxLength={100} autoCapitalize="words" autoComplete="name" enterKeyHint="next" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input type="email" placeholder="Email" value={form.email} maxLength={255} inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" enterKeyHint="next" onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input type="tel" placeholder="Teléfono o WhatsApp (opcional)" value={form.phone} maxLength={30} inputMode="tel" autoComplete="tel" enterKeyHint="done" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            {error && <p className="type-footnote text-destructive">{error}</p>}
            <Button variant="hero" size="lg" className="w-full" disabled={sending} onClick={() => { void hapticTap(); void submit(); }}>{sending && <Spinner size="sm" className="text-primary-foreground" />}Enviar solicitud</Button>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[22%] bg-secondary"><CheckCircle2 className="h-8 w-8 text-primary" strokeWidth={1.75} /></div>
            <h3 className="mt-5 type-title2">Solicitud recibida</h3>
            <p className="mt-1.5 max-w-[34ch] type-subhead text-muted-foreground">Revisaremos tus respuestas ({answers.clients} clientes) y te escribiremos con tu propuesta a medida.</p>
            <div className="mt-6 flex w-full flex-col gap-1">
              {waUrl && (
                <Button variant="hero" size="lg" className="w-full" asChild>
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={() => void hapticTap()}>Hablar por WhatsApp para activar hoy</a>
                </Button>
              )}
              <Button variant="plain" onClick={() => { void hapticTap(); onClose(); }}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Oferta bajo los planes. Solo aparece si el admin activó y hizo visible el producto. */
export default function TrainerOffer() {
  // iOS v1 (reader app, App Store §3.1.3(a)): hide B2B upsell inside the native build.
  if (isIOSNative()) return null;
  return <TrainerOfferContent />;
}

function TrainerOfferContent() {
  const plan = useTrainerPlan();
  const [open, setOpen] = useState(false);
  if (!plan) return null;
  return (
    <>
      <button type="button" onClick={() => { void hapticTap(); setOpen(true); track("trainer_preview_open" as never, {}); }}
        className="mx-auto mt-10 flex w-full max-w-2xl items-start gap-4 text-left transition-opacity active:opacity-60">
        <span className="flex w-10 shrink-0 justify-center pt-0.5"><Briefcase className="h-7 w-7 text-primary" strokeWidth={1.75} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block type-subhead text-primary">Para entrenadores</span>
          <h3 className="mt-0.5 type-headline">¿Entrenas a tus propios clientes?</h3>
          <span className="mt-1 block type-subhead text-muted-foreground">Gestiona sus planes, su progreso y el chat con Autopilot. Plan a medida de tu negocio.</span>
          <span className="mt-3 block type-body text-primary">Personalizar mi acceso</span>
        </span>
      </button>
      <TrainerApplyModal plan={plan} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
