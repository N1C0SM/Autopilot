import { useRef, useState, type ReactNode } from "react";
import { Dumbbell, Target, TrendingUp } from "lucide-react";
import { buildWorkoutReview, type ReviewExercise } from "@/lib/workoutReview";
import { MuscleMapFigure } from "./MuscleMapFigure";

interface Props {
  muscles: string[];
  muscleSetCounts: Record<string, number>;
  intensityFor: (muscle: string) => string;
  current: ReviewExercise[];
  previous: ReviewExercise[];
  rpe?: number | null;
  intro?: ReactNode;
}

export function WorkoutStudyCards({ muscles, muscleSetCounts, intensityFor, current, previous, rpe, intro }: Props) {
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
  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    setActiveCard(Math.min(total - 1, Math.max(0, Math.round(scroller.scrollLeft / (scroller.clientWidth * 0.88)))));
  };

  const cardClass = "h-[18.5rem] w-[88%] shrink-0 snap-center overflow-hidden rounded-2xl border border-border/80 bg-card p-4 text-left first:snap-start last:snap-end";

  return (
    <section aria-label="Análisis de la sesión" className="min-w-0">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex w-full snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {intro && <article className={`${cardClass} border-primary/25 bg-gradient-to-b from-primary/10 to-card`}>{intro}</article>}
        <article className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase text-primary">Foco</p>
              <h3 className="mt-0.5 text-base font-bold">Músculos de hoy</h3>
            </div>
            <Dumbbell className="h-4 w-4 text-primary" />
          </div>
          {muscles.length ? (
            <div className="mt-3 grid h-[10.5rem] grid-cols-[1fr_1fr] gap-2">
              {(["front", "back"] as const).map((side) => (
                <div key={side} className="mx-auto h-full max-w-[6.25rem] overflow-hidden rounded-xl bg-secondary/30">
                  <MuscleMapFigure side={side} muscles={muscles} intensityFor={intensityFor} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 flex h-[10.5rem] items-center justify-center rounded-xl bg-secondary/30 px-5 text-center text-xs text-muted-foreground">
              No hay grupos musculares asociados a esta sesión.
            </div>
          )}
          <p className="mt-2 truncate text-xs text-muted-foreground">
            {leadMuscles.map((muscle) => `${muscle} · ${muscleSetCounts[muscle]} series`).join("  ·  ") || "Sesión registrada"}
          </p>
        </article>

        <article className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase text-primary">Progreso</p>
              <h3 className="mt-0.5 text-base font-bold">Comparación anterior</h3>
            </div>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-4 space-y-2.5">
            {reviewItems.length ? reviewItems.map((item) => (
              <div key={item.name} className="rounded-xl bg-secondary/35 p-3">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.observation}</p>
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
              <h3 className="mt-0.5 text-base font-bold">Próximo paso</h3>
            </div>
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-4 flex h-[9.5rem] flex-col justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-semibold leading-relaxed">{nextStep}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {rpe != null ? `Esfuerzo registrado: ${rpe}/10.` : "Registra tu esfuerzo la próxima vez para afinar esta recomendación."}
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Tu plan no se modifica sin revisión.</p>
        </article>
      </div>
      <div className="mt-2 flex justify-center gap-1.5" aria-label={`Ficha ${activeCard + 1} de ${total}`}>
        {Array.from({ length: total }, (_, i) => i).map((index) => (
          <span key={index} className={`h-1.5 rounded-full transition-all ${activeCard === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/35"}`} />
        ))}
      </div>
    </section>
  );
}