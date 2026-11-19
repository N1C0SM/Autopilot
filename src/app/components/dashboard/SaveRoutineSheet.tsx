import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/components/ui/drawer";
import { hapticTap } from "@/shared/lib/native";
import { exerciseCount } from "@/shared/lib/exerciseLibrary";
import { SESSION_LIMIT_MESSAGE } from "@/shared/lib/customRoutines";
import type { GymExerciseEntry } from "@/shared/types/training";

export type SaveRoutineResult = "ok" | "limit" | "error";

interface Props {
  /** Lo hecho en el entreno vacío (`routineFromWorkout`): ejercicios con series hechas. */
  exercises: GymExerciseEntry[];
  /** Nombre propuesto (el sugerido por sus músculos). */
  suggestedName: string;
  limitReached: boolean;
  /** Ya se guardó (el resumen se pinta dos veces: en la hoja y en la página). */
  saved?: boolean;
  onSave: (name: string, exercises: GymExerciseEntry[]) => Promise<SaveRoutineResult>;
}

/**
 * «Guardar como rutina» al terminar un entreno vacío (`SaveRoutineSheet` en la app): pide un
 * nombre y guarda los ejercicios y las series hechas como una rutina de «Mis rutinas».
 */
const SaveRoutineSheet = ({ exercises, suggestedName, limitReached, saved: alreadySaved = false, onSave }: Props) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [saving, setSaving] = useState(false);
  const [savedHere, setSaved] = useState(false);
  const saved = alreadySaved || savedHere;
  const [problem, setProblem] = useState<SaveRoutineResult | null>(null);
  useEffect(() => { if (open) { setName(suggestedName); setProblem(null); } }, [open, suggestedName]);

  const sets = exercises.reduce((total, exercise) => total + (Number(exercise.series) || 0), 0);
  if (exercises.length === 0) return null;

  const save = async () => {
    if (saving || !name.trim()) return;
    setSaving(true);
    const result = await onSave(name.trim(), exercises);
    setSaving(false);
    if (result === "ok") { void hapticTap(); setSaved(true); setOpen(false); } else setProblem(result);
  };

  return (
    <>
      {saved ? (
        <p role="status" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary/10 px-4 type-headline text-primary">
          <Check className="h-4 w-4" aria-hidden="true" />Guardada en Mis rutinas
        </p>
      ) : (
        <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => { void hapticTap(); setOpen(true); }}>
          <Plus aria-hidden="true" /> Guardar como rutina
        </Button>
      )}
      <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="px-5 pt-4 text-left">
            <DrawerTitle className="type-title3">Guardar como rutina</DrawerTitle>
            <DrawerDescription className="tabular-nums">
              {`${exerciseCount(exercises.length)} · ${sets} ${sets === 1 ? "serie" : "series"}, tal como las has hecho.`}
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-5">
            {(limitReached || problem === "limit") && (
              <p role="status" className="rounded-card bg-primary/10 px-4 py-3 type-subhead">{SESSION_LIMIT_MESSAGE}.</p>
            )}
            <Field label="Nombre" error={problem === "error" ? "No se pudo guardar la rutina. Inténtalo de nuevo." : undefined}>
              <Input value={name} maxLength={60} autoComplete="off" placeholder="Ej.: Pierna pesada" onChange={(event) => setName(event.target.value)} className="h-12" />
            </Field>
          </div>
          <DrawerFooter className="gap-2 px-5 pb-5">
            <Button size="lg" variant="hero" className="min-h-12 w-full" disabled={saving || !name.trim() || limitReached || problem === "limit"} onClick={() => void save()}>
              {saving ? "Guardando…" : "Guardar rutina"}
            </Button>
            <Button size="lg" variant="ghost" className="min-h-11 w-full font-semibold" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default SaveRoutineSheet;
