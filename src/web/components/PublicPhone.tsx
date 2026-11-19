import { useBrandPhotos } from "@/shared/lib/brandPhotos";
import { useState, type ReactNode } from "react";
import { Beef, Bell, Check, ChevronRight, Dumbbell, Flame as Apple, Play, Plus, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/shared/components/ui/button";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
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

/** Campana y avatar arriba a la derecha, como la cabecera de la app (`MobileHeader`). */
export function PhoneAppBar({ avatar }: { avatar: ReactNode }) {
  return (
    <div aria-hidden className="flex h-11 shrink-0 items-center justify-end px-3">
      <span className="flex h-11 w-11 items-center justify-center"><Bell className="h-[17px] w-[17px]" strokeWidth={1.5} /></span>
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
  { name: "Pierna", focus: "Cuádriceps, femoral y glúteo", done: true },
  { name: DEMO_SESSION.title, focus: DEMO_SESSION.focus, done: false },
  { name: "Torso", focus: "Pecho, espalda y hombros", done: false },
];

interface PhoneHomeProps {
  plans: PlanAvailability;
  /** Render the title as a heading (the interactive demo) instead of plain text (the hero picture). */
  heading?: boolean;
  onSession?: () => void;
  onNutrition?: () => void;
  onProgress?: () => void;
  name?: string;
  /** Hoy de la web ancha y de la app de Mac: la misma columna del iPhone, más grande (las clases `sm:` de HomeOverview, sin depender de la ventana). */
  wide?: boolean;
}

/** La semana en curso (lunes a domingo) con hoy marcado y un día ya entrenado, como la tira de «Hoy». */
function demoWeek() {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const today = (now.getDay() + 6) % 7;
  return ["L", "M", "X", "J", "V", "S", "D"].map((letter, index) => ({
    letter,
    day: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index).getDate(),
    isToday: index === today,
    // La sesión hecha de la rutina de ejemplo: dos días antes de hoy (o ninguna si la semana acaba de empezar).
    trained: today >= 2 && index === today - 2,
  }));
}

/** Cifra de «Tu día» con su anillo (`MetricTile` de HomeOverview). */
function DemoMetric({ icon: Icon, progress, value, caption, label, wide, onClick }: { icon: LucideIcon; progress: number; value: string; caption: string; label: string; wide: boolean; onClick?: () => void }) {
  const circumference = 2 * Math.PI * 17;
  const Tile = onClick ? "button" : "span";
  return (
    <Tile {...(onClick ? { type: "button" as const, onClick, "aria-label": `${label}: ${value} ${caption}` } : {})} className={cn("flex min-w-0 flex-col items-start rounded-[22px] bg-card p-3.5 text-left", onClick && "transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", wide && "p-5")}>
      <span aria-hidden="true" className="relative flex h-10 w-10 items-center justify-center">
        <svg viewBox="0 0 40 40" className="absolute inset-0 h-10 w-10 -rotate-90">
          <circle cx="20" cy="20" r="17" fill="none" strokeWidth="3.5" className="stroke-secondary" />
          <circle cx="20" cy="20" r="17" fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-primary" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
        </svg>
        <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
      </span>
      <span className={cn("mt-3 max-w-full truncate text-[24px] font-bold leading-7 tracking-[-0.02em] tabular-nums", wide && "text-[30px] leading-8")}>{value}</span>
      <span className="mt-0.5 max-w-full truncate type-footnote text-muted-foreground">{caption}</span>
    </Tile>
  );
}

/**
 * «Hoy» de la app con datos de ejemplo y el mismo diseño que `HomeOverview`: «Hoy» y el nombre,
 * la tira de la semana, la siguiente sesión con su foto y el play dorado, las tres cifras del día,
 * «Tu plan» con sus sesiones en orden y «Entreno vacío» / «Nueva rutina». Sin red ni cuentas.
 */
export function PhoneHome({ heading, onSession, onNutrition, onProgress, name, wide = false }: PhoneHomeProps) {
  useBrandPhotos(); // repinta las fotos de marca cuando llega su URL actual
  const Title = heading ? "h2" : "p";
  const done = DEMO_ROUTINE.filter((session) => session.done).length;
  const hero = (
    <>
      <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[58%] overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_60%)]">
        <img src={previewExercises[0].image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-[50%_30%]" />
      </span>
      <span className={cn("relative flex min-w-0 flex-1 flex-col p-5 pr-36", wide && "p-7 pr-64")}>
        <span className="flex items-center gap-1.5 type-footnote font-semibold text-muted-foreground">
          <Dumbbell aria-hidden="true" className="h-4 w-4 text-primary" strokeWidth={2} />
          Entrenamiento
        </span>
        <span className={cn("mt-2 line-clamp-2 text-[28px] font-bold leading-8 tracking-[-0.02em]", wide && "text-[34px] leading-10")}>{DEMO_SESSION.title}</span>
        <span className="mt-1 line-clamp-2 type-subhead text-muted-foreground">{DEMO_SESSION.focus}</span>
        <span className="mt-auto pt-4 type-footnote tabular-nums text-muted-foreground">{`${DEMO_SESSION.minutes} min · ${DEMO_SESSION.exercises} ejercicios`}</span>
      </span>
      <span aria-hidden="true" className={cn("btn-gold absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground", wide && "bottom-6 right-6")}>
        <Play className="ml-0.5 h-6 w-6" fill="currentColor" strokeWidth={0} />
      </span>
    </>
  );
  const heroClass = cn("relative flex min-h-[188px] w-full overflow-hidden rounded-[28px] bg-card text-left", wide && "min-h-[240px]");
  const pill = cn(buttonVariants({ variant: "secondary", size: "lg" }), "flex-[1_0_auto]");
  return (
    <div className={cn("mx-auto flex w-full flex-col gap-5 pb-4", wide && "max-w-[680px]")}>
      <header>
        <Title className="type-subhead font-medium text-muted-foreground">Hoy</Title>
        <p className="mt-0.5 truncate text-[34px] font-bold leading-[40px] tracking-[-0.02em] text-foreground">{name || "Hola"}</p>
        <p className="mt-1 type-subhead text-muted-foreground">La constancia crea el cambio.</p>
      </header>

      <ol aria-hidden="true" className="grid grid-cols-7 gap-1.5">
        {demoWeek().map((day) => (
          <li key={day.letter} className={cn("flex h-[68px] min-w-0 flex-col items-center justify-center gap-1 rounded-full bg-card", day.isToday && "ring-[1.5px] ring-inset ring-primary")}>
            <span className="text-[11px] font-medium text-muted-foreground">{day.letter}</span>
            <span className={cn("text-[17px] font-semibold leading-none tabular-nums", day.isToday ? "text-primary" : "text-foreground")}>{day.day}</span>
            <span className={cn("h-1 w-1 rounded-full", day.trained ? "bg-primary" : "bg-transparent")} />
          </li>
        ))}
      </ol>

      {onSession
        ? <button type="button" onClick={onSession} aria-label={`Empezar ${DEMO_SESSION.title}`} className={cn(heroClass, "transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>{hero}</button>
        : <div className={heroClass}>{hero}</div>}

      <div className="grid grid-cols-3 gap-3">
        <DemoMetric icon={Apple} progress={0.4} value={(2300).toLocaleString("es-ES")} caption="kcal" label="Calorías" wide={wide} onClick={onNutrition} />
        <DemoMetric icon={Beef} progress={0.4} value="150" caption="g proteína" label="Proteína" wide={wide} onClick={onNutrition} />
        <DemoMetric icon={Dumbbell} progress={done / DEMO_ROUTINE.length} value={`${done}/${DEMO_ROUTINE.length}`} caption="sesiones" label="Sesiones" wide={wide} onClick={onSession} />
      </div>

      <section aria-label="Tu plan">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="type-title3">Tu plan</p>
          {onProgress
            ? <button type="button" onClick={onProgress} className="-my-3 min-h-11 px-1 type-subhead font-semibold text-primary active:opacity-60">Tu progreso</button>
            : <span aria-hidden="true" className="type-subhead font-semibold text-primary">Editar</span>}
        </div>
        <div className="overflow-hidden rounded-[22px] bg-card">
          <div className="px-[18px] pb-4 pt-[18px]">
            <p className="type-headline">Esta semana</p>
            <p className="mt-0.5 type-footnote tabular-nums text-muted-foreground">{`${done} de ${DEMO_ROUTINE.length} sesiones completadas`}</p>
            <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(done / DEMO_ROUTINE.length) * 100}%` }} />
            </div>
          </div>
          {DEMO_ROUTINE.map((session) => (
            <div key={session.name} className="relative flex min-h-[76px] w-full items-center gap-3.5 px-3.5 py-2.5">
              <span aria-hidden="true" className="absolute left-3.5 right-3.5 top-0 h-px bg-border/60" />
              <ExerciseThumb name={session.name} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate type-headline">{session.name}</span>
                <span className="mt-0.5 block truncate type-footnote text-muted-foreground">{session.focus}</span>
              </span>
              {session.done
                ? <span aria-label="Hecha esta semana" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </section>

      <div aria-hidden="true" className="flex flex-wrap gap-3">
        <span className={pill}><Play className="h-[18px] w-[18px] text-primary" fill="currentColor" strokeWidth={0} />Entreno vacío</span>
        <span className={pill}><Plus className="h-5 w-5 text-primary" strokeWidth={2.25} />Nueva rutina</span>
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
