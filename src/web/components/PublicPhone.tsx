import { useState, type ReactNode } from "react";
import { BarChart3, Check, ChevronRight, Dumbbell, Flame as Apple, Layers, type LucideIcon } from "lucide-react";
import type { PlanAvailability } from "@/shared/lib/planCatalogCore";
import { TABS as APP_TABS } from "@/app/components/mobile/MobileTabBar";
import { previewExercises } from "@/web/components/previewData";
import { cn } from "@/shared/lib/utils";

/**
 * Piezas del móvil de la web pública. `PhoneShot` pinta capturas REALES de la app
 * (las de `public/app-shots/`); el resto (PhoneHome, PhoneTabBar…) son la demo interactiva
 * con el mismo diseño que la app (HomeOverview, FloatingMobileNav). Datos de ejemplo, sin red.
 */

export function PhoneFrame({ children, className, screenClassName, chrome = true }: { children: ReactNode; className?: string; screenClassName?: string; chrome?: boolean }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[22rem] rounded-[3.25rem] bg-secondary p-[3px]", className)}>
      <span aria-hidden className="absolute -left-[2px] top-24 h-8 w-[3px] rounded-l-md bg-secondary" />
      <span aria-hidden className="absolute -left-[2px] top-36 h-12 w-[3px] rounded-l-md bg-secondary" />
      <span aria-hidden className="absolute -left-[2px] top-52 h-12 w-[3px] rounded-l-md bg-secondary" />
      <span aria-hidden className="absolute -right-[2px] top-40 h-16 w-[3px] rounded-r-md bg-secondary" />
      <div className={cn("relative flex flex-col overflow-hidden rounded-[3rem] bg-background", screenClassName)}>
        {chrome && <div aria-hidden className="flex shrink-0 items-center justify-between px-8 pb-1 pt-4 type-subhead font-semibold">
          <span>9:41</span>
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 16 12" className="h-3 w-4 fill-current"><rect x="0" y="7" width="3" height="5" rx="0.5" /><rect x="4.5" y="5" width="3" height="7" rx="0.5" /><rect x="9" y="2.5" width="3" height="9.5" rx="0.5" /><rect x="13" y="0" width="3" height="12" rx="0.5" /></svg>
            <svg viewBox="0 0 24 12" className="h-3 w-6"><rect x="0.5" y="0.5" width="20" height="11" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.4" /><rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor" /><rect x="22" y="4" width="2" height="4" rx="1" fill="currentColor" fillOpacity="0.4" /></svg>
          </span>
        </div>}
        {children}
        <span aria-hidden className="absolute bottom-1.5 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-foreground/30" />
      </div>
    </div>
  );
}

/** Avatar arriba a la derecha, como en la app (la campana y la guía ya no están). */
export function PhoneAppBar({ avatar }: { avatar: ReactNode }) {
  return (
    <div aria-hidden className="flex h-11 shrink-0 items-center justify-end gap-2 px-3">
      <span className="flex h-11 w-11 items-center justify-center">
        <span className="flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-full bg-secondary type-footnote font-semibold">{avatar}</span>
      </span>
    </div>
  );
}

export type PhoneTab = { key: string; label: string; icon: LucideIcon };

/** Barra flotante de la app (`FloatingMobileNav`): mismos iconos, la activa en dorado y rellena, sin píldora. */
export function PhoneTabBar({ tabs, active, onSelect, label = "Secciones de la demo" }: { tabs: readonly PhoneTab[]; active: string; onSelect: (key: string) => void; label?: string }) {
  return (
    <nav className="absolute inset-x-3 bottom-5 z-10" role="group" aria-label={label}>
      <ul className="flex h-[60px] items-stretch gap-0.5 rounded-full border border-border bg-card/90 p-1 backdrop-blur-xl">
        {tabs.map(({ key, label: text, icon }) => {
          const isActive = active === key;
          const app = APP_TABS.find((tab) => tab.key === key);
          const Icon = app?.icon ?? icon;
          const ActiveIcon = app?.activeIcon;
          return (
            <li key={key} className="min-w-0 flex-1">
              <button type="button" aria-pressed={isActive} onClick={() => onSelect(key)}
                className={cn("flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-full px-0.5 transition-transform duration-150 ease-out active:scale-[0.94]", isActive ? "text-primary" : "text-muted-foreground")}>
                <span className="flex h-7 items-center justify-center">
                  {isActive && ActiveIcon ? <ActiveIcon className="h-[22px] w-[22px]" /> : <Icon className="h-[22px] w-[22px]" strokeWidth={1.5} aria-hidden="true" />}
                </span>
                <span className="max-w-full truncate px-0.5 text-[10.5px] font-medium tracking-[0.01em]">{text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Sesión de ejemplo de los móviles; la misma del tracker de la demo (3 ejercicios × 3 series, 90 s). */
export const DEMO_SESSION = { title: "Cuerpo completo", focus: "Piernas, espalda y pecho", exercises: 3, series: 9, minutes: 20 };

/** Rutina de ejemplo en orden (sin días de la semana): la 1 hecha y la 2 es la siguiente. */
export const DEMO_ROUTINE = [
  { name: "Pierna", done: true },
  { name: DEMO_SESSION.title, done: false },
  { name: "Torso", done: false },
];

interface PhoneHomeProps {
  plans: PlanAvailability;
  /** Render the title as a heading (the interactive demo) instead of plain text (the hero picture). */
  heading?: boolean;
  onSession?: () => void;
  onNutrition?: () => void;
  onProgress?: () => void;
  name?: string;
  /** Hoy ancho, a dos columnas: lo que enseña la app de Mac (las clases `lg:` de HomeOverview, sin depender de la ventana). */
  wide?: boolean;
}

/** Fila-tarjeta de «Hoy» (`HomeRow`): título, una línea gris, valor, icono dorado y chevron. */
function PhoneRow({ icon, title, detail, value, onClick }: { icon: ReactNode; title: string; detail: string; value?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate type-headline text-foreground">{title}</span>
        <span className="mt-0.5 line-clamp-2 type-footnote tabular-nums text-muted-foreground">{detail}</span>
      </span>
      {value && <span className="shrink-0 type-subhead font-semibold tabular-nums text-foreground">{value}</span>}
      <span aria-hidden="true" className="flex shrink-0 text-primary">{icon}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.5} aria-hidden="true" />
    </>
  );
  const className = "flex min-h-[72px] w-full items-center gap-3.5 rounded-[22px] border border-border bg-card px-[18px] py-4 text-left";
  return onClick
    ? <button type="button" onClick={onClick} className={cn(className, "transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>{body}</button>
    : <div className={className}>{body}</div>;
}

/**
 * «Hoy» de la app con datos de ejemplo, con el mismo diseño que `HomeOverview` en el móvil:
 * «Hoy» grande, la siguiente sesión de la rutina con su foto, Tu progreso, Tu plan, Esta semana
 * (un círculo por sesión, sin días de la semana) y Nutrición.
 */
export function PhoneHome({ heading, onSession, onNutrition, onProgress, name, wide = false }: PhoneHomeProps) {
  const Title = heading ? "h2" : "p";
  const nextIndex = DEMO_ROUTINE.findIndex((session) => !session.done);
  const card = (
    <>
      <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[55%] overflow-hidden bg-secondary">
        <img src={previewExercises[0].image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-[50%_30%]" />
        <span className="absolute inset-0 bg-gradient-to-r from-card via-card/55 to-transparent" />
      </span>
      <span className="relative flex min-w-0 flex-1 flex-col p-[18px] pr-32">
        <span className="type-footnote text-muted-foreground">{`Siguiente sesión · ${nextIndex + 1} de ${DEMO_ROUTINE.length}`}</span>
        <span className="mt-1.5 line-clamp-2 text-[22px] font-bold leading-7 tracking-[-0.02em]">{DEMO_SESSION.title}</span>
        <span className="mt-0.5 line-clamp-2 type-subhead text-muted-foreground">{DEMO_SESSION.focus}</span>
        <span className="mt-auto flex items-center gap-1.5 pt-3.5 type-footnote tabular-nums text-muted-foreground">
          <Dumbbell aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          {`${DEMO_SESSION.exercises} ejercicios · ${DEMO_SESSION.series} series · unos ${DEMO_SESSION.minutes} min`}
        </span>
      </span>
      <span aria-hidden="true" className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
      </span>
    </>
  );
  const cardClass = "relative flex min-h-[156px] w-full overflow-hidden rounded-[22px] border border-border bg-card text-left";
  return (
    <div className={wide ? "grid grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)] grid-rows-[auto_auto_1fr] items-start gap-x-10 pb-4" : "flex flex-col pb-4"}>
      <header className={wide ? "col-span-2" : undefined}>
        <Title className={cn("type-large-title leading-tight text-foreground", wide && "text-[44px] leading-[48px]")}>Hoy</Title>
        <p className="mt-1 type-subhead text-muted-foreground">{name ? `Hola, ${name}.` : "Hola."} A entrenar.</p>
      </header>

      <div className={wide ? "row-span-2 mt-8" : "mt-6"}>
        {onSession
          ? <button type="button" onClick={onSession} aria-label={`Empezar ${DEMO_SESSION.title}`} className={cn(cardClass, "transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>{card}</button>
          : <div className={cardClass}>{card}</div>}
      </div>

      <div className={cn("space-y-3", wide ? "mt-4" : "mt-3")}>
        <PhoneRow icon={<BarChart3 className="h-[22px] w-[22px]" strokeWidth={1.75} />} title="Tu progreso" detail="Sentadilla goblet · 20 kg × 10" onClick={onProgress} />
        <PhoneRow icon={<Layers className="h-[22px] w-[22px]" strokeWidth={1.75} />} title="Tu plan" detail="Revisa y ajusta tu plan de entrenamiento." onClick={onSession} />
      </div>

      <div className={cn("rounded-[22px] border border-border bg-card", wide ? "mt-4 p-5" : "mt-3 p-4")}>
        <div className="flex min-h-11 items-center justify-between">
          <p className="type-headline text-foreground">Esta semana</p>
          <span className="inline-flex items-center gap-1 type-subhead font-semibold text-primary">Ver detalle<ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /></span>
        </div>
        <div aria-hidden="true" className="mt-3 grid grid-cols-3 gap-1">
          {DEMO_ROUTINE.map((session, index) => (
            <span key={session.name} className="flex min-w-0 flex-col items-center gap-2">
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums",
                session.done ? "bg-primary text-primary-foreground" : index === nextIndex ? "border-2 border-primary text-primary" : "border border-foreground/25 text-muted-foreground")}>
                {session.done ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
              </span>
              <span className={cn("max-w-full truncate text-[12px]", index === nextIndex ? "font-semibold text-foreground" : "text-muted-foreground")}>{session.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div className={wide ? "mt-4" : "mt-3"}>
        <PhoneRow icon={<Apple className="h-[22px] w-[22px]" strokeWidth={1.75} />} title="Nutrición" detail="Proteína 150 g · carbohidratos y grasas" value="2.300 kcal" onClick={onNutrition} />
      </div>
    </div>
  );
}

/**
 * Captura REAL de la app dentro del marco del teléfono. La imagen trae su propia barra de
 * estado (por eso `chrome={false}`); si aún no está el fichero, se pinta `fallback`.
 */
export function PhoneShot({ src, alt, className, fallback }: { src: string; alt: string; className?: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed && fallback) return <>{fallback}</>;
  return (
    <PhoneFrame className={className} screenClassName="bg-background" chrome={false}>
      {!failed && (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover object-top"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </PhoneFrame>
  );
}
