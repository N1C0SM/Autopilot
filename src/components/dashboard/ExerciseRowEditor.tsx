import { ArrowDown, ArrowUp, Minus, Plus, Trash2 } from "lucide-react";
import { ExerciseThumb } from "@/components/ExerciseMedia";
import { hapticSelection } from "@/lib/native";
import { cn } from "@/lib/utils";
import type { GymExerciseEntry } from "@/types/training";

const RESTS = ["60 s", "90 s", "120 s", "180 s"];

const Stepper = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
    <div className="flex items-center rounded-xl border border-border/70 bg-background/40">
      <button type="button" aria-label={`Menos ${label}`} disabled={value <= min}
        onClick={() => { void hapticSelection(); onChange(Math.max(min, value - 1)); }}
        className="grid h-10 w-10 place-items-center text-muted-foreground disabled:opacity-30 active:scale-90 md:h-9 md:w-9">
        <Minus className="h-4 w-4" />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n))); }}
        className="h-10 w-full min-w-0 bg-transparent text-center text-base font-semibold tabular-nums outline-none md:h-9 md:text-sm"
      />
      <button type="button" aria-label={`Más ${label}`} disabled={value >= max}
        onClick={() => { void hapticSelection(); onChange(Math.min(max, value + 1)); }}
        className="grid h-10 w-10 place-items-center text-muted-foreground disabled:opacity-30 active:scale-90 md:h-9 md:w-9">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  </div>
);

interface Props {
  ex: GymExerciseEntry;
  index: number;
  total: number;
  onChange: (ex: GymExerciseEntry) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

/** Una fila de ejercicio con controles grandes para el pulgar y compactos en escritorio. */
const ExerciseRowEditor = ({ ex, index, total, onChange, onMove, onRemove }: Props) => {
  const reps = typeof ex.reps === "number" ? ex.reps : parseInt(String(ex.reps), 10) || 10;
  return (
    <li className="rounded-2xl border border-border/70 bg-card/50 p-3 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
        <ExerciseThumb image={ex.image_url ?? undefined} video={ex.video_url ?? undefined} name={ex.name} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{ex.name}</span>
          {ex.muscle_group && <span className="block truncate text-xs text-muted-foreground">{ex.muscle_group}</span>}
        </span>
        <div className="flex shrink-0 items-center">
          <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => onMove(-1)} className="grid h-10 w-9 place-items-center text-muted-foreground disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" aria-label="Bajar" disabled={index === total - 1} onClick={() => onMove(1)} className="grid h-10 w-9 place-items-center text-muted-foreground disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
          <button type="button" aria-label={`Quitar ${ex.name}`} onClick={onRemove} className="grid h-10 w-9 place-items-center text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-[1fr_1fr_1.4fr]">
        <Stepper label="Series" value={ex.series} min={1} max={10} onChange={(n) => onChange({ ...ex, series: n })} />
        <Stepper label="Reps" value={reps} min={1} max={100} onChange={(n) => onChange({ ...ex, reps: n })} />
        <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Descanso</span>
          <div className="grid grid-cols-4 gap-1">
            {RESTS.map((r) => (
              <button key={r} type="button" aria-pressed={ex.rest === r}
                onClick={() => { void hapticSelection(); onChange({ ...ex, rest: r }); }}
                className={cn(
                  "h-10 rounded-xl border text-xs font-medium tabular-nums transition-colors md:h-9",
                  ex.rest === r ? "border-primary bg-primary/15 text-foreground" : "border-border/70 text-muted-foreground",
                )}>
                {r.replace(" s", "″")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
};

export default ExerciseRowEditor;
