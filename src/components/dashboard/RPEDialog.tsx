import { useState } from "react";
import { Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FeatureRow } from "@/components/workout-parts/FeatureRow";
import { hapticSelection, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onConfirm: (rpe: number | null) => void;
}

const RPE_LABELS: Record<number, string> = {
  1: "Muy fácil",
  2: "Muy fácil",
  3: "Fácil",
  4: "Algo fácil",
  5: "Moderado",
  6: "Algo duro",
  7: "Duro",
  8: "Muy duro",
  9: "Casi al fallo",
  10: "Al fallo total",
};

const SCALE = Array.from({ length: 10 }, (_, i) => i + 1);

const RPEDialog = ({ open, onConfirm }: Props) => {
  const [rpe, setRpe] = useState(7);

  const choose = (value: number) => {
    if (value === rpe) return;
    void hapticSelection();
    setRpe(value);
  };

  const confirm = (value: number | null) => {
    void hapticTap();
    onConfirm(value);
  };

  return (
    <Dialog open={open}>
      {/* Hay que elegir: valorar o completar sin valorar. Ni tirador ni botón de cerrar. */}
      <DialogContent
        dismissible={false}
        className="gap-6 pt-6 sm:max-w-md [&>button:last-child]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-2 sm:pr-0 sm:text-center">
          <DialogTitle className="type-title2 sm:type-title2">¿Cómo de duro fue?</DialogTitle>
          <DialogDescription>
            Marca tu esfuerzo percibido del 1 al 10. Así ajustamos tu próximo plan.
          </DialogDescription>
        </DialogHeader>

        <div className="text-center" aria-live="polite">
          <p className="font-rounded text-[64px] font-bold leading-none tabular-nums">{rpe}</p>
          <p className="mt-2 type-headline text-primary">{RPE_LABELS[rpe]}</p>
        </div>

        <div
          role="radiogroup"
          aria-label="Esfuerzo percibido"
          className="mx-auto grid w-full max-w-sm grid-cols-5 justify-items-center gap-y-3"
        >
          {SCALE.map((value) => {
            const selected = value === rpe;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${value}, ${RPE_LABELS[value].toLowerCase()}`}
                onClick={() => choose(value)}
                className={cn(
                  "flex h-[52px] w-[52px] items-center justify-center rounded-full font-rounded type-headline tabular-nums transition-[background-color,color,transform] duration-100 ease-ios-standard active:scale-95",
                  selected
                    ? "bg-primary/15 text-primary ring-2 ring-inset ring-primary"
                    : "bg-secondary text-foreground active:bg-accent",
                )}
              >
                {value}
              </button>
            );
          })}
        </div>

        <FeatureRow
          icon={Target}
          title="Apunta a un 7 u 8"
          description="Es lo ideal en la mayoría de sesiones. Si llevas tres días seguidos en 9 o 10, tu próximo plan bajará un poco la intensidad."
        />

        <div className="grid gap-2">
          <Button size="lg" className="w-full" onClick={() => confirm(rpe)}>
            Guardar esfuerzo y completar
          </Button>
          <Button variant="plain" className="w-full" onClick={() => confirm(null)}>
            Completar sin valorar esfuerzo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RPEDialog;
