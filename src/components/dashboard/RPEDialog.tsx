import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Flame } from "lucide-react";

interface Props {
  open: boolean;
  onConfirm: (rpe: number | null) => void;
}

const RPE_DESCRIPTIONS: Record<number, { label: string; emoji: string }> = {
  1: { label: "Muy fácil", emoji: "😴" },
  2: { label: "Muy fácil", emoji: "😴" },
  3: { label: "Fácil", emoji: "🙂" },
  4: { label: "Algo fácil", emoji: "🙂" },
  5: { label: "Moderado", emoji: "😌" },
  6: { label: "Algo duro", emoji: "😅" },
  7: { label: "Duro", emoji: "😤" },
  8: { label: "Muy duro", emoji: "🔥" },
  9: { label: "Casi al fallo", emoji: "🥵" },
  10: { label: "Al fallo total", emoji: "💀" },
};

const RPEDialog = ({ open, onConfirm }: Props) => {
  const [rpe, setRpe] = useState(7);
  const desc = RPE_DESCRIPTIONS[rpe];

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-primary" />
            ¿Cómo de duro fue?
          </DialogTitle>
          <DialogDescription>
            Marca tu RPE (esfuerzo percibido) del 1 al 10. Esto ajusta tu próximo plan.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-2">{desc.emoji}</div>
            <div className="text-4xl font-bold font-display text-gradient">{rpe}</div>
            <div className="text-sm text-muted-foreground mt-1">{desc.label}</div>
          </div>

          <div className="px-2">
            <Slider value={[rpe]} onValueChange={([v]) => setRpe(v)} min={1} max={10} step={1} />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>1 · Suave</span>
              <span>10 · Al fallo</span>
            </div>
          </div>

          <div className="bg-secondary/30 rounded-lg p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">Tip:</strong> Apunta a un RPE 7-8 en la mayoría de sesiones. Si llevas 3+ días seguidos en 9-10, tu próximo plan bajará un poco la intensidad.
          </div>
        </div>

        <div className="space-y-2">
          <Button variant="hero" className="w-full" onClick={() => onConfirm(rpe)}>
            Guardar esfuerzo y completar
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onConfirm(null)}>
            Completar sin valorar esfuerzo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RPEDialog;
