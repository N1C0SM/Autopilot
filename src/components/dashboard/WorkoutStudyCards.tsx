import { useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, Dumbbell, Target, TrendingUp } from "lucide-react";
import { buildWorkoutReview, type ReviewExercise } from "@/lib/workoutReview";
import { MuscleMapFigure } from "./MuscleMapFigure";
import { Button } from "@/components/ui/button";

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

  const cardClass = immersive
    ? "flex h-full w-full shrink-0 snap-center flex-col overflow-hidden px-5 pt-2 text-left [&_.study-panel]:flex-1"
    : "flex h-full w-full shrink-0 snap-center flex-col overflow-y-auto overscroll-contain rounded-3xl border border-border/60 bg-card p-[clamp(0.875rem,2.2dvh,1.25rem)] text-left [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
  const isLast = activeCard === total - 1;

  return (
    <section aria-label="Análisis de la sesión" className={immersive ? "flex h-full min-w-0 flex-col" : "flex min-h-0 min-w-0 flex-1 flex-col"}>
      {immersive && (
        <div className="flex gap-1.5 px-5 pb-3 pr-14" aria-label={`Ficha ${activeCard + 1} de ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir a la ficha ${i + 1}`}
              onClick={() => goTo(i)}
              className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/15"
            >
              <span className={`block h-full rounded-full bg-primary transition-all duration-300 ${i <= activeCard ? "w-full" : "w-0"}`} />
            </button>
          ))}
        </div>
      )}
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className={`flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${immersive ? "min-h-0 flex-1" : "min-h-0 flex-1 gap-3"}`}
      >
        {intro && <article className={immersive ? cardClass : `${cardClass} border-primary/20 bg-gradient-to-b from-primary/10 to-card`}>{intro}</article>}
        <article className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase text-primary">Foco</p>
              <h3 className={`mt-0.5 font-bold ${immersive ? "font-display text-2xl" : "text-base"}`}>Músculos de hoy</h3>
            </div>
            <Dumbbell className="h-4 w-4 text-primary" />
          </div>
          {muscles.length ? (
            <div className={`mt-3 grid grid-cols-[1fr_1fr] gap-2 ${immersive ? "study-panel min-h-0" : "h-[10.5rem]"}`}>
              {(["front", "back"] as const).map((side) => (
                <div key={side} className={`mx-auto h-full overflow-hidden rounded-xl bg-secondary/30 ${immersive ? "w-full max-w-[10rem]" : "max-w-[6.25rem]"}`}>
                  <MuscleMapFigure side={side} muscles={muscles} intensityFor={intensityFor} />
                </div>
              ))}
            </div>
          ) : (
            <div className={`study-panel mt-3 flex items-center justify-center rounded-xl bg-secondary/30 px-5 text-center text-xs text-muted-foreground ${immersive ? "" : "h-[10.5rem]"}`}>
              No hay grupos musculares asociados a esta sesión.
            </div>
          )}
          <p className="mt-2 truncate text-xs text-muted-foreground">
            {leadMuscles.map((muscle) => `${muscle} · ${Math.round(muscleSetCounts[muscle] || 0)} series`).join("  ·  ") || "Sesión registrada"}
          </p>
        </article>

        <article className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase text-primary">Progreso</p>
              <h3 className={`mt-0.5 font-bold ${immersive ? "font-display text-2xl" : "text-base"}`}>Comparación anterior</h3>
            </div>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-4 space-y-2.5">
            {reviewItems.length ? reviewItems.map((item) => (
              <div key={item.name} className="rounded-xl bg-secondary/35 p-3">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{item.observation}</p>
              </div>
            )) : (
              <div className="flex h-[10rem] items-center justify-center rounded-xl bg-secondary/35 px-5 text-center text-xs leading-relaxed text-muted-foreground">
                Esta sesión será tu primera referencia para comparar el progreso.
              </div>
            )}
          </div>
        </article>

        <article className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase text-primary">Siguiente</p>
              <h3 className={`mt-0.5 font-bold ${immersive ? "font-display text-2xl" : "text-base"}`}>Próximo paso</h3>
            </div>
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className={`mt-4 flex flex-col justify-between rounded-xl border border-primary/20 bg-primary/5 p-4 ${immersive ? "min-h-[11rem]" : "h-[9.5rem]"}`}>
            <p className="text-sm font-semibold leading-relaxed">{nextStep}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {rpe != null ? `Esfuerzo registrado: ${rpe}/10.` : "Registra tu esfuerzo la próxima vez para afinar esta recomendación."}
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Tu plan no se modifica sin revisión.</p>
        </article>
      </div>
      {immersive ? (
        <div className="px-5 pt-3">
          <Button
            type="button"
            variant={isLast ? "hero" : "secondary"}
            className="h-12 w-full rounded-2xl text-base"
            onClick={() => (isLast ? onFinish?.() : goTo(activeCard + 1))}
          >
            {isLast ? (<><Check className="mr-2 h-4 w-4" /> Finalizar sesión</>) : (<>Siguiente <ArrowRight className="ml-2 h-4 w-4" /></>)}
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex justify-center gap-1.5" aria-label={`Ficha ${activeCard + 1} de ${total}`}>
          {Array.from({ length: total }, (_, i) => i).map((index) => (
            <span key={index} className={`h-1.5 rounded-full transition-all ${activeCard === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/35"}`} />
          ))}
        </div>
      )}
    </section>
  );
}
