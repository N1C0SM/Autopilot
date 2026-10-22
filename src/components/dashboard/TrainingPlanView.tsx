import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode, type SyntheticEvent } from "react";
import { Calendar as CalendarIcon, CalendarDays, Check, Clock, Copy, Download, Flame, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup, ListRow } from "@/components/ui/list";
import { cn } from "@/lib/utils";
import { hapticSelection, hapticTap } from "@/lib/native";
import { toast } from "sonner";
import type { DayPlan } from "@/types/training";
import { formatTrainingTitle } from "@/lib/trainingDisplay";
import CalendarExportDialog from "./CalendarExportDialog";
import AIDisclaimer from "@/components/AIDisclaimer";
import { ExerciseThumb } from "@/components/ExerciseMedia";
import ExerciseFocus from "@/components/ExerciseFocus";
import { useExerciseMetadata } from "@/hooks/useExerciseMetadata";

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

interface Props {
  dayPlans: DayPlan[];
  /** Día que debe abrirse al entrar (pulsado en la tira de «Hoy»). */
  initialDay?: string;
  onOpenWorkout?: (day: string) => void;
}

function planToText(dayPlans: DayPlan[]): string {
  let text = "MI PLAN DE ENTRENAMIENTO\n";
  text += "═".repeat(40) + "\n\n";

  for (const day of dayPlans) {
    text += `📅 ${day.day.toUpperCase()}`;
    if (day.type === "gimnasio") {
      text += ` — ${day.routine_name || "Gimnasio"}\n`;
      text += `   Músculos: ${day.muscle_focus || ""}\n\n`;
      for (const ex of day.exercises || []) {
        text += `   • ${ex.name}\n`;
        text += `     ${ex.series} series × ${ex.reps} reps | Descanso: ${ex.rest}\n`;
      }
    } else {
      text += ` — ${day.sport || "Actividad"}\n`;
      text += `   Intensidad: ${day.intensity} | Duración: ${day.duration}\n`;
    }
    text += "\n" + "─".repeat(40) + "\n\n";
  }
  return text;
}

const sessionTitle = (plan: DayPlan) =>
  plan.type === "gimnasio"
    ? formatTrainingTitle(plan.routine_name, plan.muscle_focus) || "Entrenamiento"
    : plan.sport || "Actividad";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const sessionSummary = (plan: DayPlan) => {
  const exercises = plan.exercises ?? [];
  if (exercises.length === 0) return null;
  const sets = exercises.reduce((total, ex) => total + (Number(ex.series) || 0), 0);
  return [plural(exercises.length, "ejercicio", "ejercicios"), sets > 0 ? plural(sets, "serie", "series") : null]
    .filter(Boolean)
    .join(" · ");
};

// La sesión elegida es el protagonista: día, nombre grande y su detalle, sobre negro y sin caja.
const SessionHeader = ({ day, isToday, title, summary }: { day: string; isToday: boolean; title: string; summary?: string | null }) => (
  <div>
    <p className="type-subhead text-muted-foreground">{isToday ? `${day} · hoy` : day}</p>
    <h3 className="mt-1 type-title1">{title}</h3>
    {summary ? <p className="mt-1.5 type-subhead text-muted-foreground">{summary}</p> : null}
  </div>
);

interface ToolRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

// Fila de lista que acepta ref y props de Radix: es el disparador del diálogo de calendario.
const ToolRow = forwardRef<HTMLButtonElement, ToolRowProps>(({ icon, label, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    {...props}
    className={cn(
      "group/row relative flex min-h-[44px] w-full items-center gap-3 px-4 text-left transition-colors duration-150 active:bg-accent focus-visible:bg-accent focus-visible:outline-none",
      className,
    )}
  >
    <span className="flex w-7 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-5">{icon}</span>
    <span className="flex min-h-[44px] min-w-0 flex-1 items-center py-[11px] group-[:not(:last-child)]/row:sep-b">
      <span className="truncate type-body">{label}</span>
    </span>
  </button>
));
ToolRow.displayName = "ToolRow";

const TrainingPlanView = ({ dayPlans, initialDay, onOpenWorkout }: Props) => {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayName = DAYS_ORDER[todayIndex];
  /** Si el día pedido no tiene sesión, se abre el de hoy: mejor que una hoja vacía. */
  const trainsOn = (day?: string) =>
    Boolean(day) && dayPlans.some((p) => p.day === day && (p.type === "gimnasio" || p.type === "actividad"));
  const [expandedDay, setExpandedDay] = useState<string | null>(trainsOn(initialDay) ? initialDay! : todayName);
  const [copied, setCopied] = useState(false);
  const [detail, setDetail] = useState<{
    name: string;
    image?: string | null;
    video?: string | null;
    series?: string;
    reps?: string;
    rest?: string;
    category?: string | null;
    type?: string | null;
  } | null>(null);
  const exerciseMetadata = useExerciseMetadata(dayPlans);
  /** Imágenes de ejercicio que fallaron al cargar: la miniatura y la ficha usan su hueco compuesto, nunca la imagen rota. */
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const usableImage = (src?: string | null) => (src && !failedImages.has(src) ? src : null);
  const handleImageError = (event: SyntheticEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    const src = target.getAttribute("src");
    if (!src) return;
    setFailedImages((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));
  };

  const handleCopy = async () => {
    void hapticTap();
    await navigator.clipboard.writeText(planToText(dayPlans));
    setCopied(true);
    toast.success("Plan copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    void hapticTap();
    const blob = new Blob([planToText(dayPlans)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mi-plan-entrenamiento.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Plan descargado");
  };

  // Solo los días con sesión se pueden abrir; el resto son descanso.
  const workPlanFor = (day: string) => {
    const plan = dayPlans.find((p) => p.day === day);
    return plan?.type === "gimnasio" || plan?.type === "actividad" ? plan : undefined;
  };
  const selectedPlan = expandedDay ? workPlanFor(expandedDay) : undefined;
  const selectedDay = expandedDay ?? "";
  const selectedIsToday = selectedDay === todayName;

  const nextWorkDay = expandedDay
    ? DAYS_ORDER.map((_, i) => DAYS_ORDER[(DAYS_ORDER.indexOf(expandedDay) + 1 + i) % DAYS_ORDER.length]).find((day) => workPlanFor(day))
    : undefined;
  const hasExercises = Boolean(selectedPlan?.exercises && selectedPlan.exercises.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl lg:max-w-4xl flex-col gap-6" onErrorCapture={handleImageError}>
      <h2 className="sr-only">Rutina semanal</h2>

      <div
        role="group"
        aria-label="Días de la semana"
        className="-mx-1 -my-1 flex justify-between gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {DAYS_ORDER.map((day) => {
          const plan = workPlanFor(day);
          const isToday = day === todayName;
          const isExpanded = expandedDay === day;
          const summary = plan ? sessionTitle(plan) : "descanso";
          // El día elegido va tintado (el relleno macizo es solo para el botón de abrir la sesión).
          const tone = isExpanded
            ? "bg-primary/15 text-primary"
            : isToday
            ? "bg-secondary text-primary"
            : plan
            ? "bg-secondary text-foreground"
            : "text-muted-foreground/60";

          return (
            <button
              key={day}
              type="button"
              aria-label={`${day}, ${summary}${isToday ? ", hoy" : ""}`}
              aria-expanded={plan ? isExpanded : undefined}
              disabled={!plan}
              onClick={() => {
                void hapticSelection();
                setExpandedDay(isExpanded ? null : day);
              }}
              className={`flex h-11 w-11 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-full type-subhead lg:text-[16px] font-semibold transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                plan ? "active:opacity-60" : "cursor-default"
              } ${tone}`}
            >
              {day.slice(0, 3)}
            </button>
          );
        })}
      </div>

      {selectedPlan?.type === "gimnasio" && (
        <section aria-label={`Sesión del ${selectedDay.toLocaleLowerCase("es-ES")}`} className="space-y-6">
          <SessionHeader day={selectedDay} isToday={selectedIsToday} title={sessionTitle(selectedPlan)} summary={sessionSummary(selectedPlan)} />
          {onOpenWorkout && hasExercises && (
            <Button type="button" variant="hero" size="lg" className="w-full" onClick={() => onOpenWorkout(selectedDay)}>
              Abrir sesión del {selectedDay.toLocaleLowerCase("es-ES")}
            </Button>
          )}
          {hasExercises && (
            <ListGroup aria-label="Ejercicios">
              {selectedPlan.exercises?.map((ex, i) => {
                const metadata = exerciseMetadata.byId[ex.exercise_id] || exerciseMetadata.byName[ex.name];
                const video = ex.video_url || metadata?.video_url;
                const image = metadata?.image_url || ex.image_url;
                const category = ex.muscle_group || metadata?.muscle_group;
                const exerciseType = ex.exercise_type || metadata?.exercise_type;
                const info = [ex.rest, category, exerciseType].filter(Boolean).join(" · ");

                return (
                  <ListRow
                    key={`${selectedDay}-${ex.exercise_id || ex.name}-${i}`}
                    // La miniatura es la portada del vídeo: al tocar la fila se abre la ficha, cuyo héroe es el vídeo.
                    leading={<ExerciseThumb image={usableImage(image)} video={video} name={ex.name} size="sm" />}
                    title={<span className="line-clamp-2 whitespace-normal">{ex.name}</span>}
                    subtitle={info ? <span className="block truncate">{info}</span> : undefined}
                    value={<span className="tabular-nums">{ex.series} × {ex.reps}</span>}
                    chevron
                    onClick={() =>
                      setDetail({
                        name: ex.name,
                        image,
                        video,
                        series: ex.series ? String(ex.series) : undefined,
                        reps: ex.reps ? String(ex.reps) : undefined,
                        rest: ex.rest,
                        category,
                        type: exerciseType,
                      })
                    }
                  />
                );
              })}
            </ListGroup>
          )}
        </section>
      )}

      {selectedPlan?.type === "actividad" && (
        <section aria-label={`Actividad del ${selectedDay.toLocaleLowerCase("es-ES")}`} className="space-y-6">
          <SessionHeader day={selectedDay} isToday={selectedIsToday} title={sessionTitle(selectedPlan)} />
          {onOpenWorkout && (
            <Button type="button" variant="hero" size="lg" className="w-full" onClick={() => onOpenWorkout(selectedDay)}>
              Abrir actividad del {selectedDay.toLocaleLowerCase("es-ES")}
            </Button>
          )}
          <ListGroup>
            <ListRow icon={<Flame className="text-muted-foreground" />} title="Intensidad" value={selectedPlan.intensity} />
            <ListRow icon={<Clock className="text-muted-foreground" />} title="Duración" value={selectedPlan.duration} />
          </ListGroup>
        </section>
      )}

      {!selectedPlan && (
        expandedDay ? (
          <EmptyState
            className="min-h-[50dvh]"
            icon={Moon}
            title={selectedIsToday ? "Hoy es día de descanso" : `${selectedDay} es día de descanso`}
            description="Toca otro día para ver su sesión."
            action={
              nextWorkDay ? (
                <Button
                  type="button"
                  variant="plain"
                  onClick={() => {
                    void hapticSelection();
                    setExpandedDay(nextWorkDay);
                  }}
                >
                  {`Ver el ${nextWorkDay.toLocaleLowerCase("es-ES")}`}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState className="min-h-[50dvh]" icon={CalendarDays} title="Elige un día" description="Toca un día de la semana para ver su sesión." />
        )
      )}

      <ListGroup>
        <ToolRow icon={copied ? <Check /> : <Copy />} label={copied ? "Plan copiado" : "Copiar plan"} onClick={handleCopy} />
        <ToolRow icon={<Download />} label="Descargar plan" onClick={handleDownload} />
        <CalendarExportDialog
          dayPlans={dayPlans}
          trigger={<ToolRow icon={<CalendarIcon />} label="Exportar plan al calendario" onClick={() => void hapticTap()} />}
        />
      </ListGroup>

      <AIDisclaimer variant="compact" className="px-4 text-center" />

      {/* El ejercicio a pantalla completa: nada más alrededor */}
      <ExerciseFocus
        exercise={detail ? {
          name: detail.name,
          image: usableImage(detail.image),
          video: detail.video,
          series: detail.series,
          reps: detail.reps,
          rest: detail.rest,
          muscleGroup: detail.category,
          exerciseType: detail.type,
        } : null}
        onClose={() => setDetail(null)}
      />
    </div>
  );
};

export default TrainingPlanView;
