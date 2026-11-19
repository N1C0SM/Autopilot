import type { ReactNode } from "react";
import { Dumbbell, Flame, House, ScanLine, TrendingUp } from "lucide-react";
import { PhoneAppBar, PhoneFrame, PhoneHome, PhoneTabBar } from "@/web/components/PublicPhone";
import { PublicProgressScreen, PublicTrainingScreen } from "@/web/components/PublicAppScreen";
import { previewExercises } from "@/web/components/previewData";
import { useScrollProgress } from "@/shared/hooks/useScrollProgress";
import { usePlanAvailability } from "@/shared/lib/planCatalog";
import { cn } from "@/shared/lib/utils";
import heroAthlete from "@/shared/assets/landing/hero-athlete.jpg";

const TABS = [
  { key: "home", label: "Hoy", icon: House },
  { key: "library", label: "Ejercicios", icon: Dumbbell },
  { key: "nutrition", label: "Nutrición", icon: Flame },
  { key: "progress", label: "Progreso", icon: TrendingUp },
] as const;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const kg = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: 1 });
/** Visibilidad del teléfono de la escena `i` en el punto `t`: llena en el centro y fundida con la vecina en el ±8 % de cada borde (nunca hay un hueco negro). */
const sceneOpacity = (t: number, i: number, count: number) => clamp(Math.min(
  i === 0 ? 1 : (t - i + 0.08) / 0.16,
  i === count - 1 ? 1 : (i + 1.08 - t) / 0.16,
));
/** El texto no se solapa: el anterior se va del todo antes de que entre el siguiente. */
const textOpacity = (t: number, i: number, count: number) => clamp(Math.min(
  i === 0 ? 1 : (t - i - 0.02) / 0.1,
  i === count - 1 ? 1 : (i + 0.98 - t) / 0.1,
));

/** Descanso entre series: el anillo dorado se vacía y la cuenta baja de 1:30 a 0:00. */
function RestScene({ k }: { k: number }) {
  const left = Math.round(90 * (1 - k));
  const circumference = 2 * Math.PI * 88;
  return <div className="flex h-full flex-col items-center px-5 pt-6 text-center">
    <p className="type-subhead font-medium text-primary">Descanso</p>
    <p className="mt-1 type-footnote text-muted-foreground">Sentadilla goblet · serie 2 de 3</p>
    <div className="relative mt-8 h-56 w-56">
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="100" cy="100" r="88" fill="none" strokeWidth="10" className="stroke-secondary" />
        <circle cx="100" cy="100" r="88" fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-primary"
          strokeDasharray={circumference} strokeDashoffset={circumference * k} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center type-figure text-[64px] font-bold leading-none tabular-nums">
        {`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
      </span>
    </div>
    <div className="mt-8 grid w-full grid-cols-3 gap-2 type-subhead font-semibold">
      {["−15 s", "+15 s", "Saltar"].map((label, i) => <span key={label} className={cn("flex h-11 items-center justify-center rounded-full", i === 2 ? "bg-primary text-primary-foreground" : "bg-secondary")}>{label}</span>)}
    </div>
    <div className="mt-6 w-full rounded-[22px] bg-card p-4 text-left">
      <p className="type-footnote text-muted-foreground">Siguiente</p>
      <p className="mt-0.5 type-headline tabular-nums">Serie 3 · 20 kg × 9</p>
    </div>
  </div>;
}

/** Progresión: con lo que hiciste, la siguiente sesión ya trae la carga nueva (20 → 22,5 kg). */
function ProgressionScene({ k }: { k: number }) {
  const exercise = previewExercises[0];
  const up = k > 0.4;
  const load = up ? 22.5 : 20;
  return <div className="px-5 pt-4">
    <p className="type-subhead font-medium text-muted-foreground">Siguiente sesión</p>
    <p className="mt-0.5 text-[34px] font-bold leading-[40px] tracking-[-0.02em]">Cuerpo completo</p>
    <div className="mt-5 overflow-hidden rounded-[28px] bg-card">
      <img src={exercise.image} alt="" loading="lazy" decoding="async" className="h-40 w-full object-cover object-[50%_30%]" />
      <div className="p-5">
        <p className="type-headline">{exercise.name}</p>
        <p className="mt-0.5 type-footnote text-muted-foreground">La última vez: 3 × 10 con 20 kg</p>
        <p className="mt-5 type-footnote font-semibold text-primary">Hoy te toca</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span key={load} className="type-figure text-[72px] font-bold leading-none tabular-nums text-primary animate-in fade-in-0 zoom-in-95 duration-300">{kg(load)}</span>
          <span className="type-title3 text-muted-foreground">kg</span>
          <span className={cn("ml-auto self-center rounded-full bg-primary/15 px-3 py-1 type-footnote font-semibold tabular-nums text-primary transition-opacity duration-300", up ? "opacity-100" : "opacity-0")}>+2,5 kg</span>
        </p>
        <p className="mt-2 type-subhead tabular-nums text-muted-foreground">3 series · 8 reps</p>
      </div>
    </div>
  </div>;
}

/** Scan: una línea dorada recorre la foto y, al terminar, aparece la nota del físico. */
function ScanScene({ k }: { k: number }) {
  const done = k > 0.62;
  return <div className="px-5 pt-4">
    <p className="type-subhead font-medium text-muted-foreground">Scan</p>
    <p className="mt-0.5 text-[34px] font-bold leading-[40px] tracking-[-0.02em]">Tu físico hoy</p>
    <div className="relative mt-5 h-[300px] overflow-hidden rounded-[28px] bg-card">
      <img src={heroAthlete} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-[72%_20%]" />
      <span aria-hidden="true" className="absolute inset-x-0 h-0.5 bg-primary shadow-[0_0_24px_6px_hsl(var(--primary)/0.55)] transition-opacity"
        style={{ top: `${clamp(k / 0.6) * 100}%`, opacity: done ? 0 : 1 }} />
      <span className={cn("absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-[22px] bg-background/80 p-4 backdrop-blur-xl transition-[opacity,transform] duration-300", done ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
        <span className="type-figure text-[44px] font-bold leading-none tabular-nums text-primary">7,4</span>
        <span className="min-w-0">
          <span className="block type-headline">Tu nota</span>
          <span className="block type-footnote text-muted-foreground">Y 2 mejoras para tu plan</span>
        </span>
      </span>
    </div>
  </div>;
}

type Scene = { eyebrow: string; title: string; tab: (typeof TABS)[number]["key"] | null; screen: (k: number) => ReactNode };

/**
 * La historia de la portada, como una página de producto de Apple: el teléfono queda fijo y,
 * con el scroll, la app hace lo que resuelve (sabe qué toca, marca las series, cuenta el
 * descanso, sube la carga, dibuja tu progreso y mide tu físico). Una frase por escena.
 * Con «reducir movimiento» (y en el prerender) las escenas se ven en lista, ya terminadas.
 */
export default function LandingStory() {
  const plans = usePlanAvailability();
  // La carga siguiente solo se enseña donde el producto la calcula (Plus visible o campaña abierta).
  const suggest = plans.campaign || plans.plus;
  const scenes: Scene[] = [
    { eyebrow: "Hoy", title: "Abres la app. Sabes qué toca.", tab: "home",
      screen: (k) => <div className="px-4 pt-3" style={{ transform: `translateY(${-clamp((k - 0.3) * 1.6) * 170}px)` }}><PhoneHome plans={plans} name="Alex" /></div> },
    { eyebrow: "Entreno", title: "Cada serie, a un toque.", tab: null,
      screen: (k) => <div className="flex h-full flex-col px-4 pb-6 pt-3"><PublicTrainingScreen active done={Math.min(3, Math.floor(k * 3.6))} /></div> },
    { eyebrow: "Descanso", title: "El descanso, contado.", tab: null, screen: (k) => <RestScene k={k} /> },
    ...(suggest ? [{ eyebrow: "Progresión", title: "La próxima vez, sube solo.", tab: "home", screen: (k: number) => <ProgressionScene k={k} /> } as Scene] : []),
    { eyebrow: "Progreso", title: "Ves cómo mejoras.", tab: "progress", screen: () => <div className="px-4 pt-3"><PublicProgressScreen /></div> },
    { eyebrow: "Scan", title: "Tu físico, medido.", tab: "progress", screen: (k) => <ScanScene k={k} /> },
  ];
  const [ref, p, pin] = useScrollProgress<HTMLElement>(-1);
  const still = p < 0;
  const t = still ? 0 : Math.min(0.999, pin) * scenes.length;
  const current = Math.floor(t);
  // El teléfono mide 352 × 704 px y se escala para ocupar como mucho dos tercios del alto de la pantalla.
  const scale = typeof window === "undefined" ? 0.85 : Math.min(0.85, (window.innerHeight * 0.64) / 704);

  const phone = (scene: Scene, k: number) => <PhoneFrame screenClassName="h-[44rem]">
    <PhoneAppBar avatar="A" />
    <div className={cn("min-h-0 flex-1 overflow-hidden", scene.tab && "pb-24")}>{scene.screen(k)}</div>
    {scene.tab && <PhoneTabBar tabs={TABS} active={scene.tab} onSelect={() => undefined} />}
  </PhoneFrame>;

  if (still) return <section ref={ref} aria-label="Lo que hace Autopilot" className="space-y-20 px-5 py-20 sm:px-8">
    {scenes.map((scene) => <div key={scene.title} className="mx-auto max-w-sm text-center">
      <p className="type-subhead font-semibold text-primary">{scene.eyebrow}</p>
      <h2 className="mt-2 text-[34px] font-bold leading-[1.1] tracking-tight">{scene.title}</h2>
      <div aria-hidden="true" className="mx-auto mt-8 h-[37.4rem] w-[18.7rem]"><div className="w-[22rem] origin-top-left scale-[0.85]">{phone(scene, 1)}</div></div>
    </div>)}
    <p className="text-center type-footnote text-muted-foreground">Datos de ejemplo</p>
  </section>;

  return <section ref={ref} aria-label="Lo que hace Autopilot" data-pinned className="relative" style={{ height: `${scenes.length * 90 + 100}vh` }}>
    {/* VoiceOver no hace scroll: lee las escenas aquí; la capa animada queda oculta. */}
    <ol className="sr-only">{scenes.map((scene) => <li key={scene.title}>{scene.title}</li>)}</ol>
    <div aria-hidden="true" className="sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden px-5 sm:px-8">
      {/* Halo dorado muy tenue detrás del teléfono (≈14 %), como el resto de la marca. */}
      <span className="pointer-events-none absolute left-1/2 top-1/2 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.14] blur-[120px] md:left-[68%]" />
      <div className="relative mx-auto grid w-full max-w-5xl items-center gap-4 md:grid-cols-2 md:gap-16">
        <div className="relative h-24 text-center md:h-56 md:text-left">
          {scenes.map((scene, i) => {
            const o = textOpacity(t, i, scenes.length);
            return <div key={scene.title} className="absolute inset-0 flex flex-col justify-center" style={{ opacity: o, transform: `translateY(${(t < i + 0.5 ? 1 - o : o - 1) * 18}px)` }}>
              <p className="type-subhead font-semibold text-primary">{scene.eyebrow}</p>
              <h2 className="mt-2 text-[30px] font-bold leading-[1.05] tracking-[-0.025em] md:text-[56px]">{scene.title}</h2>
            </div>;
          })}
        </div>
        <div className="relative mx-auto" style={{ width: 352 * scale, height: 704 * scale }}>
          {scenes.map((scene, i) => {
            const local = t - i;
            const o = sceneOpacity(t, i, scenes.length);
            if (o <= 0) return null;
            return <div key={scene.title} className="absolute left-0 top-0 w-[22rem] origin-top-left" style={{ opacity: o, transform: `scale(${scale})` }}>
              {phone(scene, clamp(local))}
            </div>;
          })}
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
        {scenes.map((scene, i) => <span key={scene.title} className={cn("h-1.5 rounded-full transition-all duration-300", i === current ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/30")} />)}
      </div>
      <p className="absolute bottom-6 right-5 hidden type-caption2 text-muted-foreground md:block">Datos de ejemplo</p>
    </div>
  </section>;
}
