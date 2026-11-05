import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type ReactNode, type SyntheticEvent } from "react";
import { Calendar as CalendarIcon, CalendarDays, Check, ChevronRight, Clock, Copy, Download, Flame, Moon } from "lucide-react";
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
import { cachedSessionCover, useSessionCover } from "@/shared/hooks/useSessionCover";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
/** Inicial de cada día en el selector (X es miércoles, como en el calendario español). */
const DAY_INITIALS = ["L", "M", "X", "J", "V", "S", "D"];

interface Props {
  dayPlans: DayPlan[];
  /** Día que debe abrirse al entrar (pulsado en la tira de «Hoy»). */
  initialDay?: string;
  onOpenWorkout?: (day: string) => void;
  /** Tarjeta de la rutina (modo del plan, Libre, Editar, Ejercicios): va bajo la lista de días. */
  tools?: ReactNode;
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

/** Detalle corto de la fila: series y ejercicios del gimnasio, intensidad y duración de la actividad. */
const dayMeta = (plan?: DayPlan) => {
  if (!plan) return "Recuperación";
  if (plan.type === "gimnasio") return sessionSummary(plan) || "Sin ejercicios todavía";
  return [plan.intensity ? `Intensidad ${plan.intensity.toLocaleLowerCase("es-ES")}` : null, plan.duration].filter(Boolean).join(" · ") || "Actividad";
};

interface DayRowProps {
  day: string;
  plan?: DayPlan;
  isToday: boolean;
  expanded: boolean;
  /** Foto de respaldo (caché de la portada, foto del primer ejercicio o foto de marca). */
  photo: string | null;
  onSelect: () => void;
}

// Fila del plan semanal (maqueta de ChatGPT): foto, día, sesión y detalle, con chevron.
// Solo la fila abierta pide la portada con IA; las demás usan la caché o su respaldo.
const DayRow = ({ day, plan, isToday, expanded, photo, onSelect }: DayRowProps) => {
  const gym = plan?.type === "gimnasio";
  const ids = gym && expanded ? (plan.exercises ?? []).map((exercise) => exercise.exercise_id) : [];
  const cover = useSessionCover(ids, photo);
  const title = plan ? sessionTitle(plan) : "Descanso";
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={`${day.toLocaleLowerCase("es-ES")}: ${title}`}
      onClick={onSelect}
      className={cn(
        "flex min-h-[88px] w-full items-center gap-3.5 rounded-[22px] border bg-card p-3 pr-4 text-left transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        expanded ? "border-primary/60" : "border-border",
      )}
    >
      {gym ? (
        <span aria-hidden className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-secondary">
          {cover && <img src={cover} alt="" decoding="async" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />}
        </span>
      ) : (
        <span aria-hidden className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-secondary", plan ? "text-primary" : "text-muted-foreground")}>
          {plan ? <Flame className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block type-footnote font-medium", isToday ? "text-primary" : "text-muted-foreground")}>{isToday ? `${day} · Hoy` : day}</span>
        <h3 className="mt-0.5 line-clamp-2 type-headline">{title}</h3>
        <span className="mt-0.5 block truncate type-footnote tabular-nums text-muted-foreground">{dayMeta(plan)}</span>
      </span>
      <ChevronRight
        aria-hidden
        className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150", expanded && "rotate-90 text-primary")}
        strokeWidth={2.5}
      />
    </button>
  );
};

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

const TrainingPlanView = ({ dayPlans, initialDay, onOpenWorkout, tools }: Props) => {
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
    pattern?: string | null;
    stimulus?: string | null;
    load?: string | null;
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

  // Respaldo de la foto de cada fila: la portada ya generada (caché), la foto del primer
  // ejercicio y, si no hay, la foto de marca. Nunca se pide una portada nueva por fila cerrada.
  const rowPhoto = (plan?: DayPlan) => {
    if (plan?.type !== "gimnasio") return null;
    const exercises = plan.exercises ?? [];
    const first = exercises[0];
    const image = first ? (exerciseMetadata.byId[first.exercise_id] || exerciseMetadata.byName[first.name])?.image_url || first.image_url : null;
    return cachedSessionCover(exercises.map((exercise) => exercise.exercise_id)) || usableImage(image) || BRAND_PHOTOS.gym;
  };
  const hasAnySession = DAYS_ORDER.some((day) => workPlanFor(day));

  // Lo que se abre bajo la fila elegida: empezar la sesión y sus ejercicios, la actividad o el descanso.
  const renderDetail = () => {
    if (selectedPlan?.type === "gimnasio") {
      return (
        <section aria-label={`Sesión del ${selectedDay.toLocaleLowerCase("es-ES")}`} className="space-y-3">
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
                const pattern = metadata?.movement_pattern ?? null;
                const stimulus = metadata?.stimulus_type ?? null;
                const load = metadata?.load_level ?? null;
                const info = [ex.rest, category, exerciseType].filter(Boolean).join(" · ");

                return (
                  <ListRow
                    key={`${selectedDay}-${ex.exercise_id || ex.name}-${i}`}
                    // La miniatura es la portada del vídeo: al tocar la fila se abre la ficha, cuyo héroe es el vídeo.
                    leading={<ExerciseThumb image={usableImage(image)} video={video} name={ex.name} pattern={pattern} stimulus={stimulus} load={load} size="sm" />}
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
                        pattern,
                        stimulus,
                        load,
                      })
                    }
                  />
                );
              })}
            </ListGroup>
          )}
          {!hasExercises && <p className="px-1 type-subhead text-muted-foreground">Este día no tiene ejercicios asignados todavía.</p>}
        </section>
      );
    }
    if (selectedPlan?.type === "actividad") {
      return (
        <section aria-label={`Actividad del ${selectedDay.toLocaleLowerCase("es-ES")}`} className="space-y-3">
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
      );
    }
    return (
      <div className="flex flex-col gap-3 px-1">
        <div>
          <p className="type-headline">{selectedIsToday ? "Hoy es día de descanso" : `${selectedDay} es día de descanso`}</p>
          <p className="mt-0.5 type-subhead text-muted-foreground">
            {nextWorkDay ? `Tu próxima sesión es el ${nextWorkDay.toLocaleLowerCase("es-ES")}.` : "Recupera y vuelve con más fuerza."}
          </p>
        </div>
        {nextWorkDay && (
          <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => { void hapticSelection(); setExpandedDay(nextWorkDay); }}>
            {`Ver el ${nextWorkDay.toLocaleLowerCase("es-ES")}`}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="flex w-full flex-col gap-5" onErrorCapture={handleImageError}>
      <h2 className="sr-only">Plan semanal</h2>
      {/* En el móvil, bajo el título grande «Plan semanal»; en escritorio la barra ya lleva su pista. */}
      <p className="-mt-1 type-subhead text-muted-foreground md:hidden">Tu rutina de entrenamiento, día a día.</p>

      <div
        role="group"
        aria-label="Días de la semana"
        className="flex justify-between gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {DAYS_ORDER.map((day, index) => {
          const plan = workPlanFor(day);
          const isToday = day === todayName;
          const isExpanded = expandedDay === day;
          const summary = plan ? sessionTitle(plan) : "descanso";
          // El día elegido va en dorado macizo y hoy con anillo dorado (selector de días del rediseño).
          const tone = isExpanded
            ? "bg-primary text-primary-foreground"
            : isToday
            ? "border border-primary/60 text-primary"
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
              {DAY_INITIALS[index]}
            </button>
          );
        })}
      </div>

      {hasAnySession ? (
        // La semana entera en filas, como la maqueta: el día elegido se abre debajo de su fila.
        <ul data-week-list className="space-y-3">
          {DAYS_ORDER.map((day) => {
            const plan = workPlanFor(day);
            const expanded = expandedDay === day;
            return (
              <li key={day} className="space-y-3">
                <DayRow
                  day={day}
                  plan={plan}
                  isToday={day === todayName}
                  expanded={expanded}
                  photo={rowPhoto(plan)}
                  onSelect={() => {
                    void hapticSelection();
                    setExpandedDay(day);
                  }}
                />
                {expanded && renderDetail()}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          card
          icon={CalendarDays}
          title="Tu plan aún no tiene sesiones"
          description="Edita tu rutina para añadir los días de la semana que quieras entrenar."
        />
      )}

      {tools}

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
          pattern: detail.pattern,
          stimulus: detail.stimulus,
          load: detail.load,
        } : null}
        onClose={() => setDetail(null)}
      />
    </div>
  );
};

export default TrainingPlanView;
