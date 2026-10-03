import { useState } from "react";
import { TIERS, type PlanKey } from "@/config/tiers";
import { CheckCircle2, X, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { track } from "@/lib/analytics";
import { Link } from "react-router-dom";
import TrainerOffer from "@/components/TrainerOffer";

interface PricingTiersProps {
  onSelect: (plan: PlanKey) => void;
  recommended?: PlanKey;
}

const ORDER: PlanKey[] = ["free", "training", "full"];

const COUPLE: Record<string, number> = { training: 44, full: 74 };

const PricingTiers = ({ onSelect, recommended = "training" }: PricingTiersProps) => {
  const [couple, setCouple] = useState(false);
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-full border border-border bg-card p-1 text-sm">
          {[["Individual", false], ["En pareja · ahorra ~25%", true]].map(([l, v]) => (
            <button key={String(v)} type="button" onClick={() => setCouple(v as boolean)}
              className={`px-4 py-1.5 rounded-full transition-colors ${couple === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {l as string}
            </button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-5 md:gap-6 items-stretch max-w-6xl mx-auto">
        {ORDER.map((key) => {
          const t = TIERS[key];
          const isRec = key === recommended;
          const price = couple && COUPLE[key] ? COUPLE[key] : t.price;
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
                  Más popular
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
                  {price === 0 ? "Gratis" : `€${price}`}
                </span>
                <span className="text-muted-foreground text-sm">
                  {price === 0 ? "" : couple ? " al mes, los dos" : " al mes"}
                </span>
              </div>
              {couple && price > 0 && (
                <p className="text-xs text-muted-foreground mb-1">{price / 2}€ por persona · ahorráis {t.price * 2 - price}€/mes</p>
              )}
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
                variant={isRec ? "hero" : "outline"}
                size="lg"
                className="w-full hover-scale"
                onClick={() => {
                  if (key === "free") {
                    track("plan_select", { plan: "free", source: "pricing" });
                    window.location.assign("/onboarding");
                  } else onSelect(key);
                }}
              >
                {key === "free" ? "Empezar gratis" : t.cta}
              </Button>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t.price === 0 ? "Empieza desde el móvil y pasa a Plus o Coach cuando tenga sentido." : `Tras 7 días: ${t.price}€/mes, con renovación automática. Cancela desde Ajustes → Suscripción.`}</p>
            </motion.div>
          );
        })}
      </div>

      <TrainerOffer />

      <p className="text-center text-xs text-muted-foreground mt-6 max-w-md mx-auto leading-relaxed">
        Puedes quedarte en Free sin límite. Plus ({TIERS.training.price}€/mes) adapta Autopilot a ti; Coach ({TIERS.full.price}€/mes) añade una persona real. Sin permanencia. Cancela desde Ajustes → Suscripción.
      </p>
      <p className="text-center text-xs text-foreground/80 mt-2 max-w-lg mx-auto leading-relaxed">
        Plus funciona solo, sin entrenador humano. Coach incluye todo Plus y un entrenador asignado.
      </p>
      <p className="text-center text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-success" /> Garantía de devolución de 30 días en planes mensuales
      </p>
      <p className="mt-2 text-center text-xs"><Link to="/legal/terminos" className="text-primary underline underline-offset-4">Ver condiciones de prueba, cancelación y devolución</Link></p>
    </div>
  );
};

export default PricingTiers;
