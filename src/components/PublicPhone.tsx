import type { ReactNode } from "react";
import { Dumbbell, Lock, MessageCircle, Bell, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/components/ui/list";
import { ProgressRing } from "@/components/ui/progress-ring";
import type { PlanAvailability } from "@/lib/planCatalogCore";
import { cn } from "@/lib/utils";

/**
 * Pieces of the fake phone shown on the public site. They reproduce the app's
 * current look (black screen, system type, grouped rows, floating tab bar) and are
 * shared by the hero (static picture) and the interactive demo. Pure markup: no data, no motion.
 */

export function PhoneFrame({ children, className, screenClassName }: { children: ReactNode; className?: string; screenClassName?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[22rem] rounded-[3.25rem] bg-secondary p-[3px]", className)}>
      <span aria-hidden className="absolute -left-[2px] top-24 h-8 w-[3px] rounded-l-md bg-secondary" />
      <span aria-hidden className="absolute -left-[2px] top-36 h-12 w-[3px] rounded-l-md bg-secondary" />
      <span aria-hidden className="absolute -left-[2px] top-52 h-12 w-[3px] rounded-l-md bg-secondary" />
      <span aria-hidden className="absolute -right-[2px] top-40 h-16 w-[3px] rounded-r-md bg-secondary" />
      <div className={cn("relative flex flex-col overflow-hidden rounded-[3rem] bg-background", screenClassName)}>
        <div aria-hidden className="flex shrink-0 items-center justify-between px-8 pb-1 pt-4 type-subhead font-semibold">
          <span>9:41</span>
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 16 12" className="h-3 w-4 fill-current"><rect x="0" y="7" width="3" height="5" rx="0.5" /><rect x="4.5" y="5" width="3" height="7" rx="0.5" /><rect x="9" y="2.5" width="3" height="9.5" rx="0.5" /><rect x="13" y="0" width="3" height="12" rx="0.5" /></svg>
            <svg viewBox="0 0 24 12" className="h-3 w-6"><rect x="0.5" y="0.5" width="20" height="11" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.4" /><rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor" /><rect x="22" y="4" width="2" height="4" rx="1" fill="currentColor" fillOpacity="0.4" /></svg>
          </span>
        </div>
        {children}
        <span aria-hidden className="absolute bottom-1.5 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-foreground/30" />
      </div>
    </div>
  );
}

/** Bell and avatar, top right, as in the app's root screens. */
export function PhoneAppBar({ avatar }: { avatar: ReactNode }) {
  return (
    <div aria-hidden className="flex h-11 shrink-0 items-center justify-end gap-3 px-4">
      <Bell className="h-5 w-5" />
      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary type-footnote font-semibold">{avatar}</span>
    </div>
  );
}

export type PhoneTab = { key: string; label: string; icon: LucideIcon };

/** Floating capsule tab bar of the interactive demo. */
export function PhoneTabBar({ tabs, active, onSelect, label = "Secciones de la demo" }: { tabs: readonly PhoneTab[]; active: string; onSelect: (key: string) => void; label?: string }) {
  const cols = tabs.length === 5 ? "grid-cols-5" : "grid-cols-4";
  const item = (isActive: boolean) => cn(
    "relative flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full type-caption2 font-medium transition-[background-color,transform] duration-150 ease-ios-standard active:scale-[0.94]",
    isActive ? "bg-secondary text-primary" : "text-muted-foreground",
  );
  return (
    <nav className="material absolute inset-x-3 bottom-5 z-10 rounded-full p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]" role="group" aria-label={label}>
      <div className={cn("grid", cols)}>
        {tabs.map(({ key, label: text, icon: Icon }) => (
          <button key={key} type="button" aria-pressed={active === key} onClick={() => onSelect(key)} className={item(active === key)}>
            <Icon className="h-6 w-6" strokeWidth={active === key ? 2.25 : 2} />
            <span className="max-w-full truncate px-0.5">{text}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];

/** Seven days with a dot under each finished session and a tinted circle on today. */
export function PhoneWeek({ done, today }: { done: number[]; today: number }) {
  return (
    <div aria-hidden className="grid grid-cols-7">
      {DAYS.map((d, i) => (
        <div key={d} className="flex flex-col items-center gap-1">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-full type-subhead", i === today ? "bg-primary/15 font-semibold text-primary" : "text-muted-foreground")}>{d}</span>
          <span className={cn("h-1 w-1 rounded-full", done.includes(i) ? "bg-primary" : "bg-transparent")} />
        </div>
      ))}
    </div>
  );
}

interface PhoneHomeProps {
  plans: PlanAvailability;
  exerciseCount: number;
  /** Render the greeting as a heading (the interactive demo) instead of plain text (the hero picture). */
  heading?: boolean;
  onSession?: () => void;
  onNutrition?: () => void;
  onProgress?: () => void;
}

/** "Hoy" screen of the app: greeting, week, today's session and two summary rows. */
export function PhoneHome({ plans, exerciseCount, heading, onSession, onNutrition, onProgress }: PhoneHomeProps) {
  const Greeting = heading ? "h4" : "p";
  return (
    <div className="space-y-6">
      <div>
        <p className="type-subhead text-muted-foreground">Viernes 25 · Semana 3 de 12</p>
        <Greeting className="mt-1 type-large-title">Hola, Laura.<span className="block text-muted-foreground">Hoy toca fuerza.</span></Greeting>
      </div>
      <PhoneWeek done={[0, 2]} today={4} />
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Dumbbell className="h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
          <div className="min-w-0">
            <p className="type-title3">Fuerza cuerpo completo</p>
            <p className="type-subhead text-muted-foreground">{exerciseCount} ejercicios · ~45 min</p>
          </div>
        </div>
        {onSession
          ? <Button type="button" variant="hero" size="lg" className="w-full" onClick={onSession}>Ver sesión de hoy</Button>
          : <div aria-hidden className="btn-lg flex w-full items-center justify-center bg-primary font-semibold text-primary-foreground">Ver sesión de hoy</div>}
      </div>
      <div className="-mx-4">
        <ListRow
          leading={<span aria-hidden><ProgressRing value={62} size={32} stroke={4} /></span>}
          title={<span className="inline-flex items-center gap-1.5 font-semibold">Nutrición <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /></span>}
          subtitle="1.420 / 2.300 kcal"
          chevron
          onClick={onNutrition}
        />
        <ListRow
          leading={<span aria-hidden><ProgressRing value={67} size={32} stroke={4} /></span>}
          title={<span className="font-semibold">Progreso semanal</span>}
          subtitle="2 de 3 sesiones"
          chevron
          onClick={onProgress}
        />
      </div>
      <div className="flex gap-3">
        <MessageCircle className="mt-0.5 h-6 w-6 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
        <p className="type-footnote text-muted-foreground">
          {plans.coach
            ? <><span className="font-semibold text-foreground">En {plans.coachName}:</span> recibes seguimiento humano y ajustes de tu plan. Gratis tienes registro y progreso.</>
            : <>Gratis tienes rutina, registro y progreso{plans.plus ? `; ${plans.plusName} añade nutrición y progresión automática` : ""}.</>}
        </p>
      </div>
    </div>
  );
}
