import { motion } from "framer-motion";
import { Crown, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIERS } from "@/config/tiers";

interface Props {
  contactEmail: string;
}

const PremiumTransformation = ({ contactEmail }: Props) => {
  const t = TIERS.transform;
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
    </section>
  );
};

export default PremiumTransformation;
