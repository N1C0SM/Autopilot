import { useRef, useState, type ReactNode } from "react";
import { Dumbbell, Flag, Gauge, Target, TrendingDown, TrendingUp } from "lucide-react";
import { buildWorkoutReview, type ReviewExercise } from "@/lib/workoutReview";
import { MuscleMapFigure } from "./MuscleMapFigure";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FeatureRow } from "@/components/workout-parts/FeatureRow";
import { hapticSelection, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";

interface Props {
  muscles: string[];
  muscleSetCounts: Record<string, number>;
  intensityFor: (muscle: string) => string;
  current: ReviewExercise[];
  previous: ReviewExercise[];
  rpe?: number | null;
  intro?: ReactNode;
  /** Modo pantalla completa estilo Stories: barras arriba y botón integrado abajo. */
  immersive?: boolean;
  onFinish?: () => void;
}

// Las fichas son una superficie (o la hoja): el squircle del estado vacío sube un tono.
const NESTED_EMPTY = "[&>div:first-child]:bg-secondary";

const trendIcon = (observation: string) =>
  observation.startsWith("+") ? TrendingUp : observation.startsWith("−") || observation.startsWith("-") ? TrendingDown : Flag;

export function WorkoutStudyCards({ muscles, muscleSetCounts, intensityFor, current, previous, rpe, intro, immersive, onFinish }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState(0);
  const review = buildWorkoutReview(current, previous, rpe);
  const leadMuscles = [...muscles]
    .sort((a, b) => (muscleSetCounts[b] || 0) - (muscleSetCounts[a] || 0))
    .slice(0, 4);
  const progressItems = review.filter((item) => item.observation.startsWith("+")).slice(0, 2);
  const reviewItems = (progressItems.length ? progressItems : review).slice(0, 2);
  const nextStep = review[0]?.proposal || "Mantén tu plan como referencia para la próxima sesión.";

  const total = intro ? 4 : 3;
  const step = () => (scrollerRef.current?.clientWidth || 0) * (immersive ? 1 : 0.88);
  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    setActiveCard(Math.min(total - 1, Math.max(0, Math.round(scroller.scrollLeft / step()))));
  };
  const goTo = (index: number) => {
    const target = Math.min(total - 1, Math.max(0, index));
    scrollerRef.current?.scrollTo({ left: target * step(), behavior: "smooth" });
    setActiveCard(target);
  };

  // Inmersivo: contenido directamente sobre la hoja. En línea: una sola superficie por ficha.
  const cardClass = immersive
    ? "flex h-full w-full shrink-0 snap-center flex-col overflow-hidden px-5 pt-2 text-left [&_.study-panel]:flex-1"
    : "flex h-full w-full shrink-0 snap-center flex-col overflow-y-auto overscroll-contain rounded-2xl bg-card p-4 text-left [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
  const titleClass = immersive ? "type-title2" : "type-title3";
  const listClass = immersive ? "mt-5 space-y-5" : "mt-4 space-y-4";
  // El estado ocupa lo que queda de la ficha y se centra en ese hueco.
  const emptyClass = cn("study-panel flex-1", immersive ? "py-6" : "py-2", NESTED_EMPTY);
  const isLast = activeCard === total - 1;

  return (
    <section aria-label="Análisis de la sesión" className={immersive ? "flex h-full min-w-0 flex-col" : "flex min-h-0 min-w-0 flex-1 flex-col"}>
      {immersive && (
        <div role="group" className="flex gap-1.5 px-5 pb-3 pr-14" aria-label={`Ficha ${activeCard + 1} de ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir a la ficha ${i + 1}`}
              onClick={() => { void hapticSelection(); goTo(i); }}
              // Barra de 4 px, objetivo táctil de 44.
              className="relative h-1 flex-1 rounded-full bg-foreground/15 before:absolute before:inset-x-0 before:-inset-y-5 before:content-['']"
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300 ease-ios",
                  i <= activeCard ? "w-full" : "w-0",
                )}
              />
            </button>
          ))}
        </div>
      )}
      {!immersive && (
        <div role="tablist" aria-label="Análisis de la sesión" className="mb-3 grid shrink-0 gap-1 rounded-xl bg-secondary p-1" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
          {(intro ? ["Resumen", "Músculos", "Comparar", "Siguiente"] : ["Músculos", "Comparar", "Siguiente"]).map((label, i) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={activeCard === i}
              onClick={() => { void hapticSelection(); setActiveCard(i); }}
              className={cn("truncate rounded-lg px-1 py-2 type-footnote font-semibold transition-colors", activeCard === i ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div
        ref={scrollerRef}
        onScroll={immersive ? handleScroll : undefined}
        className={immersive
          ? "flex min-h-0 w-full flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "w-full [&>article]:hidden [&>article[data-active=true]]:flex"}
      >
        {intro && <article data-active={activeCard === 0} className={cardClass}>{intro}</article>

        <article className={cardClass}>
          <h3 className={titleClass}>Músculos de hoy</h3>
          {muscles.length ? (
            // Inmersivo: figura grande y leyenda debajo. En línea la ficha es baja: figura y leyenda en paralelo.
            <div className={immersive ? "study-panel flex min-h-0 flex-col" : "mt-3 flex items-center gap-4"}>
              <div className={cn("grid grid-cols-2", immersive ? "mt-4 min-h-0 flex-1 gap-3" : "h-[8.5rem] w-[10rem] shrink-0 gap-1")}>
                {(["front", "back"] as const).map((side) => (
                  <div key={side} className={cn("mx-auto h-full w-full overflow-hidden rounded-xl", immersive && "max-w-[10rem]")}>
                    <MuscleMapFigure side={side} muscles={muscles} intensityFor={intensityFor} />
                  </div>
                ))}
              </div>
              <ul className={immersive ? "mt-4 grid grid-cols-2 gap-x-5 gap-y-2" : "min-w-0 flex-1 space-y-2"}>
                {leadMuscles.map((muscle) => (
                  <li key={muscle} className="flex min-w-0 items-center gap-2 type-caption1">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: intensityFor(muscle) }} />
                    <span className="truncate">{muscle}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                      {Math.round(muscleSetCounts[muscle] || 0)} series
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              icon={Dumbbell}
              title="Sin grupos musculares"
              description="No hay grupos musculares asociados a esta sesión."
              className={emptyClass}
            />
          )}
        </article>

        <article className={cardClass}>
          <h3 className={titleClass}>Frente a la última vez</h3>
          {reviewItems.length ? (
            <ul className={listClass}>
              {reviewItems.map((item) => (
                <li key={item.name}>
                  <FeatureRow
                    icon={trendIcon(item.observation)}
                    title={<span className="line-clamp-2">{item.name}</span>}
                    description={<span className={immersive ? "line-clamp-3" : "line-clamp-2"}>{item.observation}</span>}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="Primera referencia"
              description="Esta sesión será tu primera referencia para comparar el progreso."
              className={emptyClass}
            />
          )}
        </article>

        <article className={cardClass}>
          <h3 className={titleClass}>Próximo paso</h3>
          <div className={listClass}>
            <FeatureRow icon={Target} title={nextStep} description="Tu plan no se modifica sin revisión." />
            <FeatureRow
              icon={Gauge}
              title={rpe != null ? `Esfuerzo registrado: ${rpe}/10` : "Esfuerzo sin registrar"}
              description={rpe != null
                ? "Ya se tiene en cuenta en esta recomendación."
                : "Registra tu esfuerzo la próxima vez para afinar esta recomendación."}
            />
          </div>
        </article>
      </div>
      {immersive ? (
        <div className="px-5 pt-3">
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => { void hapticTap(); if (isLast) onFinish?.(); else goTo(activeCard + 1); }}
          >
            {isLast ? "Finalizar sesión" : "Siguiente"}
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex shrink-0 justify-center gap-2" aria-label={`Ficha ${activeCard + 1} de ${total}`}>
          {Array.from({ length: total }, (_, i) => i).map((index) => (
            <span
              key={index}
              className={cn("h-[7px] w-[7px] rounded-full transition-colors duration-200", activeCard === index ? "bg-primary" : "bg-foreground/30")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
