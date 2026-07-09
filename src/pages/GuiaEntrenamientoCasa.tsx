import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ScanLine,
  Star,
  ShieldCheck,
  Dumbbell,
  Flame,
  Activity,
  Zap,
  Target,
  Heart,
  Sparkles,
} from "lucide-react";

const MODULES = [
  { id: "core", title: "Core", icon: Activity, desc: "Abdomen funcional, control lumbar y estabilidad real — sin machacar cervicales." },
  { id: "gluteos", title: "Glúteos", icon: Flame, desc: "Activación, volumen y fuerza glútea sin necesidad de peso libre." },
  { id: "piernas", title: "Piernas", icon: Dumbbell, desc: "Cuádriceps, femorales y gemelos con progresión unilateral en casa." },
  { id: "espalda", title: "Espalda y postura", icon: Target, desc: "Tirones caseros, control escapular y postura para dejar de encorvarte." },
  { id: "hombros", title: "Hombros", icon: Zap, desc: "Deltoides equilibrados y movilidad segura sin cargas pesadas." },
  { id: "cardio", title: "Cardio · quema grasa", icon: Heart, desc: "Circuitos cortos y progresivos para bajar % graso sin correr una hora." },
] as const;

const TESTIMONIALS = [
  { name: "Álvaro P.", result: "−4 kg en 6 semanas", text: "Empecé sin material y sin tiempo. Con 25 min al día y siguiendo la progresión bajé grasa sin dejar el músculo por el camino." },
  { name: "Marta L.", result: "Postura recuperada", text: "El módulo de espalda y postura fue lo que más me cambió. Me dolía la zona lumbar de estar sentada y en 3 semanas dejó de molestarme." },
  { name: "Iván R.", result: "Rutina real desde cero", text: "Nunca había entrenado. La guía te lleva de la mano, no te suelta 40 ejercicios y ya. Es una progresión que se puede seguir." },
];

const GuiaEntrenamientoCasa = () => {
  const navigate = useNavigate();
  const [buyUrl, setBuyUrl] = useState<string>("");

  useEffect(() => {
    (async () => {
      const res: any = await (supabase.rpc as any)("get_public_settings");
      const s = Array.isArray(res.data) ? res.data[0] : res.data;
      if (s?.guide_ebook_url) setBuyUrl(s.guide_ebook_url);
    })();
  }, []);

  const handleBuy = () => {
    if (buyUrl) window.open(buyUrl, "_blank", "noopener");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Guía de Entrenamiento en Casa sin Material · Autopilot</title>
        <meta
          name="description"
          content="Entrena en casa sin excusas, sin material y con progresión de 4 semanas. 6 módulos por zona corporal para transformar tu físico desde el salón."
        />
        <link rel="canonical" href="https://autopilotplan.com/guia-entrenamiento-casa" />
        <meta property="og:title" content="Guía de Entrenamiento en Casa sin Material · Autopilot" />
        <meta property="og:description" content="4 semanas de progresión, 6 módulos por zona corporal. Sin material. 9,99€." />
      </Helmet>

      {/* Header sticky */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto max-w-5xl flex items-center justify-between h-14 px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver
          </Button>
          <span className="font-display font-bold text-gradient">Autopilot</span>
          <Button
            size="sm"
            variant="hero"
            onClick={handleBuy}
            disabled={!buyUrl}
            className="text-xs px-3"
          >
            9,99€
          </Button>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative px-4 pt-14 pb-16 sm:pt-20 sm:pb-24 overflow-hidden">
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.08] blur-[160px]" />
          </div>
          <div className="container mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/[0.08] mb-6">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                Ebook digital · 4 semanas
              </span>
            </div>
            <h1 className="text-[2.2rem] sm:text-5xl font-bold font-display leading-[1.05] tracking-tight mb-5">
              Guía de Entrenamiento en Casa{" "}
              <span className="text-gradient">sin Material</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8">
              Entrena en casa sin excusas, sin material, con progresión de 4 semanas. 6 módulos por zona corporal para
              transformar tu físico desde el salón.
            </p>

            <div className="flex flex-col items-center gap-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-bold font-display text-gradient">9,99€</span>
                <span className="text-sm text-muted-foreground line-through">19,99€</span>
              </div>
              <Button
                variant="hero"
                size="xl"
                onClick={handleBuy}
                disabled={!buyUrl}
                className="hover-scale shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)] text-base px-8 group w-full sm:w-auto"
              >
                Comprar guía ahora
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
              {!buyUrl && (
                <p className="text-[11px] text-muted-foreground">
                  El enlace de pago se configura desde el panel de admin.
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> PDF descargable</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Sin material</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Pago único</span>
              </div>
            </div>
          </div>
        </section>

        {/* MODULES */}
        <section className="px-4 py-16 sm:py-20 border-t border-border">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12 max-w-xl mx-auto">
              <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Qué incluye</p>
              <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight">
                6 módulos, <span className="text-gradient">un cuerpo entero.</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-3">
                Cada módulo es una progresión de 4 semanas. Empiezas por lo básico y subes de nivel semana a semana.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m) => (
                <article
                  key={m.id}
                  id={m.id}
                  className="scroll-mt-20 bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-4">
                    <m.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-1.5">{m.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIOS */}
        <section className="px-4 py-16 sm:py-20 bg-card/30 border-y border-border">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Resultados reales</p>
              <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight">
                Gente como tú, <span className="text-gradient">entrenando desde el salón.</span>
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="bg-card border border-border rounded-2xl p-5 h-full flex flex-col">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{t.text}"</p>
                  <div className="text-xs mt-4">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-primary"> · {t.result}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BUY CTA GRANDE */}
        <section className="px-4 py-16 sm:py-20">
          <div className="container mx-auto max-w-2xl text-center">
            <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight mb-4">
              Empieza esta semana <span className="text-gradient">desde tu salón.</span>
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              Descarga la guía, elige tu módulo y ponte con la primera sesión hoy mismo.
            </p>
            <Button
              variant="hero"
              size="xl"
              onClick={handleBuy}
              disabled={!buyUrl}
              className="hover-scale shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)] text-base px-8 group w-full sm:w-auto"
            >
              Comprar guía · 9,99€
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-success" /> Pago seguro · acceso inmediato
            </div>
          </div>
        </section>

        {/* CTA A DIAGNÓSTICO */}
        <section className="px-4 py-16 sm:py-20 border-t border-border bg-card/30">
          <div className="container mx-auto max-w-3xl">
            <div className="relative rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-card/60 to-card/60 p-8 sm:p-10 overflow-hidden">
              <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
              <div className="relative text-center">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
                  ¿Quieres ir un paso más allá?
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold font-display leading-tight mb-4">
                  ¿Quieres un plan 100% personalizado <span className="text-gradient">en vez de una guía genérica?</span>
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  Haz el diagnóstico gratuito con IA y un entrenador real convierte tu resultado en un plan hecho para ti.
                </p>
                <Button
                  variant="hero"
                  size="xl"
                  onClick={() => navigate("/scan")}
                  className="hover-scale group"
                >
                  <ScanLine className="w-4 h-4" />
                  Hacer mi diagnóstico gratis
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span><span className="font-display font-bold text-gradient">Autopilot</span> &copy; {new Date().getFullYear()}</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground">Inicio</Link>
            <Link to="/recomendaciones" className="hover:text-foreground">Recomendaciones</Link>
            <Link to="/legal/terminos" className="hover:text-foreground">Términos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default GuiaEntrenamientoCasa;