import { buildWorkoutReview, type ReviewExercise } from "@/lib/workoutReview";
import { Surface } from "@/components/ui/surface";

interface Props {
  current: ReviewExercise[];
  previous: ReviewExercise[];
  rpe?: number | null;
  coach?: boolean;
}

export function WorkoutReview({ current, previous, rpe, coach = false }: Props) {
  const items = buildWorkoutReview(current, previous, rpe);
  if (!items.length) return null;
  return (
    <Surface role="region" aria-label="Revisión AutoPilot" className="w-full bg-secondary text-left">
      <p className="type-footnote font-semibold text-primary">AutoPilot · Próximo paso</p>
      <h3 className="mt-0.5 type-headline">Lo que nos deja esta sesión</h3>
      <p className="mt-1 type-footnote text-muted-foreground">Comparación con el último registro del mismo día de rutina. Propuestas para revisar; el plan no se ha modificado.</p>
      <div className="mt-3">
        {items.map((item, i) => (
          <div key={item.name} className={`py-3 ${i > 0 ? "sep-t" : ""}`}>
            <p className="type-subhead font-semibold">{item.name}</p>
            <p className="mt-0.5 type-footnote text-muted-foreground">{item.observation}</p>
            <p className="mt-1.5 type-footnote text-primary">{item.proposal}</p>
          </div>
        ))}
      </div>
      <p className="pt-3 type-footnote text-muted-foreground sep-t">
        {coach ? "Revisa estas propuestas junto con las sensaciones del cliente y ajusta su plan desde la ficha si corresponde." : "Sigue tu plan actual y comenta estas propuestas con tu entrenador antes de cambiar las cargas."}
      </p>
    </Surface>
  );
}
