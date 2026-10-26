import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type ReactNode, type SyntheticEvent } from "react";
import { Calendar as CalendarIcon, CalendarDays, Check, Clock, Copy, Download, Flame, Moon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { cn } from "@/shared/lib/utils";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { toast } from "sonner";
import type { DayPlan } from "@/shared/types/training";
import { formatTrainingTitle } from "@/shared/lib/trainingDisplay";
import CalendarExportDialog from "@/app/components/dashboard/CalendarExportDialog";
import AIDisclaimer from "@/shared/components/AIDisclaimer";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import ExerciseFocus from "@/app/components/ExerciseFocus";
import { useExerciseMetadata } from "@/shared/hooks/useExerciseMetadata";
import { useSessionCover } from "@/shared/hooks/useSessionCover";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";

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

/** Solo los días con sesión existen en la vista: un día sin plan nunca es una pantalla. */
const hasSessionIn = (plans: DayPlan[], day?: string | null) =>
  Boolean(day) && plans.some((p) => p.day === day && (p.type === "gimnasio" || p.type === "actividad"));

/** Siguiente día con sesión después de `from`, dando la vuelta a la semana. */
const nextSessionIn = (plans: DayPlan[], from: string): string | null => {
  const start = DAYS_ORDER.indexOf(from);
  if (start < 0) return null;
  for (let i = 1; i <= DAYS_ORDER.length; i += 1) {
    const day = DAYS_ORDER[(start + i) % DAYS_ORDER.length];
    if (hasSessionIn(plans, day)) return day;
  }
  return null;
};

/** Día que se abre siempre: el pedido si tiene sesión; si no, hoy; si no, la siguiente sesión. */
const openDayFor = (plans: DayPlan[], preferred: string | undefined, today: string): string | null => {
  if (hasSessionIn(plans, preferred)) return preferred!;
  if (hasSessionIn(plans, today)) return today;
  return nextSessionIn(plans, today);
};

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
  // Nunca se abre un día sin sesión: el pedido, si no hoy, si no el siguiente que entrene.
  const [expandedDay, setExpandedDay] = useState<string | null>(() => openDayFor(dayPlans, initialDay, todayName));
  // La vista no se desmonta al cambiar de pestaña: sincroniza cada día pedido desde «Hoy».
  useEffect(() => {
    if (hasSessionIn(dayPlans, initialDay)) setExpandedDay(initialDay!);
  }, [dayPlans, initialDay]);
  // El plan puede llegar después de montar: si el día abierto no tiene sesión, se abre el que toca.
  useEffect(() => {
    setExpandedDay((current) => (hasSessionIn(dayPlans, current) ? current : openDayFor(dayPlans, initialDay, todayName)));
  }, [dayPlans, initialDay, todayName]);
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

  // Cualquier día se puede abrir: los que tienen sesión muestran su entreno y los
  // que no, la tarjeta de descanso. La vista nunca se abre sola en un día de descanso.
  const workPlanFor = (day: string) => {
    const plan = dayPlans.find((p) => p.day === day);
    return plan?.type === "gimnasio" || plan?.type === "actividad" ? plan : undefined;
  };
  const selectedPlan = expandedDay ? workPlanFor(expandedDay) : undefined;
  const selectedDay = expandedDay ?? "";
  const selectedIsToday = selectedDay === todayName;
  const hasExercises = Boolean(selectedPlan?.exercises && selectedPlan.exercises.length > 0);
  // Siguiente día con sesión desde el día abierto: la tarjeta de descanso ofrece ir.
  const nextWorkDay = expandedDay
    ? DAYS_ORDER.map((_, i) => DAYS_ORDER[(DAYS_ORDER.indexOf(expandedDay) + 1 + i) % DAYS_ORDER.length]).find((day) => workPlanFor(day))
    : undefined;

  // Foto de la sesión igual que en «Hoy»: portada IA por ejercicios, imagen del primer
  // ejercicio y, si no hay, foto de marca. El descanso tiene su propia tarjeta de noche.
  const coverExercises = selectedPlan?.type === "gimnasio" ? selectedPlan.exercises ?? [] : [];
  const firstCoverExercise = coverExercises[0];
  const coverFallback = firstCoverExercise
    ? (exerciseMetadata.byId[firstCoverExercise.exercise_id] || exerciseMetadata.byName[firstCoverExercise.name])?.image_url
      || firstCoverExercise.image_url
      || BRAND_PHOTOS.gym
    : null;
  const sessionCover = useSessionCover(coverExercises.map((exercise) => exercise.exercise_id), coverFallback);
  const dayPhoto = selectedPlan?.type === "gimnasio" ? sessionCover || BRAND_PHOTOS.gym : null;

  return (
    <div className="flex w-full flex-col gap-6" onErrorCapture={handleImageError}>
      <h2 className="sr-only">Rutina semanal</h2>

      <div
        role="group"
        aria-label="Días de la semana"
        className="flex justify-between gap-1 overflow-x-auto rounded-2xl bg-card p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              aria-expanded={isExpanded}
              onClick={() => {
                void hapticSelection();
                setExpandedDay(day);
              }}
              className={`flex h-11 w-11 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-full type-subhead lg:text-[16px] font-semibold transition-colors duration-150 ease-out active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tone}`}
            >
              {day.slice(0, 3)}
            </button>
          );
        })}
      </div>

      {selectedPlan?.type === "gimnasio" && (
        <section aria-label={`Sesión del ${selectedDay.toLocaleLowerCase("es-ES")}`} className="space-y-6">
          {dayPhoto && (
            <div aria-hidden="true" className="relative h-44 overflow-hidden rounded-[28px] bg-card">
              <img key={dayPhoto} src={dayPhoto} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
          )}
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
            rest
            icon={Moon}
            title={selectedIsToday ? "Hoy es día de descanso" : `${selectedDay} es día de descanso`}
            description={nextWorkDay ? `Tu próxima sesión es el ${nextWorkDay.toLocaleLowerCase("es-ES")}.` : "Recupera y vuelve con más fuerza."}
            action={nextWorkDay ? (
              <Button type="button" variant="secondary" size="lg" onClick={() => { void hapticSelection(); setExpandedDay(nextWorkDay); }}>
                {`Ver el ${nextWorkDay.toLocaleLowerCase("es-ES")}`}
              </Button>
            ) : undefined}
          />
        ) : (
          <EmptyState
            card
            icon={CalendarDays}
            title="Tu plan aún no tiene sesiones"
            description="Edita tu rutina para añadir los días de la semana que quieras entrenar."
          />
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
