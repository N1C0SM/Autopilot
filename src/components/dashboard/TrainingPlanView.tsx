import { useState } from "react";
import { Calendar as CalendarIcon, CalendarDays, Check, ChevronRight, Clock, Copy, Download, Flame, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow } from "@/components/ui/list";
import { SectionHeader } from "@/components/ui/section-header";
import { Surface } from "@/components/ui/surface";
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

const TrainingPlanView = ({ dayPlans, onOpenWorkout }: Props) => {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayName = DAYS_ORDER[todayIndex];
  const [expandedDay, setExpandedDay] = useState<string | null>(todayName);
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

  const actionClass = "[&_svg]:size-5 sm:w-auto sm:gap-1.5 sm:px-3";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1">
        <SectionHeader
          title="Rutina semanal"
          size="md"
          className="items-center"
          action={
            <div className="-mr-3 flex items-center sm:mr-0 sm:gap-1">
              <Button variant="plain" size="icon" aria-label={copied ? "Plan copiado" : "Copiar plan"} onClick={handleCopy} className={actionClass}>
                {copied ? <Check /> : <Copy />}
                <span className="hidden type-subhead font-medium sm:inline">{copied ? "Copiado" : "Copiar"}</span>
              </Button>
              <Button variant="plain" size="icon" aria-label="Descargar plan" onClick={handleDownload} className={actionClass}>
                <Download />
                <span className="hidden type-subhead font-medium sm:inline">Descargar</span>
              </Button>
              <CalendarExportDialog
                dayPlans={dayPlans}
                trigger={
                  <Button variant="plain" size="icon" aria-label="Exportar plan al calendario" onClick={() => void hapticTap()} className={actionClass}>
                    <CalendarIcon />
                    <span className="hidden type-subhead font-medium sm:inline">Calendario</span>
                  </Button>
                }
              />
            </div>
          }
        />
        <AIDisclaimer variant="compact" />
      </div>

      <div role="group" aria-label="Días de la semana" className="grid grid-cols-7 gap-1">
        {DAYS_ORDER.map((day) => {
          const plan = workPlanFor(day);
          const isToday = day === todayName;
          const isExpanded = expandedDay === day;
          const summary = plan ? sessionTitle(plan) : "descanso";
          const tone = isExpanded
            ? "bg-primary text-primary-foreground"
            : isToday
            ? "bg-primary/15 text-primary"
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
              className={`mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-full type-subhead font-semibold transition-colors duration-100 ease-ios-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                plan ? "active:opacity-60" : "cursor-default"
              } ${tone}`}
            >
              {day.slice(0, 3)}
            </button>
          );
        })}
      </div>

      {selectedPlan?.type === "gimnasio" && (
        <section aria-label={`Sesión del ${selectedDay.toLocaleLowerCase("es-ES")}`} className="space-y-3">
          <Surface padding="none">
            <div className="px-4 pb-3 pt-4">
              <p className="type-group-header">{selectedIsToday ? `${selectedDay} · hoy` : selectedDay}</p>
              <h3 className="mt-1 type-title3">{sessionTitle(selectedPlan)}</h3>
            </div>
            {selectedPlan.exercises && selectedPlan.exercises.length > 0 && (
              <div className="sep-t">
                {selectedPlan.exercises.map((ex, i) => {
                  const metadata = exerciseMetadata.byId[ex.exercise_id] || exerciseMetadata.byName[ex.name];
                  const video = ex.video_url || metadata?.video_url;
                  const image = ex.image_url || metadata?.image_url;
                  const category = ex.muscle_group || metadata?.muscle_group;
                  const exerciseType = ex.exercise_type || metadata?.exercise_type;
                  const videoKey = `${selectedDay}-${ex.exercise_id || ex.name}-${i}`;
                  const info = [ex.rest, category, exerciseType].filter(Boolean).join(" · ");
                  const openDetail = () => {
                    void hapticTap();
                    setDetail({
                      name: ex.name,
                      image,
                      video,
                      series: ex.series ? String(ex.series) : undefined,
                      reps: ex.reps ? String(ex.reps) : undefined,
                      rest: ex.rest,
                      category,
                      type: exerciseType,
                    });
                  };

                  return (
                    <div
                      key={videoKey}
                      role="button"
                      tabIndex={0}
                      onClick={openDetail}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail();
                        }
                      }}
                      className="group/row relative flex min-h-[60px] w-full cursor-pointer items-center gap-3 pl-4 text-left transition-colors duration-100 active:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                      {/* La miniatura es la portada del vídeo (con su marca de play):
                          al tocar la fila se abre la ficha, cuyo héroe es el vídeo. */}
                      <ExerciseThumb image={image} video={video} name={ex.name} size="sm" />
                      <span className="flex min-w-0 flex-1 items-center gap-3 self-stretch py-2 pr-4 group-[:not(:last-child)]/row:sep-b">
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 type-body">{ex.name}</span>
                          {info ? <span className="mt-0.5 block truncate type-footnote text-muted-foreground">{info}</span> : null}
                        </span>
                        <span className="shrink-0 type-body tabular-nums text-muted-foreground">
                          {ex.series} × {ex.reps}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={2.5} aria-hidden="true" />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Surface>
          {onOpenWorkout && selectedPlan.exercises && selectedPlan.exercises.length > 0 && (
            <Button type="button" variant="hero" size="lg" className="w-full" onClick={() => onOpenWorkout(selectedDay)}>
              Abrir sesión del {selectedDay.toLocaleLowerCase("es-ES")}
            </Button>
          )}
        </section>
      )}

      {selectedPlan?.type === "actividad" && (
        <section aria-label={`Actividad del ${selectedDay.toLocaleLowerCase("es-ES")}`} className="space-y-3">
          <Surface padding="none">
            <div className="px-4 pb-3 pt-4">
              <p className="type-group-header">{selectedIsToday ? `${selectedDay} · hoy` : selectedDay}</p>
              <h3 className="mt-1 type-title3">{sessionTitle(selectedPlan)}</h3>
            </div>
            <div className="sep-t">
              <ListRow icon={<Flame />} title="Intensidad" value={selectedPlan.intensity} />
              <ListRow icon={<Clock />} title="Duración" value={selectedPlan.duration} />
            </div>
          </Surface>
          {onOpenWorkout && (
            <Button type="button" variant="tinted" size="lg" className="w-full" onClick={() => onOpenWorkout(selectedDay)}>
              Abrir actividad del {selectedDay.toLocaleLowerCase("es-ES")}
            </Button>
          )}
        </section>
      )}

      {!selectedPlan && (
        expandedDay ? (
          <EmptyState icon={Moon} title={selectedIsToday ? "Hoy es día de descanso" : `${selectedDay} es día de descanso`} description="Toca otro día para ver su sesión." />
        ) : (
          <EmptyState icon={CalendarDays} title="Elige un día" description="Toca un día de la semana para ver su sesión." />
        )
      )}

      {/* El ejercicio a pantalla completa: nada más alrededor */}
      <ExerciseFocus
        exercise={detail ? {
          name: detail.name,
          image: detail.image,
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
