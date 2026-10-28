import { useState } from "react";
import { Apple, BookOpen, Dumbbell, Home, LineChart, Settings, Sparkles } from "lucide-react";
import { PhoneAppBar, PhoneFrame, PhoneHome, PhoneShot, PhoneTabBar } from "@/web/components/PublicPhone";
import { PublicTrainingScreen } from "@/web/components/PublicAppScreen";
import ScrollWords from "@/web/components/ScrollWords";
import { useScrollProgress } from "@/shared/hooks/useScrollProgress";
import { usePlanAvailability } from "@/shared/lib/planCatalog";

// Datos de ejemplo, los mismos de la demo: nada que la app no muestre.
const WEEK = [{ d: "4 sep", kg: 18 }, { d: "11 sep", kg: 18 }, { d: "18 sep", kg: 20 }, { d: "25 sep", kg: 20 }];

/** Pantalla del portátil: la versión web de la app (barra lateral, Hoy y progreso). */
function LaptopScreen() {
  const plans = usePlanAvailability();
  return <div className="flex h-full flex-col bg-background text-left">
    <div aria-hidden="true" className="flex h-7 shrink-0 items-center gap-1.5 border-b border-border/40 px-3">
      {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-muted-foreground/30" />)}
      <span className="mx-auto rounded-md bg-secondary px-6 py-0.5 type-caption2 text-muted-foreground">autopilotplan.com</span>
    </div>
    <div className="flex min-h-0 flex-1">
      <nav aria-hidden="true" className="hidden w-36 shrink-0 flex-col gap-1 border-r border-border/40 p-3 sm:flex">
        {[[Home, "Inicio"], [Dumbbell, "Entrenamiento"], [Apple, "Nutrición"], [LineChart, "Mi progreso"], [Settings, "Ajustes"], [BookOpen, "Recursos"]].map(([I, label], i) => { const Icon = I as typeof Home; return <span key={label as string} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 type-footnote ${i === 0 ? "bg-secondary font-semibold" : "text-muted-foreground"}`}><Icon className="h-3.5 w-3.5" />{label as string}</span>; })}
      </nav>
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 ">
        <div className="min-w-0 origin-top-left scale-[0.8]"><PhoneHome plans={plans} /></div>

      </div>
    </div>
  </div>;
}

/** Captura REAL de la app de Mac; si aún no está, se pinta la maqueta HTML. */
function LaptopShot() {
  const [failed, setFailed] = useState(false);
  if (failed) return <LaptopScreen />;
  return <img
    src="/app-shots/mac-hoy.jpg"
    alt="Autopilot en el ordenador"
    className="h-full w-full object-cover object-top"
    loading="lazy"
    decoding="async"
    onError={() => setFailed(true)}
  />;
}

/**
 * La app en el móvil y en el ordenador. La tapa del portátil se abre con el scroll
 * y el móvil entra por delante; sin movimiento, ambos se muestran ya colocados.
 */
export default function DeviceShowcase() {
  const plans = usePlanAvailability();
  const [ref, p] = useScrollProgress<HTMLElement>(0.6);
  // Abierto del todo cuando la sección llega a media pantalla.
  const t = Math.min(1, Math.max(0, (p - 0.1) / 0.4));
  const lid = (1 - t) * -80;

  return <section ref={ref} aria-labelledby="dispositivos-titulo" className="overflow-hidden px-5 py-24 sm:px-8 sm:py-32">
    <div className="mx-auto max-w-4xl text-center">
      <p className="type-subhead text-primary">Web y móvil</p>
      <h2 id="dispositivos-titulo" className="mt-2 type-display"><ScrollWords text="Donde entrenes," accent="ahí está." /></h2>
      <p className="mx-auto mt-5 max-w-xl type-body text-muted-foreground md:text-[21px] md:leading-[28px]">Planifica en el ordenador y registra en el gimnasio desde el móvil. Tu rutina y tu progreso, siempre al día.</p>
    </div>

    <div role="img" aria-label="Autopilot en un portátil y en un móvil" className="relative mx-auto mt-16 max-w-5xl" style={{ perspective: "2000px" }}>
      {/* Portátil: pantalla con bisel y base. */}
      <div className="mx-auto w-[92%] origin-bottom will-change-transform" style={{ transform: `rotateX(${lid}deg)` }}>
        <div className="rounded-t-[18px] border border-border/60 bg-secondary p-2 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] sm:p-3">
          <div className="aspect-[16/10] overflow-hidden rounded-[8px]"><LaptopShot /></div>
        </div>
      </div>
      <div aria-hidden="true" className="relative mx-auto h-3 w-full rounded-b-[14px] bg-gradient-to-b from-secondary to-muted sm:h-4">
        <span className="absolute left-1/2 top-0 h-1 w-24 -translate-x-1/2 rounded-b-md bg-black/30" />
      </div>

      {/* Móvil delante, a la derecha, entrando desde abajo. */}
      {/* La caja mide lo que el teléfono escalado (22rem × 44.4rem por el factor), así no desborda. */}
      <div className="absolute -bottom-6 right-[2%] h-[calc(44.4rem*var(--s))] w-[calc(22rem*var(--s))] drop-shadow-[0_30px_40px_rgba(0,0,0,0.7)] [--s:0.36] sm:right-[4%] sm:[--s:0.55] md:[--s:0.66]" style={{ transform: `translateY(${(1 - t) * 80}px)`, opacity: 0.3 + t * 0.7 }}>
        <div className="absolute left-0 top-0 w-[22rem] origin-top-left" style={{ transform: "scale(var(--s))" }}>
          <PhoneShot
            src="/app-shots/entrenar.jpg"
            alt="Pantalla de Entrenar de la app Autopilot"
            fallback={<PhoneFrame screenClassName="h-[44rem]"><PhoneAppBar avatar="N" /><div className="flex-1 overflow-hidden pb-24"><PublicTrainingScreen /></div><PhoneTabBar tabs={[{ key: "home", label: "Hoy", icon: Home }, { key: "training", label: "Entrenar", icon: Dumbbell }, { key: "nutrition", label: "Nutrición", icon: Apple }, { key: "progress", label: "Progreso", icon: Sparkles }]} active="training" onSelect={() => undefined} /></PhoneFrame>}
          />
        </div>
      </div>
    </div>
  </section>;
}
