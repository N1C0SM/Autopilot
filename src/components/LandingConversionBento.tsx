import {
  ArrowRight,
  BarChart3,
  Check,
  MessageCircle,
  ScanLine,
  ShieldCheck,
  User,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ScrollReveal from "@/components/ScrollReveal";

interface Trainer {
  trainer_name: string;
  trainer_photo_url: string;
  trainer_bio: string;
}

interface Testimonial {
  name: string;
  result: string;
  text: string;
  photo_url: string | null;
  photo_before_url: string | null;
  photo_after_url: string | null;
}

interface Props {
  trainer: Trainer;
  testimonials: Testimonial[];
  onScan: () => void;
}

const steps = [
  {
    icon: ScanLine,
    number: "01",
    title: "Conocemos tu punto de partida",
    text: "Haces el análisis inicial y nos cuentas tu objetivo, disponibilidad y material.",
  },
  {
    icon: User,
    number: "02",
    title: "Tu entrenador prepara el plan",
    text: "Una persona real estudia tu caso y organiza un entrenamiento que puedas cumplir.",
  },
  {
    icon: Wrench,
    number: "03",
    title: "Lo ajusta contigo",
    text: "Le escribes por chat y adapta tu semana según avances, horarios y sensaciones.",
  },
];

const LandingConversionBento = ({ trainer, testimonials, onScan }: Props) => {
  const visibleTestimonials = testimonials.slice(0, 3);

  return (
    <section id="como-funciona" className="border-y border-border bg-card/20 px-4 py-14 sm:py-18">
      <div className="container mx-auto max-w-5xl">
        <ScrollReveal>
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">
              Lo que recibes
            </p>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
              Un plan que encaja en tu vida. <span className="text-gradient">Y alguien que lo lleva contigo.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              No compras una rutina automática. Compras criterio, seguimiento y ajustes de un entrenador real.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid gap-4 md:grid-cols-3">
          <ScrollReveal className="md:col-span-2">
            <article className="flex h-full flex-col justify-between rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/40 sm:p-8">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary">
                    <BarChart3 className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-2xl font-bold">Tecnología para entenderte. Entrenador para ayudarte.</h3>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    La IA apoya el análisis inicial. {trainer.trainer_name} revisa tu situación, habla contigo y se encarga de preparar y ajustar el plan.
                  </p>
                </div>
                {trainer.trainer_photo_url ? (
                  <img
                    src={trainer.trainer_photo_url}
                    alt={`${trainer.trainer_name}, entrenador de Autopilot`}
                    loading="lazy"
                    className="hidden h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-primary/30 sm:block"
                  />
                ) : null}
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Plan personal</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Chat directo</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Ajustes reales</span>
              </div>
            </article>
          </ScrollReveal>

          <ScrollReveal delay={0.06}>
            <article className="flex h-full flex-col rounded-lg border border-primary/30 bg-secondary p-6">
              <div className="mb-5 flex items-center gap-3">
                {trainer.trainer_photo_url ? (
                  <img
                    src={trainer.trainer_photo_url}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/30"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
                    <User className="h-4 w-4 text-primary" />
                  </span>
                )}
                <div>
                  <p className="text-sm font-semibold">{trainer.trainer_name}</p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Tu entrenador
                  </p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="ml-8 rounded-lg rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
                  Esta semana solo puedo entrenar 3 días.
                </div>
                <div className="mr-5 rounded-lg rounded-bl-sm border border-border bg-card px-3 py-2">
                  Perfecto. Reorganizo el volumen para que sigas avanzando.
                </div>
              </div>
              <div className="mt-auto flex items-center gap-2 pt-5 text-xs text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5 text-primary" /> Hablas con una persona, no con un bot
              </div>
            </article>
          </ScrollReveal>

          {steps.map((step, index) => (
            <ScrollReveal key={step.number} delay={index * 0.05}>
              <article className="h-full rounded-lg border border-border bg-card/70 p-5 transition-colors hover:border-primary/40">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span className="font-display text-xs font-bold text-muted-foreground">{step.number}</span>
                </div>
                <h3 className="font-display text-base font-bold">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          {visibleTestimonials.length > 0 ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {visibleTestimonials.map((testimonial) => (
                <blockquote key={testimonial.name} className="rounded-lg border border-border bg-background/60 p-5">
                  <p className="text-sm leading-relaxed text-foreground/90">“{testimonial.text}”</p>
                  <footer className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs">
                    <span className="font-semibold">{testimonial.name}</span>
                    <span className="text-primary">{testimonial.result}</span>
                  </footer>
                </blockquote>
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "7 días para probarlo",
                  text: "Si en la primera semana ves que no es para ti, lo cancelas y no pagas más.",
                },
                {
                  title: "Revisado por una persona",
                  text: "Tu plan lo prepara y ajusta un entrenador real, no una plantilla automática.",
                },
                {
                  title: "Se adapta a tu semana",
                  text: "Cambias de horario o te lesionas, se lo dices por chat y tu plan cambia contigo.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-background/60 p-5">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4 text-success" /> {item.title}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollReveal>


        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <Button variant="hero" size="lg" onClick={onScan} className="group">
            <ScanLine className="h-4 w-4" />
            <span className="sm:hidden">Análisis inicial gratis</span>
            <span className="hidden sm:inline">Ver mi punto de partida gratis</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" /> Sin tarjeta · 60 segundos · después decides si quieres un entrenador
          </p>
        </div>
      </div>
    </section>
  );
};

export default LandingConversionBento;