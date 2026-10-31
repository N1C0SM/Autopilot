import { Video } from "lucide-react";
import ExerciseMedia from "@/app/components/ExerciseMedia";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/components/ui/dialog";
import { FeatureRow } from "@/app/components/workout-parts/FeatureRow";

export type ExercisePreviewData = {
  name: string;
  image?: string | null;
  video?: string | null;
  /** Línea corta bajo el nombre (series, categoría…). */
  detail?: string | null;
  /** Patrón, estímulo y carga: dibujan la huella de movimiento en el héroe. */
  pattern?: string | null;
  stimulus?: string | null;
  load?: string | null;
};

/**
 * Ficha rápida de técnica: el héroe es el vídeo (con su portada) y se reproduce
 * solo si el usuario pulsa play. Se usa desde la biblioteca del admin y desde el
 * editor de rutinas para ver el vídeo sin entrar a editar.
 */
export const ExercisePreviewSheet = ({
  exercise,
  onClose,
}: {
  exercise: ExercisePreviewData | null;
  onClose: () => void;
}) => (
  <Dialog open={!!exercise} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent
      className="gap-0 sm:max-w-lg"
      {...(exercise?.detail ? {} : { "aria-describedby": undefined })}
    >
      {/* Bajo el botón de cerrar, no debajo de él: los controles del vídeo quedan libres. */}
      <ExerciseMedia video={exercise?.video} image={exercise?.image} name={exercise?.name} className="mt-7 rounded-[14px] sm:mt-6" />

      <div className="mt-5 pr-8">
        <DialogTitle className="type-title2 sm:type-title2">{exercise?.name}</DialogTitle>
        {exercise?.detail && <DialogDescription className="mt-1">{exercise.detail}</DialogDescription>}
      </div>

      {/* Sin imagen, el propio hueco del vídeo ya lo dice: no se repite. */}
      {!exercise?.video && exercise?.image && (
        <FeatureRow
          className="mt-6"
          icon={Video}
          title="Todavía sin vídeo"
          description="Este ejercicio solo tiene imagen de técnica por ahora."
        />
      )}

      <div className="h-2" aria-hidden="true" />
    </DialogContent>
  </Dialog>
);

export default ExercisePreviewSheet;
