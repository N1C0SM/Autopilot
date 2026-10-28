import { Sparkles } from "lucide-react";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { buildWorkoutReview, type ReviewExercise } from "@/shared/lib/workoutReview";

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
    <section role="region" aria-label="Revisión AutoPilot" className="w-full text-left">
      {/* Patrón de la bienvenida: icono en el tinte, título y una explicación, sin caja. */}
      <div className="flex items-start gap-4">
        <IconTile icon={Sparkles} />
        <div className="min-w-0 flex-1">
          <h3 className="type-headline">Lo que nos deja esta sesión</h3>
          <p className="mt-1 type-subhead text-muted-foreground">
            AutoPilot lo compara con el último registro del mismo día de rutina. Son propuestas para revisar; el plan no se ha modificado.
          </p>
        </div>
      </div>
      <ul className="mt-4">
        {items.map((item) => (
          <li key={item.name} className="py-3 sep-t">
            <p className="type-headline">{item.name}</p>
            <p className="mt-0.5 type-subhead text-muted-foreground">{item.observation}</p>
            <p className="mt-1 type-subhead text-primary">{item.proposal}</p>
          </li>
        ))}
      </ul>
      <p className="pt-3 type-footnote text-muted-foreground sep-t">
        {coach ? "Revisa estas propuestas junto con las sensaciones del cliente y ajusta su plan desde la ficha si corresponde." : "Sigue tu plan actual y comenta estas propuestas con tu entrenador antes de cambiar las cargas."}
      </p>
    </section>
  );
}
