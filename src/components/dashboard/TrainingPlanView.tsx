import { useState } from "react";
import { motion } from "framer-motion";
import { Dumbbell, Flame, Clock, Download, Copy, Check, ChevronDown, ChevronUp, Calendar as CalendarIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import type { DayPlan } from "@/types/training";
import CalendarExportDialog from "./CalendarExportDialog";
import AIDisclaimer from "@/components/AIDisclaimer";
import VideoEmbed from "@/components/VideoEmbed";
import { exerciseVideoSearchUrl } from "@/lib/exerciseVideo";
import { useExerciseMetadata } from "@/hooks/useExerciseMetadata";

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

interface Props {
  dayPlans: DayPlan[];
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

const TrainingPlanView = ({ dayPlans }: Props) => {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const [expandedDay, setExpandedDay] = useState<string | null>(DAYS_ORDER[todayIndex]);
  const [copied, setCopied] = useState(false);
  const [expandedVideos, setExpandedVideos] = useState<Record<string, boolean>>({});
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

  return (
    <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4 px-1 sm:px-0">
      {/* Header + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Dumbbell className="w-5 h-5 text-primary shrink-0" />
          <h2 className="text-lg sm:text-xl font-bold font-display truncate">Tu Plan</h2>
        </div>
        <div className="flex gap-1.5 sm:gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 px-2 sm:px-3">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline ml-1">{copied ? "Copiado" : "Copiar"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 px-2 sm:px-3">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Descargar</span>
          </Button>
          <CalendarExportDialog
            dayPlans={dayPlans}
            trigger={
              <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                <CalendarIcon className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Calendario</span>
              </Button>
            }
          />
        </div>
      </div>

      <AIDisclaimer />

      {/* Days */}
      {DAYS_ORDER.map((day) => {
        const plan = dayPlans.find((p) => p.day === day);
        const isToday = day === DAYS_ORDER[todayIndex];
        const isExpanded = expandedDay === day;

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
              onClick={() => setExpandedDay(isExpanded ? null : day)}
              className="w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 hover:bg-secondary/20 transition-colors"
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 ${
                plan ? "bg-primary/15" : "bg-secondary/50"
              }`}>
                {plan?.type === "gimnasio" ? (
                  <Dumbbell className="w-4 h-4 text-primary" />
                ) : plan?.type === "actividad" ? (
                  <Flame className="w-4 h-4 text-primary" />
                ) : (
                  <span className="text-xs sm:text-sm">😴</span>
                )}
              </div>

              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className={`font-bold text-[13px] sm:text-sm ${isToday ? "text-primary" : ""}`}>
                    {day}
                  </span>
                  {isToday && (
                    <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      HOY
                    </span>
                  )}
                </div>
                <span className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 block">
                  {plan?.type === "gimnasio"
                    ? `${plan.routine_name} · ${plan.muscle_focus}`
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
                  const isVideoOpen = expandedVideos[videoKey] ?? false;

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
                      className="rounded-lg bg-secondary/20 p-2.5 sm:p-3 cursor-pointer transition-colors hover:bg-secondary/30 active:bg-secondary/40"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        {image ? (
                          <img src={image} alt={ex.name} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-b from-secondary/70 to-secondary/30 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[13px] sm:text-sm truncate">{ex.name}</p>
                          <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                            {ex.series} series × {ex.reps} reps · {ex.rest}
                          </p>
                        </div>
                        {video ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedVideos((current) => ({ ...current, [videoKey]: !isVideoOpen }));
                            }}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/15"
                          >
                            <Video className="h-3.5 w-3.5" />
                            {isVideoOpen ? "Ocultar" : "Vídeo"}
                          </button>
                        ) : (
                          <a
                            href={exerciseVideoSearchUrl(ex.name, category)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/15"
                          >
                            <Video className="h-3.5 w-3.5" />
                            Ver vídeo
                          </a>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1 pl-12">
                        {category ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {category}
                          </span>
                        ) : (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                            Sin categoría
                          </span>
                        )}
                        {exerciseType && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                            {exerciseType}
                          </span>
                        )}
                      </div>
                      {video && isVideoOpen && (
                        <div className="mt-3">
                          <VideoEmbed url={video} />
                        </div>
                      )}
                    </div>
                  );
                })}
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
              </motion.div>
            )}
          </motion.div>
        );
      })}

      {/* Ficha de técnica del ejercicio */}
      <Sheet open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl p-0">
          <div className="aspect-[4/3] w-full bg-gradient-to-b from-secondary/70 to-secondary/30 overflow-hidden">
            {detail?.image && (
              <img src={detail.image} alt={detail.name} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="p-4 pb-8 space-y-4">
            <SheetHeader className="p-0 space-y-0 text-left">
              <SheetTitle className="font-display text-xl font-bold">{detail?.name}</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-secondary/40 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Series</p>
                <p className="font-bold text-lg font-display">{detail?.series ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reps</p>
                <p className="font-bold text-lg font-display">{detail?.reps ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Descanso</p>
                <p className="font-bold text-sm font-display mt-1.5">{detail?.rest ?? "—"}</p>
              </div>
            </div>
            {(detail?.category || detail?.type) && (
              <div className="flex flex-wrap gap-1.5">
                {detail?.category && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {detail.category}
                  </span>
                )}
                {detail?.type && (
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                    {detail.type}
                  </span>
                )}
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Técnica</p>
              {detail?.video ? (
                <VideoEmbed url={detail.video} />
              ) : (
                <a
                  href={exerciseVideoSearchUrl(detail?.name ?? "", detail?.category ?? undefined)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/15"
                >
                  <Video className="h-4 w-4" />
                  Buscar vídeo de la técnica
                </a>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TrainingPlanView;
