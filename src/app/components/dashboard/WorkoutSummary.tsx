import { useRef, useState, type ElementType, type ReactNode } from "react";
import { buildWorkoutReview, type ReviewExercise } from "@/shared/lib/workoutReview";
import { Target, Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import { CountUp } from "@/shared/components/ui/count-up";
import { MuscleMapFigure } from "@/app/components/dashboard/MuscleMapFigure";
import { WorkoutStoryShare } from "@/app/components/dashboard/WorkoutStoryShare";
import { motion } from "framer-motion";
import { parsePositiveWeight } from "@/shared/lib/weight";
import { isWorkoutSetWarmup } from "@/shared/lib/workoutSet";

interface Props {
  /** Hoja al terminar: barra con «Listo» y pie fijo con Compartir. En línea: sin barra. */
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
 * Resumen final en páginas que se deslizan enteras (resumen, músculos, comparación y
 * próxima sesión), con puntos de página y una única acción principal: Compartir.
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  const [titleName, ...titleRest] = sessionTitle.split(" · ");
  const titleDetail = titleRest.join(" · ");
  const review = buildWorkoutReview(current, previous, rpe);
  const nextStep = review[0]?.proposal || "Mantén tu plan como referencia para la próxima sesión.";
  const diff = totalVolume - previousVolume;
  const pct = previousVolume > 0 && totalVolume > 0 ? Math.round((diff / previousVolume) * 100) : null;

  const metrics = [
    {
      label: totalVolume > 0 ? "Volumen" : "Series",
      value: totalVolume > 0 ? fmt(totalVolume) : String(completedSets),
      count: totalVolume > 0 ? totalVolume : completedSets,
      unit: totalVolume > 0 ? "kg" : "",
      accent: true,
      note: pct !== null ? `${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff))} kg vs. anterior` : null,
      positive: diff >= 0,
    },
    totalVolume > 0
      ? { label: "Series", value: String(completedSets), count: completedSets, unit: "" }
      : { label: "Ejercicios", value: `${completedExercises}`, unit: `/${plannedExercises}` },
    totalVolume > 0
      ? { label: "Ejercicios", value: `${completedExercises}`, unit: `/${plannedExercises}` }
      : { label: "Récords", value: String(records.length), unit: "" },
    { label: "Esfuerzo", value: rpe !== null ? String(rpe) : "—", unit: rpe !== null ? "/10" : "" },
  ];

  // Tarjetas compactas: en la hoja suben un tono sobre su fondo.
  const tile = cn("min-w-0 rounded-media p-3.5", sheet ? "bg-secondary" : "bg-card");
  const pageTitle = "type-title2";

  const pages: { key: string; label: string; body: ReactNode }[] = [
    {
      key: "summary",
      label: "Resumen",
      body: (
        <>
          <header className="text-center">
            <Desc className="type-subhead text-muted-foreground">Completado · {dateLabel}</Desc>
            <Title className={cn("mt-1 truncate", sheet ? "type-large-title" : "type-title1")}>{titleName}</Title>
            {titleDetail && <p className="mt-0.5 truncate type-headline text-muted-foreground">{titleDetail}</p>}
          </header>

          {/* Hero: Volumen total con comparación visual */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="mt-6 text-center"
          >
            <div className="type-figure text-[56px] font-bold leading-none tabular-nums text-primary">
              <CountUp value={totalVolume} />
              <span className="ml-1 text-[28px] text-muted-foreground">kg</span>
            </div>
            
            {previousVolume > 0 && (
              <motion.div 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="mt-3 flex items-center justify-center gap-2"
              >
                {diff > 0 ? (
                  <>
                    <TrendingUp className="h-5 w-5 text-success" strokeWidth={2.5} />
                    <span className="font-rounded text-[22px] font-bold tabular-nums text-success">
                      +{fmt(diff)} kg
                    </span>
                  </>
                ) : diff < 0 ? (
                  <>
                    <TrendingDown className="h-5 w-5 text-warning" strokeWidth={2.5} />
                    <span className="font-rounded text-[22px] font-bold tabular-nums text-warning">
                      {fmt(diff)} kg
                    </span>
                  </>
                ) : (
                  <>
                    <Minus className="h-5 w-5 text-muted-foreground" strokeWidth={2.5} />
                    <span className="type-headline text-muted-foreground">
                      Mismo volumen
                    </span>
                  </>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Récords personales destacados */}
          {records.length > 0 && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="mt-6 rounded-media bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-4 ring-1 ring-inset ring-amber-500/30"
            >
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-6 w-6 text-amber-400" strokeWidth={2} />
                <span className="type-title3 text-amber-400">
                  {records.length} Récord{records.length > 1 ? 's' : ''} Personal{records.length > 1 ? 'es' : ''}
                </span>
              </div>
              
              <div className="space-y-2">
                {records.map((exerciseName, idx) => {
                  const currentSet = current.find(e => e.name === exerciseName)?.sets.find(s => s.done && !isWorkoutSetWarmup(s));
                  const prevSet = previous.find(e => e.name === exerciseName)?.sets.find(s => s.done && !isWorkoutSetWarmup(s));
                  const currentWeight = parsePositiveWeight(currentSet?.weight);
                  const prevWeight = parsePositiveWeight(prevSet?.weight);
                  const weightDiff = currentWeight && prevWeight ? currentWeight - prevWeight : 0;
                  
                  return (
                    <motion.div 
                      key={exerciseName}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.4 + idx * 0.1, duration: 0.3 }}
                      className="flex items-center justify-between rounded-chip bg-black/10 px-3 py-2"
                    >
                      <span className="type-body font-medium text-amber-50">{exerciseName}</span>
                      <div className="text-right">
                        <div className="type-body font-bold tabular-nums text-amber-400">
                          {currentWeight ? `${currentWeight}kg` : '—'}
                        </div>
                        {weightDiff > 0 && (
                          <div className="type-caption1 tabular-nums text-amber-400/70">
                            +{weightDiff}kg
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Stats grid */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="mt-6 grid grid-cols-2 gap-3"
          >
            {/* Series completadas */}
            <div className={cn(tile, "text-center")}>
              <div className="type-caption1 font-semibold text-muted-foreground">
                Series
              </div>
              <div className="mt-2 type-figure text-[36px] font-bold leading-none tabular-nums">
                {completedSets}
              </div>
            </div>
            
            {/* Ejercicios */}
            <div className={cn(tile, "text-center")}>
              <div className="type-caption1 font-semibold text-muted-foreground">
                Ejercicios
              </div>
              <div className="mt-2 type-figure text-[36px] font-bold leading-none tabular-nums">
                {completedExercises}<span className="text-[20px] text-muted-foreground">/{plannedExercises}</span>
              </div>
            </div>
            
            {/* Músculos */}
            <div className={cn(tile, "text-center")}>
              <div className="type-caption1 font-semibold text-muted-foreground">
                Músculos
              </div>
              <div className="mt-2 type-figure text-[36px] font-bold leading-none tabular-nums">
                {muscles.length}
              </div>
            </div>
            
            {/* RPE */}
            {rpe !== null && (
              <div className={cn(tile, "text-center")}>
                <div className="type-caption1 font-semibold text-muted-foreground">
                  Esfuerzo
                </div>
                <div className="mt-2 type-figure text-[36px] font-bold leading-none tabular-nums">
                  {rpe}<span className="text-[20px] text-muted-foreground">/10</span>
                </div>
              </div>
            )}
          </motion.div>
        </>
      ),
    },
    ...(muscles.length
      ? [{
          key: "muscles",
          label: "Músculos",
          body: (
            <>
              <h3 className={pageTitle}>Músculos trabajados</h3>
              {/* Una imagen vale más que una lista: el cuerpo llena la tarjeta. */}
              <div className={cn(tile, "mt-4 grid min-h-[16rem] flex-1 grid-cols-2 gap-1 px-3 py-4")}>
                {(["front", "back"] as const).map((side) => (
                  <div key={side} className="flex h-full min-h-0 justify-center">
                    <MuscleMapFigure side={side} muscles={muscles} intensityFor={intensityFor} />
                  </div>
                ))}
              </div>
            </>
          ),
        }]
      : []),
    {
      // Comparación y próximo paso en una sola página: cada ejercicio con su cambio en una etiqueta.
      key: "compare",
      label: "Comparar",
      body: (
        <>
          <h3 className={pageTitle}>Frente a la última vez</h3>
          {review.length ? (
            <ul className={cn(tile, "mt-4 px-0 py-0")}>
              {review.slice(0, 6).map((item) => (
                <li key={item.name} className="flex min-h-[44px] items-center gap-3 px-3.5 py-2.5 [&:not(:last-child)]:sep-b">
                  <span className="min-w-0 flex-1 truncate type-subhead">{item.name}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 type-footnote font-semibold tabular-nums",
                      item.trend === "up" && "bg-success/15 text-success",
                      item.trend === "down" && "bg-destructive/15 text-destructive",
                      (item.trend === "same" || item.trend === "new") && "bg-foreground/10 text-muted-foreground",
                    )}
                  >
                    {item.change}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 type-subhead text-muted-foreground">Esta sesión será tu referencia para la próxima.</p>
          )}
          <div className={cn(tile, "mt-3 flex items-start gap-3")}>
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="type-footnote font-semibold text-primary">Próxima sesión</p>
              <p className="type-subhead">{nextStep}</p>
            </div>
          </div>
        </>
      ),
    },
  ];

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setActivePage(Math.min(pages.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };
  const goTo = (index: number) => {
    const el = scrollerRef.current;
    el?.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    setActivePage(index);
  };

  const pager = (
    <div className="flex min-h-0 flex-col">
      {/* Cada página ocupa todo el ancho y se desliza entera; la hoja mide lo que la página más alta. */}
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        aria-label="Resumen de la sesión"
        className="flex min-h-0 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((page, i) => (
          <article
            key={page.key}
            aria-label={page.label}
            aria-hidden={i !== activePage || undefined}
            className={cn("flex w-full min-w-full shrink-0 snap-start snap-always flex-col overflow-y-auto", sheet ? "px-4 pb-2" : "")}
          >
            {page.body}
          </article>
        ))}
      </div>
      <div className="flex shrink-0 justify-center gap-2 py-3" role="group" aria-label={`Página ${activePage + 1} de ${pages.length}`}>
        {pages.map((page, i) => (
          <button
            key={page.key}
            type="button"
            aria-label={`Ver ${page.label.toLowerCase()}`}
            aria-current={i === activePage || undefined}
            onClick={() => { void hapticSelection(); goTo(i); }}
            className={cn(
              "relative h-[7px] w-[7px] rounded-full transition-colors duration-200 before:absolute before:-inset-x-[4px] before:-inset-y-3 before:content-['']",
              i === activePage ? "bg-foreground" : "bg-foreground/25",
            )}
          />
        ))}
      </div>
    </div>
  );

  const share = (
    <WorkoutStoryShare
      variant={pages[activePage]?.key === "muscles" ? "musculos" : "resumen"}
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
      <section aria-label="Resumen de la sesión" className="flex flex-col">
        {pager}
        {share}
      </section>
    );
  }

  return (
    <section aria-label="Resumen de la sesión" className="flex max-h-full min-h-0 flex-col">
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
      {pager}
      <div className="shrink-0 px-4">{share}</div>
    </section>
  );
}
