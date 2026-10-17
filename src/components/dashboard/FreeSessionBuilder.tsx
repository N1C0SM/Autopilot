import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { GymExerciseEntry } from "@/types/training";
import ExercisePicker from "./ExercisePicker";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (exercises: GymExerciseEntry[]) => void;
}

/** Entrenamiento libre: eliges los ejercicios y se registra como cualquier sesión de hoy. */
const FreeSessionBuilder = ({ open, onOpenChange, onStart }: Props) => {
  const [list, setList] = useState<GymExerciseEntry[]>([]);
  const [picker, setPicker] = useState(false);

  useEffect(() => { if (open) setList([]); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Entrenamiento libre</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Elige lo que vas a hacer hoy. Cuenta para tu mapa muscular, tu historial y tus récords.</p>
        <ul className="flex-1 space-y-2 overflow-y-auto">
          {list.map((ex, i) => (
            <li key={`${ex.exercise_id}-${i}`} className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{ex.name}</span>
              <Button type="button" size="icon" variant="ghost" aria-label={`Quitar ${ex.name}`} onClick={() => setList((l) => l.filter((_, k) => k !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" onClick={() => setPicker(true)}>
          <Plus className="h-4 w-4" /> Añadir ejercicio
        </Button>
        <DialogFooter>
          <Button type="button" variant="hero" className="w-full" disabled={list.length === 0} onClick={() => onStart(list)}>
            Empezar entrenamiento
          </Button>
        </DialogFooter>
        <ExercisePicker open={picker} onOpenChange={setPicker} onPick={(e) => setList((l) => [...l, e])} />
      </DialogContent>
    </Dialog>
  );
};

export default FreeSessionBuilder;
