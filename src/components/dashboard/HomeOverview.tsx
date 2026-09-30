import { useState } from "react";
import { motion } from "framer-motion";
import { Dumbbell, Apple, MessageCircle, ArrowRight, Flame, Clock, Calendar } from "lucide-react";
import type { DayPlan } from "@/types/training";
import type { UserSection } from "@/components/UserSidebar";
import InfoHint from "@/components/InfoHint";

interface Macros {
  protein: number;
  carbs: number;
  fats: number;
}

interface Meal {
  name: string;
  description: string;
}

interface Props {
  dayPlans: DayPlan[];
  macros: Macros | null;
  meals: Meal[];
  onNavigate: (s: UserSection) => void;
  weeksActive?: number;
  completedDays?: number;
  completedToday?: boolean;
  coaching?: boolean;
  nutrition?: boolean;
  planStatus?: string;
  tier?: string;
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const TIER_LABEL: Record<string, string> = {
  free: "Plan Gratis",
  training: "Plan Entrenamiento",
  full: "Plan Completo",
};

const HomeOverview = ({ dayPlans, macros, meals, onNavigate, weeksActive, completedDays, completedToday = false, coaching = true, nutrition = true, planStatus, tier }: Props) => {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayName = DAYS_ORDER[todayIndex];
  const todayPlan = dayPlans.find((p) => p.day === todayName);
  const [selectedWeekDay, setSelectedWeekDay] = useState(todayName);
  const selectedWeekPlan = dayPlans.find((p) => p.day === selectedWeekDay);
  const planReady = planStatus === "plan_ready" && dayPlans.length > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Estado del plan de un vistazo */}
      {planStatus && (
        <div className={`sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${planReady ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/40"}`}>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${planReady ? "bg-primary" : "bg-muted-foreground"}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {planReady ? "Tu plan está listo" : "Tu entrenador está preparando tu plan"}
            </p>
            <p className="text-xs text-muted-foreground">
              {planReady
                ? `${TIER_LABEL[tier || ""] || "Tu plan"} · ${dayPlans.length} días de entrenamiento${nutrition ? " · nutrición incluida" : ""}${weeksActive ? ` · semana ${weeksActive + 1}` : ""}`
                : "Te avisaremos en cuanto esté. No tienes que hacer nada."}
            </p>
          </div>
          {planReady && (
            <button onClick={() => onNavigate("training")} className="shrink-0 text-xs font-semibold text-primary hover:underline">
              Ver mi plan
            </button>
          )}
        </div>
      )}


      {/* Primeros pasos — solo hasta que complete su primer día */}
      {(completedDays ?? 0) === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sm:col-span-2 lg:col-span-3 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-2xl p-5"
        >
          <h3 className="font-display font-bold text-sm mb-1">Primeros pasos</h3>
          <p className="text-xs text-muted-foreground mb-3">Haz esto hoy y ya estás dentro. Te lleva 3 minutos.</p>
          <ol className="space-y-2">
            {[
              { n: 1, text: "Abre tu entrenamiento de hoy y marca las series al terminarlas", to: "training" as UserSection, cta: "Ver entrenamiento" },
              { n: 2, text: "Revisa tus macros y comidas del día", to: "nutrition" as UserSection, cta: "Ver nutrición" },
              { n: 3, text: "Saluda a tu entrenador y cuéntale tu objetivo", to: "chat" as UserSection, cta: "Abrir chat" },
            ].filter(s => s.to === "training" || (s.to === "nutrition" ? nutrition : coaching)).map((s) => (
              <li key={s.n} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                  {s.n}
                </span>
                <span className="text-xs text-foreground/90 flex-1">{s.text}</span>
                <button
                  onClick={() => onNavigate(s.to)}
                  className="text-xs font-medium text-primary hover:underline shrink-0"
                >
                  {s.cta}
                </button>
              </li>
            ))}
          </ol>
        </motion.div>
      )}

      {/* Today's Training — Full width featured card */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onClick={() => onNavigate("training")}
        disabled={completedToday}
        className="bg-card rounded-2xl p-6 border border-border hover:border-primary/40 disabled:cursor-default disabled:hover:border-border transition-all duration-200 text-left group cursor-pointer sm:col-span-2 lg:col-span-2"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Dumbbell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Hoy · {todayName}{completedToday ? " · COMPLETADO" : ""}
              </p>
              <h3 className="font-display font-bold text-lg">
                {completedToday
                  ? "Sesión completada"
                  : todayPlan
                  ? todayPlan.type === "gimnasio"
                    ? todayPlan.routine_name || "Entrenamiento"
                    : todayPlan.sport || "Actividad"
                  : "Día de descanso"}
              </h3>
              {completedToday && (
                <p className="mt-1 text-sm text-muted-foreground">Ya has hecho lo previsto para hoy. Descansa y vuelve mañana.</p>
              )}
            </div>
          </div>
          {!completedToday && (
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          )}
        </div>

        {!completedToday && todayPlan?.type === "gimnasio" && todayPlan.exercises && (
          <div className="space-y-1.5">
            {todayPlan.exercises.slice(0, 4).map((ex, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-1 h-1 bg-primary rounded-full shrink-0" />
                <span className="truncate">{ex.name}</span>
                <span className="text-xs opacity-60 shrink-0">{ex.series}×{ex.reps}</span>
              </div>
            ))}
            {todayPlan.exercises.length > 4 && (
              <p className="text-xs text-primary font-medium">+{todayPlan.exercises.length - 4} más</p>
            )}
            {todayPlan.muscle_focus && (
              <p className="text-xs text-primary/80 mt-2">💪 {todayPlan.muscle_focus}</p>
            )}
          </div>
        )}

        {!completedToday && todayPlan?.type === "actividad" && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-primary" />{todayPlan.intensity}</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-primary" />{todayPlan.duration}</span>
          </div>
        )}

        {!completedToday && !todayPlan && (
          <p className="text-sm text-muted-foreground">Recupera y descansa. Mañana vuelves. 😴</p>
        )}
      </motion.button>

      {/* Chat shortcut */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onClick={() => onNavigate("chat")}
        className="bg-card rounded-2xl p-5 border border-border hover:border-primary/40 transition-all duration-200 text-left group cursor-pointer"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <h3 className="font-display font-bold text-sm mb-1">{coaching ? "Chat con tu entrenador" : "Añadir un entrenador"}</h3>
        <p className="text-xs text-muted-foreground">{coaching ? "Dudas, cambios o feedback" : "Seguimiento opcional desde 29€/mes"}</p>
      </motion.button>

      {/* Nutrition Card */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={() => onNavigate("nutrition")}
        className="bg-card rounded-2xl p-5 border border-border hover:border-primary/40 transition-all duration-200 text-left group cursor-pointer"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Apple className="w-5 h-5 text-primary" />
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <h3 className="font-display font-bold text-sm mb-1">{nutrition ? "Tu nutrición" : "Nutrición con Completo"}</h3>
        {macros ? (
          <div className="flex items-center gap-2 text-xs mt-1">
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{macros.protein}g P</span>
            <span className="bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{macros.carbs}g C</span>
            <span className="bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{macros.fats}g G</span>
            <InfoHint text="P = proteína, C = carbohidratos, G = grasas. Son los gramos objetivo de todo el día." />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{nutrition ? "Sin plan aún" : "Opcional · incluida en Completo"}</p>
        )}
      </motion.button>

      {/* Weekly Overview */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card rounded-2xl p-5 border border-border sm:col-span-2 lg:col-span-2"
      >
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-sm">Tu semana</h3>
          <InfoHint text="🏋️ día de gimnasio · 🏃 actividad · — descanso. Toca un día para ver sus ejercicios." />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS_ORDER.map((day) => {
            const plan = dayPlans.find((p) => p.day === day);
            const isToday = day === todayName;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedWeekDay(day)}
                aria-pressed={selectedWeekDay === day}
                aria-label={`${day}${isToday ? ", hoy" : ""}: ${plan?.routine_name || plan?.sport || (plan ? "Actividad" : "Descanso")}`}
                className={`min-w-0 rounded-xl p-2 text-center transition-colors ${
                  selectedWeekDay === day
                    ? "bg-primary/10 ring-2 ring-primary/50"
                    : "bg-secondary/50 hover:bg-secondary"
                } ${isToday ? "ring-offset-1 ring-offset-background" : ""}`}
              >
                <div className="text-[10px] font-bold text-muted-foreground uppercase">{day.slice(0, 2)}</div>
                <div className="text-sm mt-0.5">
                  {plan?.type === "gimnasio" ? "🏋️" : plan?.type === "actividad" ? "🏃" : "—"}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 rounded-xl border border-border/70 bg-background/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {selectedWeekDay === todayName ? "Hoy" : selectedWeekDay}
              </p>
              <p className="truncate text-sm font-semibold">
                {selectedWeekPlan?.type === "gimnasio"
                  ? selectedWeekPlan.routine_name || "Entrenamiento"
                  : selectedWeekPlan?.type === "actividad"
                    ? selectedWeekPlan.sport || "Actividad"
                    : "Día de descanso"}
              </p>
            </div>
            {selectedWeekPlan?.muscle_focus && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                {selectedWeekPlan.muscle_focus}
              </span>
            )}
          </div>
          {selectedWeekPlan?.type === "gimnasio" && selectedWeekPlan.exercises?.length ? (
            <div className="space-y-1.5">
              {selectedWeekPlan.exercises.map((exercise, index) => (
                <div key={`${exercise.name}-${index}`} className="flex min-w-0 items-center gap-2 text-xs">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0 flex-1 truncate text-foreground/90">{exercise.name}</span>
                  <span className="shrink-0 text-muted-foreground">{exercise.series} × {exercise.reps}</span>
                </div>
              ))}
            </div>
          ) : selectedWeekPlan?.type === "actividad" ? (
            <p className="text-xs text-muted-foreground">
              {selectedWeekPlan.intensity} · {selectedWeekPlan.duration}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">El entrenador no ha programado una sesión para este día.</p>
          )}
        </div>
      </motion.div>
      {/* Progress stats */}
      {(weeksActive !== undefined || completedDays !== undefined) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card rounded-2xl p-5 border border-border"
        >
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-display font-bold text-sm">Tu progreso</h3>
            <InfoHint text="Un día cuenta como completado cuando marcas todos sus ejercicios en Entrenamiento." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold font-display text-primary">{weeksActive ?? 0}</div>
              <div className="text-xs text-muted-foreground">Semanas activo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-display text-primary">{completedDays ?? 0}</div>
              <div className="text-xs text-muted-foreground">Días completados</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default HomeOverview;
