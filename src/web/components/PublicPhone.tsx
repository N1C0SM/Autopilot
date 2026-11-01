import { useState, type ReactNode } from "react";
import { Apple, Sparkles, type LucideIcon } from "lucide-react";
import { ProgressRing } from "@/shared/components/ui/progress-ring";
import { OverviewRow } from "@/app/components/dashboard/HomeOverview";
import type { PlanAvailability } from "@/shared/lib/planCatalogCore";
import { Button } from "@/shared/components/ui/button";
import { Barbell, ChartLineUp, ForkKnife, House } from "@phosphor-icons/react";
import { previewExercises } from "@/web/components/previewData";
import { cn } from "@/shared/lib/utils";

/**
 * Piezas del móvil de la web pública. `PhoneShot` pinta capturas REALES de la app
 * (las de `public/app-shots/`); el resto (PhoneHome, PhoneTabBar…) son la demo interactiva
 * y el respaldo si una captura aún no está. Markup puro: sin datos ni movimiento.
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

/** Floating capsule tab bar of the interactive demo. */
export function PhoneTabBar({ tabs, active, onSelect, label = "Secciones de la demo" }: { tabs: readonly PhoneTab[]; active: string; onSelect: (key: string) => void; label?: string }) {
  const cols = tabs.length === 5 ? "grid-cols-5" : "grid-cols-4";
  const item = (isActive: boolean) => cn(
    "relative flex h-14 min-w-0 w-full flex-col px-0 py-0 [&_svg]:size-6 hover:bg-transparent items-center justify-center gap-0.5 rounded-full type-caption2 font-medium text-[11px] leading-tight transition-[background-color,transform] duration-150 ease-out active:scale-[0.94]",
    isActive ? "bg-primary/90 text-primary-foreground" : "text-muted-foreground",
  );
  const glyphs = { home: House, training: Barbell, nutrition: ForkKnife, progress: ChartLineUp };
  return (
    <nav className="absolute inset-x-3 bottom-5 z-10 rounded-full bg-card p-1" role="group" aria-label={label}>
      <div className={cn("grid", cols)}>
        {tabs.map(({ key, label: text, icon: Icon }) => { const Glyph = glyphs[key as keyof typeof glyphs]; return (
          <Button variant="ghost" key={key} type="button" aria-pressed={active === key} onClick={() => onSelect(key)} className={item(active === key)}>
            {Glyph ? <Glyph className="h-6 w-6" weight={active === key ? "fill" : "regular"} /> : <Icon className="h-6 w-6" />}
            <span className="max-w-full truncate px-0.5">{text}</span>
          </Button>
        ); })}
      </div>
    </nav>
  );
}

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Example week of the public phones, built around the visitor's real today so the
 * picture reads like the app opened right now: four planned days, today always one of them.
 */
export function demoWeek(now = new Date()) {
  const today = (now.getDay() + 6) % 7;
  const base = [0, 2, 4];
  const planned = base.includes(today) ? base : [...base, today].sort((a, b) => a - b);
  const done = planned.filter((d) => d < today).length;
  const label = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(now);
  return { today, planned, done, date: label.charAt(0).toLocaleUpperCase("es") + label.slice(1) };
}

/** Same week strip as the app's "Hoy": today tinted, a dot under each planned day. */
export function PhoneWeek({ planned, today }: { planned: number[]; today: number }) {
  return (
    <ol aria-hidden className="grid grid-cols-7">
      {DAYS.map((d, i) => {
        const trains = planned.includes(i);
        return (
          <li key={d} className="flex flex-col items-center gap-1">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-full type-subhead", i === today ? "bg-primary/15 font-semibold text-primary" : trains ? "text-foreground" : "text-muted-foreground")}>{d}</span>
            <span className={cn("h-[5px] w-[5px] rounded-full", trains ? "bg-primary" : "bg-transparent")} />
          </li>
        );
      })}
    </ol>
  );
}

/** Example session shown on the phones; mirrors the demo tracker (3 exercises × 3 series, 90 s rest). */
export const DEMO_SESSION = { title: "Fuerza cuerpo completo", exercises: 3, series: 9, minutes: 20 };

interface PhoneHomeProps {
  plans: PlanAvailability;
  /** Render the greeting as a heading (the interactive demo) instead of plain text (the hero picture). */
  heading?: boolean;
  onSession?: () => void;
  onNutrition?: () => void;
  onProgress?: () => void;
  name?: string;
}

/**
 * "Hoy" screen of the app, drawn with the same layout, copy and rows as the real
 * mobile HomeOverview (date, greeting, week, session + Empezar, Nutrición, Progreso).
 */
export function PhoneHome({ heading, onSession, onNutrition, onProgress, name }: PhoneHomeProps) {
  const Greeting = heading ? "h2" : "p";
  const week = demoWeek();
  return (
    <div className="flex flex-col">
      <p className="type-subhead font-semibold text-muted-foreground">{week.date}</p>
      <Greeting className="mt-0.5 type-large-title">
        {name ? `Hola, ${name}.` : "Hola."}
        <span className="block text-muted-foreground">A entrenar.</span>
      </Greeting>


      <div className="py-8">
        <div className="relative mb-4 h-48 overflow-hidden rounded-[28px] bg-card"><img src={previewExercises[0].image} alt="Sentadilla goblet" loading="lazy" decoding="async" className="h-full w-full object-cover object-[50%_30%]" /></div>
        {(() => {
          const body = (
            <>
              <span className="line-clamp-3 type-title1">{DEMO_SESSION.title}</span>
              <span className="mt-1 block type-subhead tabular-nums text-muted-foreground">
                {DEMO_SESSION.exercises} ejercicios · {DEMO_SESSION.series} series · unos {DEMO_SESSION.minutes} min
              </span>
              <span className="mt-6 flex h-[50px] w-full items-center justify-center rounded-[14px] bg-primary px-5 type-headline text-primary-foreground transition-[opacity,transform] duration-150 ease-out group-active:scale-[0.98] group-active:opacity-80">
                Empezar entreno
              </span>
            </>
          );
          return onSession
            ? <button type="button" onClick={onSession} aria-label={`Empezar ${DEMO_SESSION.title}`} className="group block w-full rounded-media text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background">{body}</button>
            : <div className="block w-full">{body}</div>;
        })()}
      </div>

      <h3 className="mb-3 type-title3">Resumen</h3>
      <div className="grid grid-cols-2 gap-3">
        <OverviewRow
          title="Nutrición"
          value={<>2.300<span className="ml-1 type-subhead text-muted-foreground">kcal</span></>}
          onClick={onNutrition}
          icon={<ProgressRing value={67} size={32} stroke={3.5}><Apple className="h-[14px] w-[14px]" strokeWidth={2.25} /></ProgressRing>}
          description="2 de 3 comidas"
        />
        <OverviewRow
          title="Progreso"
          value={<>{week.done}<span className="type-title3 text-muted-foreground">/{week.planned.length}</span></>}
          onClick={onProgress}
          icon={<ProgressRing value={(week.done / week.planned.length) * 100} size={32} stroke={3.5}><Sparkles className="h-[14px] w-[14px]" strokeWidth={2.25} /></ProgressRing>}
          description={`${week.done} de ${week.planned.length} sesiones esta semana`}
        />
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
