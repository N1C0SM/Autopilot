import { Dumbbell, Utensils, Sparkles } from "lucide-react";
import { ListGroup, ListRow } from "@/components/ui/list";
import { resolveNutritionPreview } from "@/lib/nutrition";

interface Props {
  focus?: string; // gimnasio | calistenia | mixto
  goal?: string;
  weight?: number;
  sex?: string;
  days?: number;
  registered?: boolean;
  /** The host screen already shows the reveal headline. */
  hideHeader?: boolean;
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

const PlanPreview = ({ focus, goal, weight, sex, days = 4, registered = false, hideHeader = false }: Props) => {
  const workout = sampleWorkout(focus);
  const nutritionPreview = resolveNutritionPreview({ weight, sex, goal });

  return (
    <div className="space-y-8">
      {hideHeader ? null : (
      <div className="flex flex-col items-center text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[22%] bg-card">
          <Sparkles className="h-8 w-8 text-primary" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <p className="mt-5 type-title2">Tu plan de arranque está definido</p>
        <p className="mt-1.5 max-w-[32ch] type-subhead text-muted-foreground">
          {registered ? "Confirma para generar y guardar tu plan completo." : "Crea tu cuenta para generar y guardar el plan completo."}
        </p>
      </div>
      )}

      <ListGroup
        header={workout.title}
        footer={`${workout.muscle} · +${Math.max(days - 1, 2)} sesiones que se completarán al crear el plan`}
      >
        {workout.exercises.map((ex) => (
          <ListRow key={ex.name} icon={<Dumbbell className="text-muted-foreground" />} title={ex.name} value={<span className="tabular-nums">{ex.sets}</span>} />
        ))}
      </ListGroup>

      <div className="flex items-start gap-4 px-4">
        <div className="flex w-7 shrink-0 justify-center pt-0.5">
          <Utensils className="h-7 w-7 text-primary" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="type-headline">Tu nutrición diaria</p>
          {nutritionPreview.hasWeight ? (
            <>
              <div className="mt-2 flex gap-8">
                <div>
                  <p className="type-title1 font-rounded leading-none tabular-nums">{nutritionPreview.calories}</p>
                  <p className="mt-1 type-subhead text-muted-foreground">kcal al día</p>
                </div>
                <div>
                  <p className="type-title1 font-rounded leading-none tabular-nums">{nutritionPreview.protein} g</p>
                  <p className="mt-1 type-subhead text-muted-foreground">proteína</p>
                </div>
              </div>
              <p className="mt-3 type-subhead text-muted-foreground">Menús y cantidades al generar el plan.</p>
            </>
          ) : (
            <p className="mt-1 type-subhead text-muted-foreground">
              Añade tu peso para ver kcal y proteína personalizadas. Menús y cantidades al generar el plan.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanPreview;
