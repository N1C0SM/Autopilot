import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { hapticSelection } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import type { GymExerciseEntry } from "@/shared/types/training";

const RESTS = ["60 s", "90 s", "120 s", "180 s"];

const Stepper = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) => (
  <div className="flex flex-col gap-1">
    <span className="type-caption2 uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
    <div className="flex items-center rounded-full bg-secondary">
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
        className="h-10 w-full min-w-0 bg-transparent text-center type-body font-semibold tabular-nums outline-none md:h-9 md:text-sm"
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

/** Fila compacta (como en el entrenamiento); al tocarla se despliegan los ajustes. */
const ExerciseRowEditor = ({ ex, index, total, onChange, onMove, onRemove }: Props) => {
  const [open, setOpen] = useState(false);
  const reps = typeof ex.reps === "number" ? ex.reps : parseInt(String(ex.reps), 10) || 10;
  const rest = (ex.rest || "90 s").replace(" s", "″");
  return (
    <li className={cn("rounded-media border bg-card/50 backdrop-blur-xl transition-colors", open ? "border-primary/40" : "border-border/60")}>
      <button type="button" aria-expanded={open} onClick={() => { void hapticSelection(); setOpen((v) => !v); }}
        className="flex w-full items-center gap-3 p-3 text-left">
        <ExerciseThumb image={ex.image_url ?? undefined} video={ex.video_url ?? undefined} name={ex.name} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate type-subhead font-medium">{ex.name}</span>
          <span className="block truncate type-footnote tabular-nums text-muted-foreground">
            {ex.series} series · {reps} reps · {rest}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 px-3 pb-3">
          <div className="grid grid-cols-2 gap-2">
            <Stepper label="Series" value={ex.series} min={1} max={10} onChange={(n) => onChange({ ...ex, series: n })} />
            <Stepper label="Reps" value={reps} min={1} max={100} onChange={(n) => onChange({ ...ex, reps: n })} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="type-caption2 uppercase tracking-[0.12em] text-muted-foreground">Descanso</span>
            <div className="grid grid-cols-4 gap-1">
              {RESTS.map((r) => (
                <button key={r} type="button" aria-pressed={ex.rest === r}
                  onClick={() => { void hapticSelection(); onChange({ ...ex, rest: r }); }}
                  className={cn(
                    "h-10 rounded-media border type-footnote font-medium tabular-nums transition-colors md:h-9",
                    ex.rest === r ? "border-primary bg-primary/15 text-foreground" : "border-border/70 text-muted-foreground",
                  )}>
                  {r.replace(" s", "″")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 border-t border-border/50 pt-2">
            <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => onMove(-1)} className="grid h-10 w-10 place-items-center rounded-media text-muted-foreground disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
            <button type="button" aria-label="Bajar" disabled={index === total - 1} onClick={() => onMove(1)} className="grid h-10 w-10 place-items-center rounded-media text-muted-foreground disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
            <button type="button" onClick={onRemove} className="ml-auto flex h-10 items-center gap-1.5 rounded-media px-3 type-footnote text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" /> Quitar
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

export default ExerciseRowEditor;
