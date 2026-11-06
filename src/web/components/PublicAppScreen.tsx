import { BookOpen, Check, ChevronDown, Crown, Dumbbell, Flame, Lock, Pause, Play, UtensilsCrossed } from "lucide-react";
import ExerciseProgressChart from "@/app/components/dashboard/ExerciseProgressChart";
import { cn } from "@/shared/lib/utils";
import { previewExercises, previewHistory } from "@/web/components/previewData";
import { DEMO_ROUTINE, DEMO_SESSION } from "@/web/components/PublicPhone";

/**
 * Pantallas de ejemplo de la web pública, dibujadas como las de la app de hoy (Entrenar,
 * entreno en curso, Progreso y Nutrición Gratis). Datos de ejemplo aislados: nunca leen ni
 * escriben datos de ningún cliente. La gráfica es la real (`ExerciseProgressChart`).
 */

const card = "rounded-[22px] border border-border bg-card";

/** Progreso: título, pestañas en cápsula (Fuerza en dorado) y «Tu fuerza» con la gráfica real. */
export function PublicProgressScreen() {
  return <div className="pb-4">
    <h2 className="type-large-title leading-tight">Progreso</h2>
    <p className="mt-1 type-subhead text-muted-foreground">Evolución de tu fuerza, tu físico y tus récords.</p>
    <div aria-hidden="true" className="mt-5 grid grid-cols-4 rounded-full bg-card p-1 type-footnote font-semibold">
      {["Fuerza", "Físico", "Récords", "Scan"].map((tab, i) => (
        <span key={tab} className={cn("flex h-9 items-center justify-center rounded-full", i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{tab}</span>
      ))}
    </div>
    <p className="mt-6 type-title3">Tu fuerza</p>
    <p className="mt-0.5 type-subhead text-muted-foreground">Evolución de tus principales ejercicios.</p>
    <div className={cn(card, "mt-3 p-4")}>
      <div className="flex items-center gap-3">
        <img src={previewExercises[0].image} alt="" loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-2xl bg-secondary object-cover" />
        <div className="min-w-0">
          <p className="truncate type-headline">Sentadilla goblet</p>
          <p className="type-footnote text-muted-foreground">Mejor marca</p>
          <p className="text-[22px] font-bold leading-tight tabular-nums">20 kg × 10</p>
        </div>
      </div>
      <div className="mt-4 h-56"><ExerciseProgressChart exerciseName="Sentadilla goblet" history={previewHistory} metric="bestEstimated1RmKg" onMetricChange={() => undefined} compact /></div>
    </div>
    <p className="mt-4 type-footnote text-muted-foreground">Datos de ejemplo</p>
  </div>;
}

/** Entreno en curso (vista de lista por defecto): ejercicios numerados y la barra Pausar · tiempo · Finalizar. */
function ActiveWorkout() {
  const exercise = previewExercises[0];
  const done = 2;
  return <div className="flex h-full min-h-0 flex-col">
    <p className="flex items-center gap-1.5 type-subhead font-medium text-primary"><Dumbbell className="h-4 w-4" aria-hidden="true" />Entrenamiento en curso</p>
    <h2 className="mt-1 type-large-title leading-tight">{DEMO_SESSION.title}</h2>
    <p className="mt-1 type-subhead tabular-nums text-muted-foreground">{`${DEMO_SESSION.exercises} ejercicios · ${done} de ${DEMO_SESSION.series} series`}</p>
    <div className="mt-4 flex items-center gap-3">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><span className="block h-full w-[22%] rounded-full bg-primary" /></span>
      <span className="type-footnote tabular-nums text-muted-foreground">0/3 ejercicios</span>
    </div>
    <div className={cn(card, "mt-4 p-3")}>
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <img src={exercise.image} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded-2xl bg-secondary object-cover" />
          <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate type-headline">{exercise.name}</p>
          <p className="type-footnote tabular-nums text-muted-foreground">{`${exercise.sets} series · ${exercise.reps} reps · 90 s`}</p>
        </div>
        <ChevronDown className="h-4 w-4 rotate-180 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="mt-3 grid grid-cols-[28px_44px_minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-2 px-1 type-caption2 text-muted-foreground"><span>Serie</span><span>Previa</span><span className="text-center">KG</span><span className="text-center">Reps</span><span /></div>
      {[0, 1, 2].map((i) => (
        <div key={i} className={cn("mt-1.5 grid grid-cols-[28px_44px_minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-2 rounded-2xl px-1 py-1", i === done && "ring-1 ring-primary/70")}>
          <span className={cn("text-center type-subhead tabular-nums", i === done ? "font-semibold text-primary" : "text-muted-foreground")}>{i + 1}</span>
          <span className="type-caption2 tabular-nums text-muted-foreground">18×10</span>
          <span className="rounded-xl bg-secondary py-2.5 text-center type-body tabular-nums">20</span>
          <span className="rounded-xl bg-secondary py-2.5 text-center type-body tabular-nums">{exercise.reps}</span>
          <span className={cn("mx-auto flex h-8 w-8 items-center justify-center rounded-full", i < done ? "bg-primary text-primary-foreground" : "border border-foreground/30 text-muted-foreground")}><Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /></span>
        </div>
      ))}
    </div>
    {previewExercises.slice(1).map((ex, i) => (
      <div key={ex.name} className={cn(card, "mt-3 flex items-center gap-3 p-3")}>
        <span className="relative shrink-0">
          <img src={ex.image} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded-2xl bg-secondary object-cover" />
          <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground">{i + 2}</span>
        </span>
        <div className="min-w-0 flex-1"><p className="truncate type-headline">{ex.name}</p><p className="type-footnote tabular-nums text-muted-foreground">{`${ex.sets} series · ${ex.reps} reps · ${ex.load}`}</p></div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
    ))}
    <div aria-hidden="true" className="mt-auto pt-5">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5">
        <span className="flex h-11 items-center gap-1.5 rounded-full bg-secondary px-4 type-subhead font-semibold"><Pause className="h-4 w-4" />Pausar</span>
        <span className="flex-1 text-center text-[20px] font-bold tabular-nums">12:48</span>
        <span className="flex h-11 items-center rounded-full bg-primary px-5 type-subhead font-semibold text-primary-foreground">Finalizar</span>
      </div>
    </div>
  </div>;
}

/** Entrenar: modo del plan arriba, lo hecho esta semana y las sesiones en orden; la siguiente, abierta. */
function RoutineList() {
  const nextIndex = DEMO_ROUTINE.findIndex((session) => !session.done);
  return <div className="pb-4">
    <h2 className="type-large-title leading-tight">Entrenar</h2>
    <p className="mt-1 type-subhead text-muted-foreground">Tus sesiones en orden. Hazlas el día que te venga bien.</p>
    <div className="mt-5 flex items-center gap-3 rounded-[22px] bg-card py-3.5 pl-5 pr-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Piloto automático</p>
        <p className="mt-1 truncate type-subhead text-muted-foreground">Preparada por Autopilot.</p>
      </div>
      <span aria-hidden="true" className="flex shrink-0 items-center gap-1 text-primary">
        <Play className="h-5 w-5" strokeWidth={1.75} /><BookOpen className="ml-3 h-5 w-5" strokeWidth={1.75} /><span className="ml-3 type-subhead font-semibold">Editar</span>
      </span>
    </div>
    <div className="mt-5 flex items-center gap-3">
      <div aria-hidden="true" className="flex flex-1 gap-1.5">{DEMO_ROUTINE.map((s) => <span key={s.name} className={cn("h-1.5 flex-1 rounded-full", s.done ? "bg-primary" : "bg-secondary")} />)}</div>
      <span className="shrink-0 type-footnote tabular-nums text-muted-foreground">{`${DEMO_ROUTINE.filter((s) => s.done).length} de ${DEMO_ROUTINE.length} esta semana`}</span>
    </div>
    <ul className="mt-5 space-y-3">
      {DEMO_ROUTINE.map((session, i) => (
        <li key={session.name} className="space-y-3">
          <div className={cn("flex min-h-[80px] items-center gap-3.5 rounded-[22px] border bg-card p-3 pr-4", i === nextIndex ? "border-primary/60" : "border-border")}>
            <img src={previewExercises[i % previewExercises.length].image} alt="" loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-2xl bg-secondary object-cover" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 type-footnote font-medium text-muted-foreground">
                {`Sesión ${i + 1}`}
                {session.done ? <span className="inline-flex items-center gap-0.5 text-success">· <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />Hecha</span>
                  : i === nextIndex ? <span className="text-primary">· Siguiente</span> : null}
              </span>
              <span className="mt-0.5 block truncate type-headline">{session.name}</span>
              <span className="mt-0.5 block type-footnote tabular-nums text-muted-foreground">{i === nextIndex ? `${DEMO_SESSION.exercises} ejercicios · ${DEMO_SESSION.series} series` : "4 ejercicios · 12 series"}</span>
            </span>
          </div>
          {i === nextIndex && <>
            <span className="flex h-[50px] w-full items-center justify-center rounded-full bg-primary type-headline text-primary-foreground">Empezar sesión</span>
            <div className="overflow-hidden rounded-[22px] bg-card">{previewExercises.map((ex) => (
              <div key={ex.name} className="flex items-center gap-3 border-b border-border/60 p-3 last:border-0">
                <img src={ex.image} alt="" loading="lazy" decoding="async" className="h-11 w-11 shrink-0 rounded-xl bg-secondary object-cover" />
                <div className="min-w-0 flex-1"><p className="truncate type-subhead font-semibold">{ex.name}</p><p className="type-footnote text-muted-foreground">90 s</p></div>
                <span className="type-subhead tabular-nums text-muted-foreground">{`${ex.sets} × ${ex.reps}`}</span>
              </div>
            ))}</div>
          </>}
        </li>
      ))}
    </ul>
  </div>;
}

export function PublicTrainingScreen({ active = false }: { active?: boolean }) {
  return active ? <ActiveWorkout /> : <RoutineList />;
}

/** Nutrición en Gratis: calorías y macros del cálculo inicial y, debajo, lo que añade Plus. */
export function PublicBasicNutrition({ plus = true, plusName = "Plus" }: { plus?: boolean; plusName?: string }) {
  const macros = [{ label: "Proteína", value: 150, dot: "bg-primary" }, { label: "Carbohidratos", value: 260, dot: "bg-primary/60" }, { label: "Grasas", value: 70, dot: "bg-primary/30" }];
  return <section className="space-y-7 pb-4">
    <div>
      <h2 className="type-large-title leading-tight">Nutrición</h2>
      <p className="mt-1 type-subhead text-muted-foreground">Plan de alimentación básico.</p>
    </div>
    <div className={cn(card, "p-5")}>
      <div className="flex items-center gap-4">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 whitespace-nowrap type-footnote text-muted-foreground"><Flame aria-hidden="true" className="h-4 w-4 shrink-0 fill-primary text-primary" strokeWidth={1.75} />Calorías diarias</span>
          <span className="block whitespace-nowrap text-[28px] font-bold leading-tight tracking-tight tabular-nums">2.300<span className="ml-1 text-[17px] font-semibold">kcal</span></span>
        </span>
        <ul aria-label="Macros del día" className="shrink-0 space-y-1.5 border-l border-border pl-4">
          {macros.map((m) => <li key={m.label} className="flex items-center gap-2 type-footnote"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`} /><span className="text-muted-foreground">{m.label}</span><span className="ml-auto pl-3 font-semibold tabular-nums">{m.value} g</span></li>)}
        </ul>
      </div>
      <p className="mt-4 border-t border-border pt-3 type-caption1 text-muted-foreground">Estimación inicial según tus datos y objetivo. No sustituye una valoración nutricional individual.</p>
    </div>
    {plus && <div>
      <h3 className="type-title3">{`Más en ${plusName}`}</h3>
      <div className={cn(card, "mt-3 flex items-center gap-3.5 p-4")}>
        <UtensilsCrossed className="h-6 w-6 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <span className="min-w-0 flex-1"><span className="block type-headline">Comidas de cada día</span><span className="block type-footnote text-muted-foreground">Ajustadas a tus macros y a lo que te gusta.</span></span>
        <Lock className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="mt-3 flex h-12 items-center gap-2 rounded-full border border-primary/60 px-5 type-headline text-primary"><Crown className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />{`Descubre Autopilot ${plusName}`}</div>
    </div>}
  </section>;
}
