import { TIERS, type PlanKey } from "@/config/tiers";
import { CheckCircle2, X, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface PricingTiersProps {
  onSelect: (plan: PlanKey) => void;
  recommended?: PlanKey;
}

const ORDER: PlanKey[] = ["training", "full", "transform"];

const PricingTiers = ({ onSelect, recommended = "full" }: PricingTiersProps) => {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid md:grid-cols-3 gap-5 md:gap-6 items-stretch">
        {ORDER.map((key) => {
          const t = TIERS[key];
          const isRec = key === recommended;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.4 }}
              className={`relative rounded-3xl p-7 sm:p-8 flex flex-col h-full overflow-hidden ${
                isRec
                  ? "bg-card border-2 border-primary card-shadow"
                  : "bg-card/60 border border-border"
              }`}
            >
              {isRec && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                  Más recomendado
                </div>
              )}

              <div className="mb-1">
                <h3 className="text-xl font-bold font-display">{t.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed min-h-[2.5rem]">
                  {t.tagline}
                </p>
              </div>

              <div className="mt-5 mb-1 flex items-baseline gap-1">
                <span
                  className={`text-5xl font-bold font-display ${
                    isRec ? "text-gradient" : "text-foreground"
                  }`}
                >
                  €{t.price}
                </span>
                <span className="text-muted-foreground text-sm">
                  {t.interval === "one_time" ? "/12 sem" : "/mes"}
                </span>
              </div>
              {t.trial_days > 0 ? (
                <div className="inline-flex items-center gap-1.5 text-[11px] text-primary font-semibold mb-6">
                  <Sparkles className="w-3 h-3" /> Primera semana gratis
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-[11px] text-primary font-semibold mb-6">
                  <Sparkles className="w-3 h-3" /> Plan 12 semanas · acompañamiento 1:1
                </div>
              )}

              <ul className="space-y-2.5 mb-7 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
                {t.notIncluded.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-muted-foreground/60"
                  >
                    <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="line-through">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={isRec ? "hero" : "outline"}
                size="lg"
                className="w-full hover-scale"
                onClick={() => onSelect(key)}
              >
                {t.cta}
              </Button>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6 max-w-md mx-auto leading-relaxed">
        Después de la primera semana, sigues por <span className="text-foreground font-semibold">29€/mes</span> o{" "}
        <span className="text-foreground font-semibold">49€/mes</span> según el plan. Sin permanencia. Cancelas cuando quieras.
      </p>
      <p className="text-center text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-success" /> Garantía 30 días · Sin permanencia
      </p>
    </div>
  );
};

export default PricingTiers;
