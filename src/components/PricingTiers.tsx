import { type PlanKey } from "@/config/tiers";
import { CheckCircle2, X, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { track } from "@/lib/analytics";
import { Link } from "react-router-dom";
import TrainerOffer from "@/components/TrainerOffer";
import { availabilityFrom, euro, usePlanCatalog } from "@/lib/planCatalog";
import { isIOSNative } from "@/lib/platform";

interface PricingTiersProps {
  onSelect: (plan: PlanKey) => void;
  recommended?: PlanKey;
}


const PricingTiers = (props: PricingTiersProps) => {
  // iOS v1 (reader app, App Store §3.1.3(a)): no pricing UI inside the native build.
  if (isIOSNative()) return null;
  return <PricingTiersContent {...props} />;
};

const PricingTiersContent = ({ onSelect, recommended = "training" }: PricingTiersProps) => {
  const plans = usePlanCatalog();
  const a = availabilityFrom(plans);
  const upgradeNames = [a.plus && a.plusName, a.coach && a.coachName].filter(Boolean).join(" o ");
  return (
    <div className="max-w-6xl mx-auto">
      <div
        className={`grid gap-5 md:gap-6 items-stretch mx-auto ${
          plans.length <= 1
            ? "grid-cols-1 max-w-md"
            : plans.length === 2
              ? "md:grid-cols-2 max-w-4xl"
              : "md:grid-cols-3 max-w-6xl"
        }`}
      >
        {plans.map((t) => {
          const key = t.key;
          const isRec = key === recommended;
          const price = t.price;
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
                  ? "bg-secondary border-2 border-primary"
                  : "bg-card/60"
              }`}
            >
              {isRec && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[11px] font-bold px-3 py-1 rounded-bl-lg">
                  Recomendado
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
                    isRec ? "text-primary" : "text-foreground"
                  }`}
                >
                  {price === 0 ? "Gratis" : euro(price)}
                </span>
                <span className="text-muted-foreground text-sm">
                  {price === 0 ? "" : " al mes"}
                </span>
              </div>
                 <div className="inline-flex items-center gap-1.5 text-[11px] text-primary font-semibold mb-6">
                  {t.price === 0 ? "Sin tarjeta ni prueba que cancelar" : t.trial_days > 0 ? <><Sparkles className="w-3 h-3" /> {t.trial_days} días de prueba</> : "Sin prueba"}
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
                disabled={!t.accepting}
                onClick={() => {
                  if (key === "free") {
                    track("plan_select", { plan: "free", source: "pricing" });
                    window.location.assign("/onboarding");
                  } else onSelect(key);
                }}
              >
                {t.accepting ? t.cta : "Plazas cerradas"}
              </Button>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t.price === 0 ? (upgradeNames ? `Empieza desde el móvil y pasa a ${upgradeNames} cuando tenga sentido.` : "Empieza desde el móvil, sin tarjeta.") : t.trial_days > 0 ? `Tras ${t.trial_days} días: ${euro(t.price)}/mes, con renovación automática. Cancela desde Ajustes → Suscripción.` : `${euro(t.price)}/mes, con renovación automática. Cancela desde Ajustes → Suscripción.`}</p>
            </motion.div>
          );
        })}
      </div>

      <TrainerOffer />

      <p className="text-center text-xs text-muted-foreground mt-6 max-w-md mx-auto leading-relaxed">
        Free no caduca y no pide tarjeta.{(a.plus || a.coach) && <> {a.paidNames} {a.plus && a.coach ? "piden" : "pide"} tarjeta al empezar la prueba de 7 días; el primer cobro llega el día 8 si no cancelas desde Ajustes → Suscripción. Sin permanencia.</>}
      </p>
      {a.coach ? (
        <p className="text-center text-xs text-foreground/80 mt-2 max-w-lg mx-auto leading-relaxed">
          {a.plus && <>{a.plusName} funciona sin atención humana. </>}En {a.coachName} te atiende Nicolás, el fundador: responde por chat en horario normal, no 24/7.
        </p>
      ) : a.plus ? (
        <p className="text-center text-xs text-foreground/80 mt-2 max-w-lg mx-auto leading-relaxed">
          {a.plusName} funciona de forma automática con tus registros, sin atención humana.
        </p>
      ) : null}
      <p className="text-center text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-success" /> Garantía de devolución de 30 días en planes mensuales
      </p>
      <p className="mt-2 text-center text-xs"><Link to="/legal/terminos" className="text-primary underline underline-offset-4">Ver condiciones de prueba, cancelación y devolución</Link></p>
    </div>
  );
};

export default PricingTiers;
