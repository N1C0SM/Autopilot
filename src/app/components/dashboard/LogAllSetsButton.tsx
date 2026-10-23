import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/components/ui/sheet";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { hapticTap } from "@/shared/lib/native";

interface LogAllSetsButtonProps {
  exerciseName: string;
  plannedSets: number;
  completedSets: number;
  onLogAllSets: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Button to quickly log all sets for an exercise (Stronger / Planfit style).
 * Shows a sheet with details and confirmation.
 */
const LogAllSetsButton = ({
  exerciseName,
  plannedSets,
  completedSets,
  onLogAllSets,
  disabled = false,
  className,
}: LogAllSetsButtonProps) => {
  const [open, setOpen] = useState(false);
  const pendingSets = plannedSets - completedSets;

  const handleLogAll = () => {
    if (pendingSets <= 0) {
      toast.info("Todas las series ya están completadas");
      return;
    }
    
    onLogAllSets();
    setOpen(false);
    toast.success(`Se han registrado ${pendingSets} serie(s)`);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild disabled={disabled || pendingSets <= 0}>
        <Button
          variant="tinted"
          size="sm"
          className={cn("w-full sm:w-auto", className)}
          disabled={disabled || pendingSets <= 0}
        >
          <Check className="h-4 w-4 mr-2" />
          {completedSets === plannedSets ? "Todas completadas" : `Registrar todas (${pendingSets})`}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Registrar todas las series</SheetTitle>
          <SheetDescription>
            {completedSets === plannedSets
              ? `Ya has completado todas las ${plannedSets} series de ${exerciseName}.`
              : `Puedes registrar ${pendingSets} serie(s) restante(s) de ${exerciseName} de golpe.`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl bg-card p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="type-subhead">Ejercicio</span>
              <span className="type-subhead font-semibold">{exerciseName}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="type-subhead">Series planeadas</span>
              <span className="type-subhead font-semibold">{plannedSets}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="type-subhead">Series completadas</span>
              <span className="type-subhead font-semibold">{completedSets} / {plannedSets}</span>
            </div>
          </div>

          {pendingSets > 0 && (
            <div className="rounded-2xl bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="type-subhead text-primary font-medium">
                    ¿Registrar todas las series restantes?
                  </p>
                  <p className="type-footnote text-muted-foreground mt-1">
                    Se registrará {pendingSets} serie(s) con el último peso ingresado.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="mt-6">
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              Cancelar
            </Button>
          </SheetTrigger>
          <Button
            variant="default"
            className="w-full sm:w-auto"
            onClick={handleLogAll}
            disabled={disabled || pendingSets <= 0}
          >
            {completedSets === plannedSets ? "Guardar" : "Registrar todas"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default LogAllSetsButton;
