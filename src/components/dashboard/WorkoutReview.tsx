import { buildWorkoutReview, type ReviewExercise } from "@/lib/workoutReview";

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
    <section className="w-full rounded-2xl border border-primary/25 bg-primary/5 p-4 text-left sm:p-5" aria-label="Revisión AutoPilot">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">AutoPilot · Próximo paso</p>
      <h3 className="mt-1 text-base font-semibold">Lo que nos deja esta sesión</h3>
      <p className="mt-1 text-xs text-muted-foreground">Comparación con el último registro del mismo día de rutina. Propuestas para revisar; el plan no se ha modificado.</p>
      <div className="mt-4 divide-y divide-border/60">
        {items.map(item => (
          <div key={item.name} className="py-3 first:pt-0 last:pb-0">
            <p className="text-sm font-medium">{item.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.observation}</p>
            <p className="mt-2 text-xs text-primary">{item.proposal}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-primary/15 pt-3 text-xs text-muted-foreground">
        {coach ? "Revisa estas propuestas junto con las sensaciones del cliente y ajusta su plan desde la ficha si corresponde." : "Sigue tu plan actual y comenta estas propuestas con tu entrenador antes de cambiar las cargas."}
      </p>
    </section>
  );
}
