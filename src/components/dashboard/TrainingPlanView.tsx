import { useState } from "react";
import { motion } from "framer-motion";
import { Dumbbell, Flame, Clock, Download, Copy, Check, ChevronDown, ChevronUp, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const TrainingPlanView = ({ dayPlans, onOpenWorkout }: Props) => {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const [expandedDay, setExpandedDay] = useState<string | null>(DAYS_ORDER[todayIndex]);
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
    await navigator.clipboard.writeText(planToText(dayPlans));
    setCopied(true);
    toast.success("Plan copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([planToText(dayPlans)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mi-plan-entrenamiento.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Plan descargado");
  };

  // Días consecutivos sin entrenamiento se muestran en una sola fila.
  const dayRows: { days: string[]; plan?: DayPlan }[] = [];
  for (const day of DAYS_ORDER) {
    const plan = dayPlans.find((p) => p.day === day);
    const isWork = plan?.type === "gimnasio" || plan?.type === "actividad";
    if (!isWork) {
      const prev = dayRows[dayRows.length - 1];
      if (prev && !prev.plan) {
        prev.days.push(day);
        continue;
      }
      dayRows.push({ days: [day] });
    } else {
      dayRows.push({ days: [day], plan });
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4 px-1 sm:px-0">
      {/* Header + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Dumbbell className="w-5 h-5 text-primary shrink-0" />
          <h2 className="text-lg sm:text-xl font-bold font-display truncate">Rutina semanal</h2>
        </div>
        <div className="flex gap-1.5 sm:gap-2 shrink-0">
          <Button variant="outline" size="sm" aria-label={copied ? "Plan copiado" : "Copiar plan"} onClick={handleCopy} className="h-11 px-2 sm:px-3">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline ml-1">{copied ? "Copiado" : "Copiar"}</span>
          </Button>
          <Button variant="outline" size="sm" aria-label="Descargar plan" onClick={handleDownload} className="h-11 px-2 sm:px-3">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Descargar</span>
          </Button>
          <CalendarExportDialog
            dayPlans={dayPlans}
            trigger={
              <Button variant="outline" size="sm" aria-label="Exportar plan al calendario" className="h-11 px-2 sm:px-3">
                <CalendarIcon className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Calendario</span>
              </Button>
            }
          />
        </div>
      </div>

      <AIDisclaimer variant="compact" />

      {/* Days. Los descansos consecutivos se agrupan en una sola fila: cuatro
          tarjetas casi vacías ocupaban media pantalla sin aportar nada. */}
      {dayRows.map((row) => {
        const day = row.days[0];
        const plan = row.plan;
        const isToday = row.days.includes(DAYS_ORDER[todayIndex]);
        const isExpanded = expandedDay === day;
        const dayLabel = row.days.length > 1 ? `${day} a ${row.days[row.days.length - 1]}` : day;

        return (
          <motion.div
            key={day}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-card rounded-xl border overflow-hidden transition-colors ${
              isToday ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
            }`}
          >
            <button
              type="button"
              aria-expanded={plan ? isExpanded : undefined}
              onClick={() => { if (plan) setExpandedDay(isExpanded ? null : day); }}
              disabled={!plan}
              className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${plan ? "hover:bg-secondary/20" : "cursor-default"}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                plan ? "bg-primary/15" : "bg-secondary/50"
              }`}>
                {plan?.type === "gimnasio" ? (
                  <Dumbbell className="w-4 h-4 text-primary" />
                ) : plan?.type === "actividad" ? (
                  <Flame className="w-4 h-4 text-primary" />
                ) : (
                  <span className="text-sm">😴</span>
                )}
              </div>

              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-bold text-sm ${isToday ? "text-primary" : ""}`}>
                    {dayLabel}
                  </span>
                  {isToday && (
                    <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                      HOY
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground line-clamp-1 block">
                  {plan?.type === "gimnasio"
                    ? formatTrainingTitle(plan.routine_name, plan.muscle_focus) || "Entrenamiento"
                    : plan?.type === "actividad"
                    ? plan.sport
                    : "Descanso"}
                </span>
              </div>

              {plan && (
                isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )
              )}
            </button>

            {isExpanded && plan?.type === "gimnasio" && plan.exercises && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2"
              >
                {plan.exercises.map((ex, i) => {
                  const metadata = exerciseMetadata.byId[ex.exercise_id] || exerciseMetadata.byName[ex.name];
                  const video = ex.video_url || metadata?.video_url;
                  const image = ex.image_url || metadata?.image_url;
                  const category = ex.muscle_group || metadata?.muscle_group;
                  const exerciseType = ex.exercise_type || metadata?.exercise_type;
                  const videoKey = `${day}-${ex.exercise_id || ex.name}-${i}`;

                  return (
                    <div
                      key={videoKey}
                      role="button"
                      tabIndex={0}
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
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
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
                        }
                      }}
                      className="rounded-lg bg-secondary/20 p-2 cursor-pointer transition-colors hover:bg-secondary/30 active:bg-secondary/40"
                    >
                      <div className="flex items-center gap-3">
                        {/* La miniatura es la portada del vídeo (con su marca de play):
                            al tocar la fila se abre la ficha, cuyo héroe es el vídeo. */}
                        <ExerciseThumb image={image} video={video} name={ex.name} />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium">{ex.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {ex.series} × {ex.reps} · {ex.rest}
                            {category ? ` · ${category}` : ""}
                            {exerciseType ? ` · ${exerciseType}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {onOpenWorkout && plan.exercises.length > 0 && (
                  <Button type="button" variant="hero" className="mt-2 h-11 w-full" onClick={() => onOpenWorkout(day)}>
                    Abrir sesión del {day.toLocaleLowerCase("es-ES")}
                  </Button>
                )}
              </motion.div>
            )}

            {isExpanded && plan?.type === "actividad" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="px-3 sm:px-4 pb-3 sm:pb-4"
              >
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5 bg-secondary/40 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full">
                    <Flame className="w-3.5 h-3.5 text-primary" />{plan.intensity}
                  </span>
                  <span className="flex items-center gap-1.5 bg-secondary/40 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full">
                    <Clock className="w-3.5 h-3.5 text-primary" />{plan.duration}
                  </span>
                </div>
                {onOpenWorkout && (
                  <Button type="button" variant="outline" className="mt-3 h-11 w-full" onClick={() => onOpenWorkout(day)}>
                    Abrir actividad del {day.toLocaleLowerCase("es-ES")}
                  </Button>
                )}
              </motion.div>
            )}
          </motion.div>
        );
      })}

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
