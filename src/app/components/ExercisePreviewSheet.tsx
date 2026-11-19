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
 * Ficha rápida de técnica (Admin → Biblioteca y el editor de planes del admin): el héroe es el
 * ejercicio en movimiento sobre su foto, como en la app (`ExerciseHeroMedia`), para ver el clip
 * sin entrar a editar. Es la hoja de vista previa de `AdminExercises.swift`.
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
      {/* Bajo el botón de cerrar, no debajo de él: «Ver vídeo» y «Ritmo / Foto» quedan libres. */}
      <ExerciseMedia video={exercise?.video} image={exercise?.image} name={exercise?.name} pattern={exercise?.pattern} stimulus={exercise?.stimulus} load={exercise?.load} className="mt-7 rounded-[14px] sm:mt-6" />

      <div className="mt-5 pr-8">
        <DialogTitle className="type-title2 sm:type-title2">{exercise?.name}</DialogTitle>
        {exercise?.detail && <DialogDescription className="mt-1">{exercise.detail}</DialogDescription>}
      </div>

      {/* Con foto y sin clip: qué falta y cómo crearlo (sin foto, el propio héroe ya lo dice). */}
      {!exercise?.video && exercise?.image && (
        <FeatureRow
          className="mt-6"
          icon={Video}
          title="Vídeo de técnica por crear"
          description="Créalo desde su ficha o con «Generar vídeos de los ejercicios de los planes»."
        />
      )}

      <div className="h-2" aria-hidden="true" />
    </DialogContent>
  </Dialog>
);

export default ExercisePreviewSheet;
