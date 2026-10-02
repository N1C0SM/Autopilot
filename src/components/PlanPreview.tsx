import { motion } from "framer-motion";
import { Dumbbell, Utensils, Lock, Sparkles, Flame } from "lucide-react";
import { resolveNutritionPreview } from "@/lib/nutrition";

interface Props {
  focus?: string; // gimnasio | calistenia | mixto
  goal?: string;
  weight?: number;
  sex?: string;
  days?: number;
}

function sampleWorkout(focus?: string) {
  if (focus === "calistenia") {
    return {
      title: "Día 1 · Empuje (Calistenia)",
      muscle: "Pecho · Hombro · Tríceps",
      exercises: [
        { name: "Flexiones lastradas", sets: "4 × 8" },
        { name: "Fondos en paralelas", sets: "4 × 6" },
        { name: "Pike push-ups", sets: "3 × 10" },
        { name: "Plancha lastrada", sets: "3 × 45s" },
      ],
    };
  }
  if (focus === "mixto") {
    return {
      title: "Día 1 · Full body híbrido",
      muscle: "Cuerpo completo",
      exercises: [
        { name: "Sentadilla con barra", sets: "4 × 6" },
        { name: "Dominadas lastradas", sets: "4 × 6" },
        { name: "Press militar", sets: "3 × 8" },
        { name: "L-sit / Core", sets: "3 × 30s" },
      ],
    };
  }
  return {
    title: "Día 1 · Empuje (Gimnasio)",
    muscle: "Pecho · Hombro · Tríceps",
    exercises: [
      { name: "Press banca", sets: "4 × 6-8" },
      { name: "Press militar", sets: "4 × 8" },
      { name: "Aperturas con mancuerna", sets: "3 × 10" },
      { name: "Extensiones de tríceps", sets: "3 × 12" },
    ],
  };
}

const PlanPreview = ({ focus, goal, weight, sex, days = 4 }: Props) => {
  const workout = sampleWorkout(focus);
  const nutritionPreview = resolveNutritionPreview({ weight, sex, goal });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-8 space-y-3"
    >
      <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
        <Sparkles className="w-4 h-4" />
        Tu plan está listo — vista previa
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {/* Entrenamiento */}
        <div className="bg-card rounded-2xl border border-border p-4 card-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{workout.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{workout.muscle}</p>
            </div>
          </div>
          <ul className="space-y-1.5">
            {workout.exercises.map((ex, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-xs bg-secondary/30 px-2.5 py-1.5 rounded-lg"
              >
                <span className="truncate pr-2">{ex.name}</span>
                <span className="text-muted-foreground shrink-0">{ex.sets}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-3">
            +{Math.max(days - 1, 2)} días más bloqueados
          </p>
        </div>

        {/* Nutrición */}
        <div className="bg-card rounded-2xl border border-border p-4 card-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Utensils className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">Tu nutrición diaria</p>
              <p className="text-[11px] text-muted-foreground truncate">
                Calculada según tu peso y objetivo
              </p>
            </div>
          </div>
          {nutritionPreview.hasWeight ? (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-secondary/30 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Kcal/día</p>
                <p className="font-bold text-base flex items-center justify-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-primary" />
                  {nutritionPreview.calories}
                </p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Proteína</p>
                <p className="font-bold text-base">{nutritionPreview.protein}g</p>
              </div>
            </div>
          ) : (
            <div className="mb-3 rounded-lg border border-dashed border-primary/30 bg-secondary/20 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Peso pendiente</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Añade tu peso para ver kcal y proteína personalizadas.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <div className="text-xs bg-secondary/30 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
              <span>Desayuno · Tortilla + avena</span>
              <span className="text-muted-foreground">~520 kcal</span>
            </div>
            <div className="text-xs bg-secondary/30 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                Comida, cena y snacks
              </span>
              <span>bloqueado</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Desbloquea el plan completo con tu prueba de 7 días gratis
      </p>
    </motion.div>
  );
};

export default PlanPreview;