import { COACH_CONTACT_CHANNEL, COACH_CONTACT_FEATURE, type PlanKey } from "@/config/tiers";
import { DASHBOARD_CHAT_ENABLED } from "@/lib/releaseScope";
import { Check, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { Link } from "react-router-dom";
import TrainerOffer from "@/components/TrainerOffer";
import { availabilityFrom, euro, usePlanCatalog } from "@/lib/planCatalog";
import { isIOSNative } from "@/lib/platform";
import { hapticTap } from "@/lib/native";

interface PricingTiersProps {
  onSelect: (plan: PlanKey) => void;
  recommended?: PlanKey;
}


const PricingTiers = (props: PricingTiersProps) => {
  // iOS v1 (App Store §3.1.1: sin venta de bienes digitales; §3.1.3(a) no cubre fitness): no pricing UI inside the native build.
  if (isIOSNative()) return null;
  return <PricingTiersContent {...props} />;
};

const PricingTiersContent = ({ onSelect, recommended = "training" }: PricingTiersProps) => {
  const plans = usePlanCatalog();
  const a = availabilityFrom(plans);
  const upgradeNames = [a.plus && a.plusName, a.coach && a.coachName].filter(Boolean).join(" o ");
  return (
    <div className="mx-auto max-w-6xl">
      <div
        className={`mx-auto grid items-stretch gap-4 md:gap-5 ${
          plans.length <= 1
            ? "max-w-md grid-cols-1"
            : plans.length === 2
              ? "max-w-4xl md:grid-cols-2"
              : "max-w-6xl md:grid-cols-3"
        }`}
      >
        {plans.map((t) => {
          const key = t.key;
          const isRec = key === recommended;
          const price = t.price;
          // El catálogo de Admin puede traer la ficha antigua con chat/videollamada:
          // mientras el chat esté apagado se sustituye por el canal real (email).
          const features = key === "full" && !DASHBOARD_CHAT_ENABLED
            ? Array.from(new Set(t.features.map((f) => (/chat|videollamada/i.test(f) ? COACH_CONTACT_FEATURE : f))))
            : t.features;
          return (
            <div key={key} className="flex h-full flex-col rounded-2xl bg-card p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="type-title3">{t.name}</h3>
                {isRec && <span className="type-footnote font-semibold text-primary">Recomendado</span>}
              </div>
              <p className="mt-1 min-h-[2.5rem] type-subhead text-muted-foreground">{t.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className={`font-rounded text-[44px] font-bold leading-none tabular-nums ${isRec ? "text-primary" : "text-foreground"}`}>
                  {price === 0 ? "Gratis" : euro(price)}
                </span>
                <span className="type-subhead text-muted-foreground">{price === 0 ? "" : " al mes"}</span>
              </div>
              <p className="mb-6 mt-2 type-footnote font-medium">
                {t.price === 0 ? "Sin tarjeta ni prueba que cancelar" : t.trial_days > 0 ? `${t.trial_days} días de prueba` : "Sin prueba"}
              </p>

              <ul className="mb-6 flex-1 space-y-3">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-3 type-subhead">
                    <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
                {t.notIncluded.map((f) => (
                  <li key={f} className="flex items-start gap-3 type-subhead text-muted-foreground/60">
                    <X className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="line-through">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={isRec ? "hero" : "tinted"}
                size="lg"
                className="w-full"
                disabled={!t.accepting}
                onClick={() => {
                  void hapticTap();
                  if (key === "free") {
                    track("plan_select", { plan: "free", source: "pricing" });
                    window.location.assign("/onboarding");
                  } else onSelect(key);
                }}
              >
                {t.accepting ? t.cta : "Plazas cerradas"}
              </Button>
              <p className="mt-3 type-footnote text-muted-foreground">{t.price === 0 ? (upgradeNames ? `Empieza desde el móvil y pasa a ${upgradeNames} cuando tenga sentido.` : "Empieza desde el móvil, sin tarjeta.") : t.trial_days > 0 ? `Tras ${t.trial_days} días: ${euro(t.price)}/mes, con renovación automática. Cancela desde Ajustes → Suscripción.` : `${euro(t.price)}/mes, con renovación automática. Cancela desde Ajustes → Suscripción.`}</p>
            </div>
          );
        })}
      </div>

      <TrainerOffer />

      <div className="mx-auto mt-8 max-w-lg space-y-2 text-center type-footnote text-muted-foreground">
        <p>
          Free no caduca y no pide tarjeta.{(a.plus || a.coach) && <> {a.paidNames} {a.plus && a.coach ? "piden" : "pide"} tarjeta al empezar la prueba de 7 días; el primer cobro llega el día 8 si no cancelas desde Ajustes → Suscripción. Sin permanencia.</>}
        </p>
        {a.coach ? (
          <p className="text-foreground">
            {a.plus && <>{a.plusName} funciona sin atención humana. </>}En {a.coachName} te atiende Nicolás, el fundador: responde {COACH_CONTACT_CHANNEL} en horario normal, no 24/7.
          </p>
        ) : a.plus ? (
          <p className="text-foreground">
            {a.plusName} funciona de forma automática con tus registros, sin atención humana.
          </p>
        ) : null}
        {(a.plus || a.coach) && <p className="flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" /> Garantía de devolución de 30 días en planes mensuales
        </p>}
        <p><Link to="/legal/terminos" className="inline-flex min-h-11 items-center text-primary transition-opacity active:opacity-60">Ver condiciones de prueba, cancelación y devolución</Link></p>
      </div>
    </div>
  );
};

export default PricingTiers;
