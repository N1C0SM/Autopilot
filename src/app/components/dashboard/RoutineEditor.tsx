import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { rowKeys } from "@/shared/lib/planEditorValues";
import { exerciseCount } from "@/shared/lib/exerciseLibrary";
import { SESSION_LIMIT_MESSAGE } from "@/shared/lib/customRoutines";
import type { DayPlan, GymExerciseEntry } from "@/shared/types/training";
import ExercisePicker from "@/app/components/dashboard/ExercisePicker";
import ExerciseRowEditor from "@/app/components/dashboard/ExerciseRowEditor";
import ResponsiveSheet from "@/app/components/dashboard/ResponsiveSheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La rutina que se edita; sin ella, «Nueva rutina». */
  routine?: DayPlan | null;
  /** Ya hay siete sesiones: una rutina nueva no cabe (se dice arriba y «Guardar» no se activa). */
  limitReached?: boolean;
  /** Guarda nombre y ejercicios; devuelve false si no se pudo (el editor sigue abierto). */
  onSave: (routine: { name: string; exercises: GymExerciseEntry[] }) => Promise<boolean>;
}

const clone = (list: GymExerciseEntry[]) => JSON.parse(JSON.stringify(list)) as GymExerciseEntry[];

/**
 * «Nueva rutina» y «Editar rutina» (`RoutineEditorView` en la app): nombre, ejercicios con el
 * selector compartido y cada fila con el mismo editor que «Editar mi rutina» (series, reps
 * «Fijo | Rango», descanso rápido u «Otro»). Una sola acción dorada: «Guardar rutina».
 */
const RoutineEditor = ({ open, onOpenChange, routine, limitReached = false, onSave }: Props) => {
  const editing = Boolean(routine);
  const [name, setName] = useState("");
  const [list, setList] = useState<GymExerciseEntry[]>([]);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Se rellena al abrir (o al cambiar de rutina), no cada vez que el plan se recarga: volver a la app
  // o un cambio en tiempo real traen un objeto nuevo y no pueden borrar lo que estás editando.
  const routineDay = routine?.day ?? null;
  useEffect(() => {
    if (!open) return;
    setName(routine?.routine_name ?? "");
    setList(clone(routine?.exercises ?? []));
    setFailed(false);
    setConfirmDiscard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routineDay]);

  const keys = rowKeys(list);
  const blocked = !editing && limitReached;
  const dirty = name.trim() !== (routine?.routine_name ?? "").trim()
    || JSON.stringify(list) !== JSON.stringify(routine?.exercises ?? []);
  const ready = name.trim().length > 0 && list.length > 0 && dirty && !blocked;
  const sets = list.reduce((total, exercise) => total + (Number(exercise.series) || 0), 0);

  const move = (i: number, dir: -1 | 1) => setList((current) => {
    const next = [...current];
    const j = i + dir;
    if (j < 0 || j >= next.length) return current;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  // Cerrar con cambios sin guardar pide confirmación (como «Editar mi rutina»).
  const requestClose = () => {
    if (dirty && list.length > 0) { setConfirmDiscard(true); return; }
    onOpenChange(false);
  };

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setFailed(false);
    const ok = await onSave({ name: name.trim(), exercises: list });
    setSaving(false);
    if (ok) { void hapticTap(); onOpenChange(false); } else setFailed(true);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => { if (next) onOpenChange(true); else requestClose(); }}
      title={editing ? "Editar rutina" : "Nueva rutina"}
      description="Ponle nombre, elige los ejercicios y ajusta series, repeticiones y descanso."
      desktopClassName="sm:max-w-2xl"
      footer={confirmDiscard ? (
        <div role="alert" aria-live="assertive">
          <p className="mb-2 text-center type-footnote text-muted-foreground">Tienes cambios sin guardar en esta rutina.</p>
          <div className="flex flex-col-reverse gap-1 md:flex-row md:items-center md:justify-end md:gap-2">
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setConfirmDiscard(false)}>Seguir editando</Button>
            <Button type="button" variant="destructive" className="min-h-11" onClick={() => { setConfirmDiscard(false); onOpenChange(false); }}>
              Descartar cambios
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {failed && <p role="alert" className="text-center type-footnote text-destructive">No se pudo guardar la rutina. Inténtalo de nuevo.</p>}
          <Button type="button" variant="hero" size="lg" className="min-h-12 w-full" disabled={!ready || saving} onClick={() => void save()}>
            {saving ? "Guardando…" : "Guardar rutina"}
          </Button>
          {list.length > 0 && (
            <p className="text-center type-footnote tabular-nums text-muted-foreground">
              {`${exerciseCount(list.length)} · ${sets} ${sets === 1 ? "serie" : "series"}`}
            </p>
          )}
        </div>
      )}
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-2">
        {blocked && (
          <p role="status" className="rounded-card bg-primary/10 px-4 py-3 type-subhead text-foreground">{SESSION_LIMIT_MESSAGE}.</p>
        )}
        <Field label="Nombre">
          <Input
            value={name}
            maxLength={60}
            placeholder="Ej.: Pierna pesada"
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
            className="h-12"
          />
        </Field>

        <section aria-label="Ejercicios de la rutina" className="space-y-3">
          <h3 className="type-title3">Ejercicios</h3>
          {list.length === 0 ? (
            // Sin ejercicios: la misma tarjeta grande que el día vacío de «Editar mi rutina».
            <button
              type="button"
              onClick={() => { void hapticSelection(); setPicker(true); }}
              className="flex min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-sheet bg-card px-6 text-center text-muted-foreground transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary"><Plus className="h-6 w-6" /></span>
              <span className="type-headline text-foreground">Añadir ejercicios</span>
              <span className="type-footnote">Busca por nombre o filtra por músculo</span>
            </button>
          ) : (
            <>
              <ul className="space-y-3">
                {list.map((exercise, i) => (
                  <ExerciseRowEditor
                    key={keys[i]}
                    ex={exercise}
                    index={i}
                    total={list.length}
                    onChange={(next) => setList((current) => current.map((item, k) => (k === i ? next : item)))}
                    onMove={(dir) => move(i, dir)}
                    onRemove={() => setList((current) => current.filter((_, k) => k !== i))}
                  />
                ))}
              </ul>
              <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => { void hapticSelection(); setPicker(true); }}>
                <Plus aria-hidden="true" /> Añadir ejercicios
              </Button>
            </>
          )}
        </section>
      </div>
      <ExercisePicker
        open={picker}
        onOpenChange={setPicker}
        existing={list.map((exercise) => exercise.name)}
        onPick={(entries) => setList((current) => [...current, ...entries])}
      />
    </ResponsiveSheet>
  );
};

export default RoutineEditor;
