import { useRef, useState, type ElementType } from "react";
import { buildWorkoutReview, type ReviewExercise } from "@/lib/workoutReview";
import { Dumbbell, Target, TrendingUp, Trophy } from "lucide-react";
import { hapticSelection, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";
import { MuscleMapFigure } from "./MuscleMapFigure";
import { WorkoutStoryShare } from "./WorkoutStoryShare";

interface Props {
  /** Hoja al terminar: barra con «Listo» y pie fijo con Compartir. En línea: solo el contenido. */
  sheet?: boolean;
  onDone?: () => void;
  /** Título y descripción accesibles (DialogTitle/DialogDescription en la hoja). */
  Title?: ElementType;
  Desc?: ElementType;
  dateLabel: string;
  sessionTitle: string;
  totalVolume: number;
  previousVolume: number;
  completedSets: number;
  completedExercises: number;
  plannedExercises: number;
  rpe: number | null;
  records: string[];
  muscles: string[];
  muscleSetCounts: Record<string, number>;
  intensityFor: (muscle: string) => string;
  current: ReviewExercise[];
  previous: ReviewExercise[];
}

const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");

/**
 * Resumen final al estilo del de Fitness: una sola página que se desplaza, cifras grandes
 * en rejilla, listas agrupadas y una única acción principal (Compartir).
 */
export function WorkoutSummary({
  sheet = false,
  onDone,
  Title = "h2",
  Desc = "p",
  dateLabel,
  sessionTitle,
  totalVolume,
  previousVolume,
  completedSets,
  completedExercises,
  plannedExercises,
  rpe,
  records,
  muscles,
  muscleSetCounts,
  intensityFor,
  current,
  previous,
}: Props) {
  const [titleName, ...titleRest] = sessionTitle.split(" · ");
  const titleDetail = titleRest.join(" · ");
  const review = buildWorkoutReview(current, previous, rpe);
  const progress = review.filter((item) => item.observation.startsWith("+"));
  const comparisons = (progress.length ? progress : review).slice(0, 3);
  const nextStep = review[0]?.proposal || "Mantén tu plan como referencia para la próxima sesión.";
  const leadMuscles = [...muscles].sort((a, b) => (muscleSetCounts[b] || 0) - (muscleSetCounts[a] || 0)).slice(0, 4);
  const diff = totalVolume - previousVolume;
  const pct = previousVolume > 0 && totalVolume > 0 ? Math.round((diff / previousVolume) * 100) : null;

  const metrics = [
    {
      label: totalVolume > 0 ? "Volumen" : "Series",
      value: totalVolume > 0 ? fmt(totalVolume) : String(completedSets),
      unit: totalVolume > 0 ? "kg" : "",
      accent: true,
      note: pct !== null ? `${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff))} kg vs. anterior` : null,
      positive: diff >= 0,
    },
    totalVolume > 0
      ? { label: "Series", value: String(completedSets), unit: "" }
      : { label: "Ejercicios", value: `${completedExercises}`, unit: `/${plannedExercises}` },
    totalVolume > 0
      ? { label: "Ejercicios", value: `${completedExercises}`, unit: `/${plannedExercises}` }
      : { label: "Récords", value: String(records.length), unit: "" },
    { label: "Esfuerzo", value: rpe !== null ? String(rpe) : "—", unit: rpe !== null ? "/10" : "" },
  ];

  // Mosaico de tarjetas compactas (como Fitness/Salud). En la hoja suben un tono sobre su fondo.
  const tile = cn("min-w-0 rounded-2xl p-3.5", sheet ? "bg-secondary" : "bg-card");
  const tileLabel = "flex items-center gap-1.5 type-footnote font-semibold";

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState(0);
  const handleScroll = () => {
    const el = scrollerRef.current;
    const first = el?.children[0] as HTMLElement | undefined;
    if (!el || !first) return;
    setActiveCard(Math.round(el.scrollLeft / (first.offsetWidth + 10)));
  };
  const goTo = (index: number) => {
    const el = scrollerRef.current;
    const card = el?.children[index] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 16, behavior: "smooth" });
    setActiveCard(index);
  };

  const label = (Icon: typeof Target, text: string, accent = false) => (
    <p className={cn(tileLabel, accent ? "text-primary" : "text-muted-foreground")}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {text}
    </p>
  );
  const cards = [
    records.length > 0 && {
      key: "records",
      body: (
        <>
          {label(Trophy, records.length === 1 ? "Nuevo récord" : `${records.length} récords nuevos`, true)}
          <ul className="mt-1.5 space-y-1">
            {records.slice(0, 3).map((record) => <li key={record} className="truncate type-headline">{record}</li>)}
          </ul>
        </>
      ),
    },
    muscles.length > 0 && {
      key: "muscles",
      body: (
        <div className="flex flex-1 gap-3">
          <div className="grid h-24 w-[5.5rem] shrink-0 grid-cols-2 gap-1" aria-hidden="true">
            {(["front", "back"] as const).map((side) => (
              <div key={side} className="h-full overflow-hidden rounded-lg">
                <MuscleMapFigure side={side} muscles={muscles} intensityFor={intensityFor} />
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            {label(Dumbbell, "Músculos")}
            <ul className="mt-1.5 space-y-1">
              {leadMuscles.slice(0, 3).map((muscle) => (
                <li key={muscle} className="flex items-center gap-2 type-subhead">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: intensityFor(muscle) }} />
                  <span className="truncate">{muscle}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{Math.round(muscleSetCounts[muscle] || 0)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ),
    },
    comparisons.length > 0 && {
      key: "compare",
      body: (
        <>
          {label(TrendingUp, "Frente a la última vez")}
          <ul className="mt-1.5 space-y-1.5">
            {comparisons.slice(0, 2).map((item) => (
              <li key={item.name} className="min-w-0">
                <p className="truncate type-subhead font-semibold">{item.name}</p>
                <p className="truncate type-footnote text-muted-foreground">{item.observation}</p>
              </li>
            ))}
          </ul>
        </>
      ),
    },
    {
      key: "next",
      body: (
        <>
          {label(Target, "Próximo paso")}
          <p className="mt-1.5 line-clamp-3 type-subhead">{nextStep}</p>
          <p className="mt-auto pt-1 type-caption1 text-muted-foreground">Tu plan no se modifica sin revisión.</p>
        </>
      ),
    },
  ].filter((card): card is { key: string; body: JSX.Element } => Boolean(card));

  const body = (
    <div className={cn("flex flex-col gap-5", sheet && "px-4 pb-5")}>
      <header className="px-1">
        <Desc className="type-subhead text-muted-foreground">Completado · {dateLabel}</Desc>
        <Title className={cn("mt-0.5 truncate", sheet ? "type-large-title" : "type-title1")}>{titleName}</Title>
        {titleDetail && <p className="mt-0.5 truncate type-headline text-muted-foreground">{titleDetail}</p>}
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        {metrics.map((m) => (
          <div key={m.label} className={tile}>
            <p className={cn(tileLabel, m.accent ? "text-primary" : "text-muted-foreground")}>{m.label}</p>
            <p className={cn("mt-1 truncate font-rounded text-[30px] font-bold leading-[36px] tabular-nums", m.accent && "text-primary")}>
              {m.value}
              {m.unit && <span className="ml-0.5 text-[17px] font-semibold text-muted-foreground">{m.unit}</span>}
            </p>
            {"note" in m && m.note ? (
              <p className={cn("truncate type-caption1 font-medium tabular-nums", m.positive ? "text-success" : "text-muted-foreground")}>{m.note}</p>
            ) : null}
          </div>
        ))}

      </div>

      {/* Tarjetas deslizables: la siguiente asoma por la derecha y los puntos marcan la página. */}
      <div>
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          aria-label="Análisis de la sesión"
          className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cards.map((card) => (
            <article key={card.key} className={cn(tile, "flex min-h-[8.5rem] w-[86%] shrink-0 snap-start flex-col")}>
              {card.body}
            </article>
          ))}
        </div>
        {cards.length > 1 && (
          <div className="mt-2.5 flex justify-center gap-1.5" role="group" aria-label={`Tarjeta ${activeCard + 1} de ${cards.length}`}>
            {cards.map((card, i) => (
              <button
                key={card.key}
                type="button"
                aria-label={`Ir a la tarjeta ${i + 1}`}
                onClick={() => { void hapticSelection(); goTo(i); }}
                className={cn(
                  "relative h-[7px] w-[7px] rounded-full transition-colors duration-200 before:absolute before:-inset-x-[3px] before:-inset-y-3 before:content-['']",
                  i === activeCard ? "bg-foreground" : "bg-foreground/25",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const share = (
    <WorkoutStoryShare
      title={sessionTitle}
      date={dateLabel}
      volumeKg={totalVolume}
      sets={completedSets}
      exercises={completedExercises}
      records={records}
      muscles={muscles}
      muscleSetCounts={muscleSetCounts}
      previousVolumeKg={previousVolume}
    />
  );

  if (!sheet) {
    return (
      <section aria-label="Resumen de la sesión" className="flex flex-col gap-5">
        {body}
        {share}
      </section>
    );
  }

  return (
    <section aria-label="Resumen de la sesión" className="flex h-full min-h-0 flex-col">
      {/* Barra de navegación de la hoja: «Listo» arriba a la derecha, como en iOS. */}
      <div className="flex h-11 shrink-0 items-center justify-end px-3">
        <button
          type="button"
          onClick={() => { void hapticTap(); onDone?.(); }}
          className="h-11 px-2 type-headline text-primary transition-opacity active:opacity-60"
        >
          Listo
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
      <div className="shrink-0 px-5 pt-3 sep-t">{share}</div>
    </section>
  );
}
