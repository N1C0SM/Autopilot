import { Check, X } from "lucide-react";
import { getExerciseGuide } from "@/shared/lib/exerciseGuide";

/**
 * Técnica de un ejercicio en la ficha: pasos numerados, claves y errores que evitar.
 * Mismo patrón que la bienvenida: marca a la izquierda, texto a la derecha, sin cajas.
 */
const ExerciseTechnique = ({
  name,
  movementPattern,
  muscleGroup,
}: {
  name?: string | null;
  movementPattern?: string | null;
  muscleGroup?: string | null;
}) => {
  const guide = getExerciseGuide({ name, movementPattern, muscleGroup });

  return (
    <section className="mt-8" aria-label="Técnica">
      <h3 className="type-title3">Cómo se hace</h3>
      <ol className="mt-3 space-y-3 rounded-media bg-secondary p-4">
        {guide.steps.map((step, i) => (
          <li key={step} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 font-rounded type-subhead font-semibold tabular-nums text-primary">
              {i + 1}
            </span>
            <p className="min-w-0 pt-0.5 type-body">{step}</p>
          </li>
        ))}
      </ol>

      <h3 className="mt-7 type-title3">En qué fijarte</h3>
      <ul className="mt-3 space-y-2.5 rounded-media bg-secondary p-4">
        {guide.cues.map((cue) => (
          <li key={cue} className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={2.5} aria-hidden="true" />
            <p className="min-w-0 type-body">{cue}</p>
          </li>
        ))}
      </ul>

      <h3 className="mt-7 type-title3">Evita</h3>
      <ul className="mt-3 space-y-2.5 rounded-media bg-secondary p-4">
        {guide.mistakes.map((mistake) => (
          <li key={mistake} className="flex items-start gap-3">
            <X className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2.5} aria-hidden="true" />
            <p className="min-w-0 type-body text-muted-foreground">{mistake}</p>
          </li>
        ))}
      </ul>

      <p className="mt-5 type-footnote text-muted-foreground">
        {guide.safety ? `${guide.safety} ` : ""}Si notas dolor, para y consúltalo con un profesional.
      </p>
    </section>
  );
};

export default ExerciseTechnique;
