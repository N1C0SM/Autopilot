import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Check, ArrowRight, Quote, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIERS } from "@/config/tiers";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  contactEmail: string;
}

const TIMELINE = [
  {
    weeks: "Semana 1-2",
    title: "Diagnóstico y adaptación",
    desc: "Diagnóstico físico completo, llamada inicial, ajustamos hábitos básicos y aprendes la técnica de los ejercicios clave.",
  },
  {
    weeks: "Semana 3-6",
    title: "Bloque de fuerza",
    desc: "Construimos base con progresiones medibles. Primeros récords personales y cambios visibles en composición corporal.",
  },
  {
    weeks: "Semana 7-9",
    title: "Hipertrofia y volumen",
    desc: "Subimos volumen y afinamos nutrición. Aquí es donde notarás el cambio en espejo y en cómo te queda la ropa.",
  },
  {
    weeks: "Semana 10-12",
    title: "Pulir y consolidar",
    desc: "Comparativa antes/después, plan de mantenimiento para que conserves resultados y rutina autónoma para seguir solo.",
  },
];

interface Tw {
  name: string;
  result: string | null;
  text: string;
  photo_url: string | null;
  photo_before_url: string | null;
  photo_after_url: string | null;
}

const PremiumTransformation = ({ contactEmail }: Props) => {
  const t = TIERS.transform;
  const [tw, setTw] = useState<Tw | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_testimonials")
        .select("name, result, text, photo_url, photo_before_url, photo_after_url")
        .eq("visible", true)
        .eq("is_12w_transformation", true)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      if (data) setTw(data as Tw);
    })();
  }, []);

  const handleContact = () => {
    const subject = encodeURIComponent("Transformación 12 semanas — solicitud de llamada");
    const body = encodeURIComponent(
      "Hola Nicolás,\n\nMe interesa la Transformación 12 semanas. Me gustaría reservar una llamada y diagnóstico gratis.\n\nGracias."
    );
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <section className="py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/[0.05] blur-[160px]" />
      </div>
      <div className="container mx-auto max-w-3xl text-center mb-10">
        <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
          Opción premium
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight">
          ¿Quieres una transformación más seria?
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
          12 semanas estructuradas con un entrenador asignado, ajustes semanales y comparativa antes/después. Para quien quiere un cambio visible, no probar.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="container mx-auto max-w-3xl"
      >
        <div className="relative bg-gradient-to-br from-card via-card to-primary/[0.04] border border-primary/30 rounded-3xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-0">
            {/* Left */}
            <div className="p-8 sm:p-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 mb-5">
                <Crown className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  Plazas limitadas
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold font-display mb-3">
                {t.name}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-md">
                {t.tagline}
              </p>
              <ul className="grid sm:grid-cols-2 gap-2 mb-6">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Right */}
            <div className="bg-background/40 border-t md:border-t-0 md:border-l border-border p-8 sm:p-10 flex flex-col justify-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Inversión única
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-bold font-display text-gradient">
                  €{t.price}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mb-6">
                12 semanas · pago único
              </div>
              <Button
                variant="hero"
                size="lg"
                className="w-full hover-scale group"
                onClick={handleContact}
              >
                Hablar con un asesor
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <p className="text-[11px] text-muted-foreground mt-3 text-center leading-relaxed">
                Diagnóstico + llamada gratis.<br />
                Plazas limitadas cada mes.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Timeline 12 semanas */}
      <div className="container mx-auto max-w-5xl mt-16">
        <div className="text-center mb-8">
          <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-2">El recorrido</p>
          <h3 className="text-2xl sm:text-3xl font-bold font-display leading-tight">
            Qué pasa <span className="text-gradient">cada bloque</span>
          </h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIMELINE.map((b, i) => (
            <motion.div
              key={b.weeks}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="relative bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors"
            >
              <div className="absolute -top-3 left-5 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tracking-wider">
                {b.weeks.toUpperCase()}
              </div>
              <div className="flex items-center gap-2 mt-2 mb-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h4 className="font-display font-semibold text-base">{b.title}</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Testimonio 12 semanas */}
      {tw && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="container mx-auto max-w-4xl mt-14"
        >
          <div className="relative bg-gradient-to-br from-card via-card to-primary/[0.04] border border-primary/30 rounded-3xl p-8 sm:p-10 overflow-hidden">
            <Quote className="absolute top-6 right-6 w-10 h-10 text-primary/20" />
            <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-4">
              Completó las 12 semanas
            </p>
            <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
              <div>
                <p className="text-base sm:text-lg leading-relaxed mb-5 italic text-foreground/90">
                  "{tw.text}"
                </p>
                <div className="flex items-center gap-3">
                  {tw.photo_url ? (
                    <img src={tw.photo_url} alt={tw.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/30" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/15" />
                  )}
                  <div>
                    <div className="font-semibold text-sm">{tw.name}</div>
                    {tw.result && <div className="text-xs text-primary">{tw.result}</div>}
                  </div>
                </div>
              </div>
              {(tw.photo_before_url || tw.photo_after_url) && (
                <div className="flex gap-2">
                  {tw.photo_before_url && (
                    <div className="relative">
                      <img src={tw.photo_before_url} alt={`Antes — ${tw.name}`} loading="lazy" className="w-28 h-36 sm:w-32 sm:h-40 object-cover rounded-xl border border-border" />
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-background/80 backdrop-blur text-[9px] font-bold uppercase">Antes</span>
                    </div>
                  )}
                  {tw.photo_after_url && (
                    <div className="relative">
                      <img src={tw.photo_after_url} alt={`Después — ${tw.name}`} loading="lazy" className="w-28 h-36 sm:w-32 sm:h-40 object-cover rounded-xl border border-primary/40 ring-2 ring-primary/20" />
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-primary/90 text-primary-foreground text-[9px] font-bold uppercase">Después</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </section>
  );
};

export default PremiumTransformation;
