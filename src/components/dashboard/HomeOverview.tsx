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
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const HomeOverview = ({ dayPlans, macros, meals, onNavigate, weeksActive, completedDays }: Props) => {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayName = DAYS_ORDER[todayIndex];
  const todayPlan = dayPlans.find((p) => p.day === todayName);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            ].map((s) => (
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
        className="bg-card rounded-2xl p-6 border border-border hover:border-primary/40 transition-all duration-200 text-left group cursor-pointer sm:col-span-2 lg:col-span-2"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Dumbbell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Hoy · {todayName}</p>
              <h3 className="font-display font-bold text-lg">
                {todayPlan
                  ? todayPlan.type === "gimnasio"
                    ? todayPlan.routine_name || "Entrenamiento"
                    : todayPlan.sport || "Actividad"
                  : "Día de descanso"}
              </h3>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>

        {todayPlan?.type === "gimnasio" && todayPlan.exercises && (
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

        {todayPlan?.type === "actividad" && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-primary" />{todayPlan.intensity}</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-primary" />{todayPlan.duration}</span>
          </div>
        )}

        {!todayPlan && (
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
        <h3 className="font-display font-bold text-sm mb-1">Chat con tu entrenador</h3>
        <p className="text-xs text-muted-foreground">Dudas, cambios o feedback</p>
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
        <h3 className="font-display font-bold text-sm mb-1">Tu Nutrición</h3>
        {macros ? (
          <div className="flex items-center gap-2 text-xs mt-1">
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{macros.protein}g P</span>
            <span className="bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{macros.carbs}g C</span>
            <span className="bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{macros.fats}g G</span>
            <InfoHint text="P = proteína, C = carbohidratos, G = grasas. Son los gramos objetivo de todo el día." />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin plan aún</p>
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
                onClick={() => { onNavigate("training"); }}
                className={`text-center p-2 rounded-xl transition-all hover:scale-105 ${
                  isToday ? "ring-2 ring-primary/40 bg-primary/10" : ""
                } ${plan ? "bg-secondary/50 hover:bg-secondary" : "opacity-30"}`}
              >
                <div className="text-[10px] font-bold text-muted-foreground uppercase">{day.slice(0, 2)}</div>
                <div className="text-sm mt-0.5">
                  {plan?.type === "gimnasio" ? "🏋️" : plan?.type === "actividad" ? "🏃" : "—"}
                </div>
                {plan?.type === "gimnasio" && (
                  <div className="text-[9px] text-muted-foreground truncate mt-0.5">
                    {plan.routine_name?.split(" ")[0] || ""}
                  </div>
                )}
              </button>
            );
          })}
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
