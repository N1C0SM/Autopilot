import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Loader2, Mail, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildPreview, type QuizAnswers } from "@/lib/quizPreview";

const STEPS = [
  {
    key: "goal" as const,
    title: "¿Qué quieres conseguir?",
    options: [
      { value: "lose_fat", label: "Perder grasa", emoji: "🔥" },
      { value: "gain_muscle", label: "Ganar músculo", emoji: "💪" },
      { value: "performance", label: "Rendir mejor", emoji: "⚡" },
      { value: "health", label: "Estar más sano", emoji: "🌱" },
    ],
  },
  {
    key: "frequency" as const,
    title: "¿Cuántos días a la semana puedes entrenar?",
    options: [
      { value: 2, label: "2 días" },
      { value: 3, label: "3 días" },
      { value: 4, label: "4 días" },
      { value: 5, label: "5 o más" },
    ],
  },
  {
    key: "problem" as const,
    title: "¿Qué te bloquea más hoy?",
    options: [
      { value: "consistency", label: "Falta de constancia" },
      { value: "guidance", label: "No sé qué hacer" },
      { value: "results", label: "No veo resultados" },
      { value: "injuries", label: "Lesiones" },
    ],
  },
  {
    key: "equipment" as const,
    title: "¿Con qué entrenas?",
    options: [
      { value: "gym", label: "Gym", emoji: "🏋️" },
      { value: "calisthenics", label: "Calistenia", emoji: "🤸" },
      { value: "mixed", label: "Mixto", emoji: "⚡" },
    ],
  },
];

export default function MiniPlan() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const total = STEPS.length;
  const current = STEPS[step];

  const select = (v: any) => {
    const updated = { ...answers, [current.key]: v };
    setAnswers(updated);
    if (step < total - 1) setTimeout(() => setStep(step + 1), 150);
    else setTimeout(() => setDone(true), 200);
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-mini-plan", {
        body: { email: email.trim(), answers },
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      toast.error(err?.message ?? "No pudimos enviarlo. Inténtalo de nuevo.");
    }
    setSubmitting(false);
  };

  if (done) {
    const preview = buildPreview(answers);
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl mx-auto space-y-6"
        >
          <div className="text-center space-y-2">
            <Sparkles className="w-10 h-10 text-primary mx-auto" />
            <h1 className="text-3xl font-bold font-display">Tu mini-plan</h1>
          </div>

          <Card title="Insight clave" body={preview.insight} />
          <Card title="El error que estás cometiendo" body={preview.mistake} />
          <Card title="Acción concreta para hoy" body={preview.action} accent />

          {sent ? (
            <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-primary mx-auto" />
              <p className="font-semibold">Mini-plan enviado a {email}</p>
              <p className="text-sm text-muted-foreground">Revisa tu bandeja en 1-2 minutos.</p>
              <Link to="/quiz" className="text-primary text-sm hover:underline inline-block mt-2">
                ¿Lo quieres completo? Empieza tu prueba de 7 días →
              </Link>
            </div>
          ) : (
            <form onSubmit={submitEmail} className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="text-center space-y-1">
                <Mail className="w-6 h-6 text-primary mx-auto" />
                <h3 className="font-semibold">Recíbelo en tu correo + un PDF de 7 días</h3>
                <p className="text-xs text-muted-foreground">Sin spam. Te damos de baja con 1 clic.</p>
              </div>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@ejemplo.com"
                className="h-12"
              />
              <Button variant="hero" size="lg" className="w-full" type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Quiero mi mini-plan"}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-4 py-4 flex items-center gap-4 border-b border-border">
        {step === 0 ? (
          <Link to="/" className="text-muted-foreground hover:text-foreground" aria-label="Inicio">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        ) : (
          <button
            onClick={() => setStep(step - 1)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Atrás"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1">
          <Progress value={((step + 1) / total) * 100} className="h-1.5" />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {step + 1}/{total}
        </span>
      </header>
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold font-display mb-6">{current.title}</h1>
          <div className="space-y-3">
            {current.options.map((opt: any) => (
              <button
                key={String(opt.value)}
                onClick={() => select(opt.value)}
                className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-secondary transition-all flex items-center gap-3"
              >
                {opt.emoji && <span className="text-2xl">{opt.emoji}</span>}
                <span className="font-semibold">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Card({ title, body, accent }: { title: string; body: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 border ${
        accent ? "bg-primary/10 border-primary/20" : "bg-card border-border"
      }`}
    >
      <div
        className={`text-xs uppercase tracking-wide mb-1 ${accent ? "text-primary" : "text-muted-foreground"}`}
      >
        {title}
      </div>
      <p className="text-sm leading-relaxed">{body}</p>
    </div>
  );
}