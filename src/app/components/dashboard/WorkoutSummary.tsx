import { useRef, useState, type ElementType, type ReactNode } from "react";
import { buildWorkoutReview, type ReviewExercise } from "@/shared/lib/workoutReview";
import { compareTag, durationParts, groupedInt, kgText, muscleLine } from "@/shared/lib/workoutSummaryFormat";
import { Target, TrendingUp, Trophy } from "lucide-react";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import { CountUp } from "@/shared/components/ui/count-up";
import { MuscleMapFigure } from "@/app/components/dashboard/MuscleMapFigure";
import { WorkoutStoryShare } from "@/app/components/dashboard/WorkoutStoryShare";
import { motion, useReducedMotion } from "framer-motion";
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
  /** Duración real de la sesión (sin pausas); sin dato si la pantalla se abre después. */
  durationMs?: number | null;
  completedExercises: number;
  plannedExercises: number;
  rpe: number | null;
  records: string[];
  muscles: string[];
  muscleSetCounts: Record<string, number>;
  intensityFor: (muscle: string) => string;
  current: ReviewExercise[];
  previous: ReviewExercise[];
  /** Acción secundaria bajo las páginas (p. ej. «Guardar como rutina» tras un entreno vacío). */
  extraAction?: ReactNode;
}

const bestWeight = (exercise: ReviewExercise | undefined) =>
  Math.max(0, ...(exercise?.sets ?? []).filter((s) => s.done && !isWorkoutSetWarmup(s)).map((s) => parsePositiveWeight(s.weight) ?? 0));

/**
 * Resumen final en páginas que se deslizan enteras (resumen, músculos y comparación con la
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
  durationMs = null,
  completedExercises,
  plannedExercises,
  rpe,
  records,
  muscles,
  muscleSetCounts,
  intensityFor,
  current,
  previous,
  extraAction,
}: Props) {
  const reduced = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  const [titleName, ...titleRest] = sessionTitle.split(" · ");
  const titleDetail = titleRest.join(" · ");
  const review = buildWorkoutReview(current, previous, rpe);
  const nextStep = review[0]?.proposal || "Mantén tu plan como referencia para la próxima sesión.";
  const hasVolume = totalVolume > 0;
  // Solo se celebra lo que sube: con menos volumen que la última vez, la cifra de hoy habla sola.
  const gain = previousVolume > 0 && hasVolume ? totalVolume - previousVolume : 0;
  const enter = (delay: number) => reduced
    ? {}
    : { initial: { y: 12, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { delay, duration: 0.3 } };

  // Tarjetas compactas: en la hoja suben un tono sobre su fondo.
  const tile = cn("min-w-0 rounded-card p-4", sheet ? "bg-secondary" : "bg-card");
  const pageTitle = "type-title3";

  const stats: { label: string; value: string; unit?: string }[] = [
    { label: "Series", value: groupedInt(completedSets) },
    { label: "Ejercicios", value: String(completedExercises), unit: `/${plannedExercises}` },
  ];
  if (durationMs !== null && durationMs > 0) {
    const d = durationParts(durationMs);
    stats.push({ label: "Duración", value: d.value, unit: d.unit });
  }
  if (rpe !== null) stats.push({ label: "Esfuerzo", value: String(rpe), unit: "/10" });
  if (stats.length % 2 === 1 && muscles.length > 0) stats.push({ label: "Músculos", value: String(muscles.length) });

  const musclesText = muscleLine(muscles, muscleSetCounts);

  const pages: { key: string; label: string; body: ReactNode }[] = [
    {
      key: "summary",
      label: "Resumen",
      body: (
        <>
          <header className="text-center">
            <Desc className="type-subhead text-muted-foreground">Completado · {dateLabel}</Desc>
            <Title className={cn("mt-1 line-clamp-2", sheet ? "type-large-title" : "type-title1")}>{titleName}</Title>
            {titleDetail && <p className="mt-0.5 truncate type-headline text-muted-foreground">{titleDetail}</p>}
          </header>

          {/* Una cifra protagonista: el volumen de hoy (o las series, si es peso corporal). */}
          <motion.div {...(reduced ? {} : { initial: { scale: 0.96, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { duration: 0.3 } })} className="relative mt-6 text-center">
            <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.14),transparent)]" />
            <p className="relative type-footnote text-muted-foreground">{hasVolume ? "Volumen total" : "Series completadas"}</p>
            <p className="relative mt-1 whitespace-nowrap type-figure text-[64px] leading-none tabular-nums text-primary">
              <CountUp value={hasVolume ? totalVolume : completedSets} format={groupedInt} />
              <span className="ml-1.5 type-title3 text-muted-foreground">{hasVolume ? "kg" : completedSets === 1 ? "serie" : "series"}</span>
            </p>
            {gain > 0 && (
              <motion.p {...enter(0.2)} className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 type-subhead font-semibold tabular-nums text-primary">
                <TrendingUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                +{groupedInt(gain)} kg más que la última vez
              </motion.p>
            )}
          </motion.div>

          {/* Récords de la sesión: cada uno con su mejor peso y lo que sube. */}
          {records.length > 0 && (
            <motion.section {...enter(0.3)} aria-label="Récords personales" className={cn(tile, "mt-6")}>
              <h3 className="flex items-center gap-2 type-title3">
                <Trophy className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
                {records.length === 1 ? "Nuevo récord personal" : `${records.length} récords personales`}
              </h3>
              <ul className="mt-2">
                {records.map((exerciseName) => {
                  const now = bestWeight(current.find((e) => e.name === exerciseName));
                  const before = bestWeight(previous.find((e) => e.name === exerciseName));
                  const up = now > 0 && before > 0 ? now - before : 0;
                  return (
                    <li key={exerciseName} className="flex min-h-11 items-center gap-3 py-2 [&:not(:last-child)]:sep-b">
                      <span className="min-w-0 flex-1 truncate type-body">{exerciseName}</span>
                      <span className="shrink-0 text-right">
                        {now > 0 && <span className="block whitespace-nowrap type-headline tabular-nums text-primary">{kgText(now)} kg</span>}
                        {up > 0 && <span className="block whitespace-nowrap type-footnote tabular-nums text-muted-foreground">+{kgText(up)} kg</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          )}

          <motion.dl {...enter(0.4)} className="mt-6 grid grid-cols-2 gap-3">
            {stats.map((stat, i) => (
              <div key={stat.label} className={cn(tile, "text-center", stats.length % 2 === 1 && i === stats.length - 1 && "col-span-2")}>
                <dt className="type-footnote text-muted-foreground">{stat.label}</dt>
                <dd className="mt-1.5 whitespace-nowrap type-figure text-[36px] leading-none tabular-nums">
                  {stat.value}
                  {stat.unit && <span className="ml-0.5 type-headline text-muted-foreground">{stat.unit}</span>}
                </dd>
              </div>
            ))}
          </motion.dl>
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
              {musclesText && <p className="mt-0.5 type-footnote text-muted-foreground">{musclesText}</p>}
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
      // Comparación y próximo paso en una sola página: cada ejercicio con su cifra; las mejoras, en dorado.
      key: "compare",
      label: "Comparar",
      body: (
        <>
          <h3 className={pageTitle}>Frente a la última vez</h3>
          {review.length ? (
            <ul className={cn(tile, "mt-4 px-0 py-0")}>
              {review.slice(0, 6).map((item) => {
                const tag = compareTag(item);
                return (
                  <li key={item.name} className="flex min-h-11 items-center gap-3 px-4 py-2.5 [&:not(:last-child)]:sep-b">
                    <span className="min-w-0 flex-1 truncate type-subhead">{item.name}</span>
                    <span
                      className={cn(
                        "shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 type-footnote font-semibold tabular-nums",
                        tag.highlight ? "bg-primary/15 text-primary" : "bg-foreground/10 text-muted-foreground",
                      )}
                    >
                      {tag.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 type-subhead text-muted-foreground">Esta sesión será tu referencia para la próxima.</p>
          )}
          <div className={cn(tile, "mt-3 flex items-start gap-3")}>
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="type-headline">Próxima sesión</p>
              <p className="mt-0.5 type-subhead text-muted-foreground">{nextStep}</p>
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
    el?.scrollTo({ left: index * el.clientWidth, behavior: reduced ? "auto" : "smooth" });
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
              "relative h-[7px] rounded-full transition-[width,background-color] duration-200 before:absolute before:-inset-x-[6px] before:-inset-y-3 before:content-['']",
              i === activePage ? "w-4 bg-primary" : "w-[7px] bg-foreground/25",
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
        {extraAction && <div className="mb-3">{extraAction}</div>}
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
      {extraAction && <div className="shrink-0 px-4 pb-3">{extraAction}</div>}
      <div className="shrink-0 px-4">{share}</div>
    </section>
  );
}
