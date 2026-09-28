import { TIERS, type PlanKey } from "@/config/tiers";
import { CheckCircle2, X, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

interface PricingTiersProps {
  onSelect: (plan: PlanKey) => void;
  recommended?: PlanKey;
}

const ORDER: PlanKey[] = ["free", "training", "full"];

const PricingTiers = ({ onSelect, recommended = "full" }: PricingTiersProps) => {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid md:grid-cols-3 gap-5 md:gap-6 items-stretch max-w-6xl mx-auto">
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
              className={`relative rounded-lg p-7 sm:p-8 flex flex-col h-full overflow-hidden ${
                isRec
                  ? "bg-secondary border-2 border-primary premium-shadow"
                  : "bg-card/60 border border-border"
              }`}
            >
              {isRec && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                  Incluye nutrición
                </div>
              )}

              <div className="mb-1 pr-14">
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
                  {t.price === 0 ? "Gratis" : `€${t.price}`}
                </span>
                <span className="text-muted-foreground text-sm">
                  {t.price === 0 ? "" : " al mes"}
                </span>
              </div>
                 <div className="inline-flex items-center gap-1.5 text-[11px] text-primary font-semibold mb-6">
                  {t.price === 0 ? "Sin tarjeta ni prueba que cancelar" : <><Sparkles className="w-3 h-3" /> 7 días de prueba</>}
               </div>

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
                variant={key === "free" ? "hero" : isRec ? "hero" : "outline"}
                size="lg"
                className="w-full hover-scale"
                onClick={() => key === "free" ? window.location.assign("/signup?free=true") : onSelect(key)}
              >
                {key === "free" ? "Empezar gratis" : t.cta}
              </Button>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t.price === 0 ? "Empieza desde el móvil y decide más adelante si quieres seguimiento humano." : `Tras 7 días: ${t.price}€/mes, con renovación automática. Cancela desde Ajustes → Suscripción.`}</p>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6 max-w-md mx-auto leading-relaxed">
        Después de probar Gratis, puedes seguir por <span className="text-foreground font-semibold">29€/mes</span> o{" "}
        <span className="text-foreground font-semibold">49€/mes</span> según el plan. Sin permanencia. Cancela desde Ajustes → Suscripción.
      </p>
      <p className="text-center text-xs text-foreground/80 mt-2 max-w-lg mx-auto leading-relaxed">
        En ambos planes, un entrenador real prepara tu entrenamiento y atiende tu seguimiento. La nutrición personalizada está incluida en Completo.
      </p>
      <p className="text-center text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-success" /> Garantía de devolución de 30 días en planes mensuales
      </p>
      <p className="mt-2 text-center text-xs"><Link to="/legal/terminos" className="text-primary underline underline-offset-4">Ver condiciones de prueba, cancelación y devolución</Link></p>
    </div>
  );
};

export default PricingTiers;
