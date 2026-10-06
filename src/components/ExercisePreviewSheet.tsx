import ExerciseMedia from "@/components/ExerciseMedia";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export type ExercisePreviewData = {
  name: string;
  image?: string | null;
  video?: string | null;
  /** Línea corta bajo el nombre (series, categoría…). */
  detail?: string | null;
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
  <Sheet open={!!exercise} onOpenChange={(open) => { if (!open) onClose(); }}>
    <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl p-0">
      <div className="w-full overflow-hidden bg-black">
        <ExerciseMedia video={exercise?.video} image={exercise?.image} name={exercise?.name} />
      </div>
      <div className="space-y-3 p-4 pb-8">
        <SheetHeader className="space-y-0 p-0 text-left">
          <SheetTitle className="font-display text-xl font-bold">{exercise?.name}</SheetTitle>
        </SheetHeader>
        {exercise?.detail && <p className="text-sm text-muted-foreground">{exercise.detail}</p>}
        {!exercise?.video && (
          <p className="rounded-xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            Este ejercicio todavía no tiene vídeo de técnica.
          </p>
        )}
      </div>
    </SheetContent>
  </Sheet>
);

export default ExercisePreviewSheet;
