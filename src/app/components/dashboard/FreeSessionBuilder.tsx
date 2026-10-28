import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { GymExerciseEntry } from "@/shared/types/training";
import ExercisePicker from "@/app/components/dashboard/ExercisePicker";
import ExerciseRowEditor from "@/app/components/dashboard/ExerciseRowEditor";
import ResponsiveSheet from "@/app/components/dashboard/ResponsiveSheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (exercises: GymExerciseEntry[]) => void;
}

const DRAFT_KEY = "autopilot:sesion-libre";

/** Entrenamiento libre: eliges los ejercicios y se registra como cualquier sesión de hoy. */
const FreeSessionBuilder = ({ open, onOpenChange, onStart }: Props) => {
  const [list, setList] = useState<GymExerciseEntry[]>([]);
  const [picker, setPicker] = useState(false);

  // Si cierras sin empezar, la selección te espera la próxima vez.
  useEffect(() => {
    if (!open) return;
    try { setList(JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "[]")); } catch { setList([]); }
  }, [open]);
  useEffect(() => { if (open) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(list)); }, [list, open]);

  const move = (i: number, dir: -1 | 1) => setList((l) => {
    const n = [...l]; const j = i + dir;
    if (j < 0 || j >= n.length) return l;
    [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  const sets = list.reduce((a, e) => a + e.series, 0);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Entrenamiento libre"
      description="Cuenta para tu mapa muscular, tu historial y tus récords."
      desktopClassName="sm:max-w-2xl"
      footer={
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button type="button" variant="hero" size="lg" className="min-h-12 w-full md:flex-1" disabled={list.length === 0}
            onClick={() => { sessionStorage.removeItem(DRAFT_KEY); onStart(list); }}>
            {list.length ? `Empezar · ${list.length} ejercicios · ${sets} series` : "Añade al menos un ejercicio"}
          </Button>
          {list.length > 0 && (
            <Button type="button" variant="ghost" className="min-h-11 md:w-auto" onClick={() => setList([])}>Vaciar</Button>
          )}
        </div>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        {list.length === 0 ? (
          <button type="button" onClick={() => setPicker(true)}
            className="flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-3xl text-muted-foreground transition hover:border-primary/50 active:scale-[0.99]">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/12 text-primary"><Plus className="h-6 w-6" /></span>
            <span className="type-subhead font-medium text-foreground">Añadir ejercicios</span>
            <span className="type-footnote">Busca por nombre o filtra por músculo</span>
          </button>
        ) : (
          <>
            <ul className="space-y-2">
              {list.map((ex, i) => (
                <ExerciseRowEditor key={`${ex.exercise_id}-${i}`} ex={ex} index={i} total={list.length}
                  onChange={(e) => setList((l) => l.map((x, k) => (k === i ? e : x)))}
                  onMove={(d) => move(i, d)}
                  onRemove={() => setList((l) => l.filter((_, k) => k !== i))} />
              ))}
            </ul>
            <Button type="button" variant="outline" className="mt-3 min-h-12 w-full" onClick={() => setPicker(true)}>
              <Plus className="h-4 w-4" /> Añadir más
            </Button>
          </>
        )}
      </div>
      <ExercisePicker open={picker} onOpenChange={setPicker} existing={list.map((e) => e.name)} onPick={(e) => setList((l) => [...l, ...e])} />
    </ResponsiveSheet>
  );
};

export default FreeSessionBuilder;
