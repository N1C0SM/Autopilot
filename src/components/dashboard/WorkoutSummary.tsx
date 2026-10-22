import { useRef, useState, type ElementType, type ReactNode } from "react";
import { buildWorkoutReview, type ReviewExercise } from "@/lib/workoutReview";
import { Target, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { hapticSelection, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";
import { MuscleMapFigure } from "./MuscleMapFigure";
import { WorkoutStoryShare } from "./WorkoutStoryShare";

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
 * próximo paso), con puntos de página y una única acción principal: Compartir.
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
  const progress = review.filter((item) => item.observation.startsWith("+"));
  const comparisons = (progress.length ? progress : review).slice(0, 4);
  const nextStep = review[0]?.proposal || "Mantén tu plan como referencia para la próxima sesión.";
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

  // Tarjetas compactas: en la hoja suben un tono sobre su fondo.
  const tile = cn("min-w-0 rounded-2xl p-3.5", sheet ? "bg-secondary" : "bg-card");
  const pageTitle = "type-title2";

  const pages: { key: string; label: string; body: ReactNode }[] = [
    {
      key: "summary",
      label: "Resumen",
      body: (
        <>
          <header>
            <Desc className="type-subhead text-muted-foreground">Completado · {dateLabel}</Desc>
            <Title className={cn("mt-0.5 truncate", sheet ? "type-large-title" : "type-title1")}>{titleName}</Title>
            {titleDetail && <p className="mt-0.5 truncate type-headline text-muted-foreground">{titleDetail}</p>}
          </header>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {metrics.map((m) => (
              <div key={m.label} className={tile}>
                <p className={cn("type-footnote font-semibold", m.accent ? "text-primary" : "text-muted-foreground")}>{m.label}</p>
                <p className={cn("mt-1 truncate font-rounded text-[30px] font-bold leading-[36px] tabular-nums", m.accent && "text-primary")}>
                  {m.value}
                  {m.unit && <span className="ml-0.5 text-[17px] font-semibold text-muted-foreground">{m.unit}</span>}
                </p>
                {"note" in m && m.note ? (
                  <p className={cn("truncate type-caption1 font-medium tabular-nums", m.positive ? "text-success" : "text-muted-foreground")}>{m.note}</p>
                ) : null}
              </div>
            ))}
            {records.length > 0 && (
              <div className={cn(tile, "col-span-2 flex items-center gap-3")}>
                <Trophy className="h-6 w-6 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="type-footnote font-semibold text-primary">{records.length === 1 ? "Nuevo récord" : `${records.length} récords nuevos`}</p>
                  <p className="truncate type-headline">{records.join(" · ")}</p>
                </div>
              </div>
            )}
          </div>
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
    ...(comparisons.length
      ? [{
          key: "compare",
          label: "Comparar",
          body: (
            <>
              <h3 className={pageTitle}>Frente a la última vez</h3>
              <ul className="mt-4 space-y-2.5">
                {comparisons.map((item) => {
                  const down = item.observation.startsWith("−") || item.observation.startsWith("-");
                  const Icon = down ? TrendingDown : TrendingUp;
                  return (
                    <li key={item.name} className={cn(tile, "flex items-start gap-3")}>
                      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", down ? "text-muted-foreground" : "text-success")} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate type-headline">{item.name}</p>
                        <p className="line-clamp-2 type-footnote text-muted-foreground">{item.observation}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ),
        }]
      : []),
    {
      key: "next",
      label: "Siguiente",
      body: (
        <>
          <h3 className={pageTitle}>Próximo paso</h3>
          <div className={cn(tile, "mt-4 flex items-start gap-3")}>
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="type-body">{nextStep}</p>
          </div>
          <p className="mt-2 px-1 type-footnote text-muted-foreground">
            {rpe != null ? `Esfuerzo registrado: ${rpe}/10. ` : ""}Tu plan no se modifica sin revisión.
          </p>
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
