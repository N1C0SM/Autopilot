import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { hapticSelection } from "@/shared/lib/native";
import {
  REST_LIMITS, exerciseSpoken, exerciseSummary, formatReps, formatRest, formatRestSpoken, parseReps, repsLimits,
  repsUnit, restBase, restIsQuick, restSeconds, restValue, toFixed, toRange, typedWeight, weightText, withReps, type RepsValue,
} from "@/shared/lib/planEditorValues";
import { cn } from "@/shared/lib/utils";
import type { GymExerciseEntry } from "@/shared/types/training";

/** Descansos rápidos en segundos («60 s», «90 s», «2 min», «3 min»); «Otro» abre un contador libre. Igual que `PlanExerciseRow.rests`. */
export const RESTS = [60, 90, 120, 180];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Etiqueta pequeña sobre cada control (Footnote gris, nunca en mayúsculas). */
const FieldLabel = ({ children }: { children: string }) => (
  <span className="px-1 type-footnote text-muted-foreground" aria-hidden>{children}</span>
);

/**
 * Contador en píldora: − cifra + (44 px de zona táctil en cada botón). Es `PlanStepper` en la app.
 * `text` es lo guardado tal cual (unas reps «AMRAP»); `value` es el número del que parten − y +.
 * Al tocar la cifra se escribe una nueva (la actual queda como pista gris); lo escrito cuenta en
 * cuanto cabe entre `min` y `max` y al salir del campo se ajusta a ese margen. Salir sin escribir
 * deja la cifra como estaba. Abrir y guardar nunca cambian nada.
 */
const Stepper = ({ label, name, value, text, unit, min, max, step = 1, onChange }: {
  label?: string; name: string; value: number; text?: string; unit?: string;
  min: number; max: number; step?: number; onChange: (n: number) => void;
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const current = text ?? String(value);
  const shown = draft ?? current;
  // Con un texto guardado («AMRAP», «60-90 s»), escribir su número de partida también lo cambia.
  const commit = (n: number) => { if (n !== value || text !== undefined) onChange(n); };
  const what = name.toLowerCase();
  const stepButton = "grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition active:scale-90 disabled:opacity-30";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="flex h-11 items-center rounded-full bg-secondary">
        <button type="button" aria-label={`Reducir ${what}`} disabled={value <= min}
          onClick={() => { void hapticSelection(); setDraft(null); commit(clamp(value - step, min, max)); }}
          className={stepButton}>
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <label className="flex h-11 min-w-0 flex-1 cursor-text items-center justify-center gap-1">
          <input
            aria-label={name}
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="off"
            // Al tocar la cifra se escribe una nueva directamente; la actual queda como pista gris.
            value={shown}
            placeholder={current}
            onFocus={() => setDraft("")}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
              setDraft(digits);
              const n = Number(digits);
              if (digits && n >= min && n <= max) commit(n);
            }}
            onBlur={() => { if (draft) commit(clamp(Number(draft), min, max)); setDraft(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            // Con unidad («20 s»), el campo mide lo que su cifra para que «s» quede pegada y el conjunto centrado.
            style={unit ? { width: `${Math.max(1, (shown || current).length) + 0.5}ch` } : undefined}
            className={cn("h-11 min-w-0 bg-transparent text-center type-headline tabular-nums outline-none placeholder:text-muted-foreground", unit ? "max-w-full" : "w-full")}
          />
          {unit && <span className="shrink-0 type-subhead text-muted-foreground" aria-hidden>{unit}</span>}
        </label>
        <button type="button" aria-label={`Aumentar ${what}`} disabled={value >= max}
          onClick={() => { void hapticSelection(); setDraft(null); commit(clamp(value + step, min, max)); }}
          className={stepButton}>
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
};

/** Opción del descanso en píldora (44 px): dorado tenue la elegida. */
const RestChip = ({ on, label, spoken, onClick }: { on: boolean; label: string; spoken: string; onClick: () => void }) => (
  <button type="button" aria-pressed={on} aria-label={spoken}
    onClick={() => { void hapticSelection(); onClick(); }}
    className={cn(
      "h-11 min-w-0 truncate rounded-full px-1 type-footnote font-semibold tabular-nums transition-colors",
      on ? "bg-primary/15 text-primary" : "bg-secondary text-foreground",
    )}>
    {label}
  </button>
);

interface Props {
  ex: GymExerciseEntry;
  index: number;
  total: number;
  onChange: (ex: GymExerciseEntry) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

/**
 * Fila de la rutina en una tarjeta sin borde: plegada enseña la miniatura, el nombre y
 * «3 series · 8-12 reps · 90 s»; al tocarla se abren series y peso, las repeticiones («Fijo» o
 * «Rango», con mínimo y máximo), el descanso (rápidos u «Otro» libre) y «Subir», «Bajar» y
 * «Quitar». Es `PlanExerciseRow` en la app.
 */
const ExerciseRowEditor = ({ ex, index, total, onChange, onMove, onRemove }: Props) => {
  const [open, setOpen] = useState(false);
  // «Otro» elegido a mano aunque el descanso coincida con uno rápido (se escribe en su contador).
  const [customRest, setCustomRest] = useState(false);
  const summary = exerciseSummary(ex);

  const reps = parseReps(ex.reps);
  const unit = repsUnit(reps);
  const seconds = unit === "s";
  const limits = repsLimits(unit);
  const noun = seconds ? "segundos" : "repeticiones";
  const setReps = (v: RepsValue) => onChange(withReps(ex, formatReps(v)));

  const rest = restSeconds(ex.rest);
  const restText = String(ex.rest ?? "").trim();
  const otherRest = customRest || !restIsQuick(ex.rest, RESTS);
  const chosenRest = otherRest ? null : rest ?? 90;

  return (
    <li className={cn("overflow-hidden rounded-[22px] bg-card transition-shadow", open && "ring-1 ring-inset ring-primary/30")}>
      <button type="button" aria-expanded={open} aria-label={exerciseSpoken(ex)}
        onClick={() => { void hapticSelection(); setOpen((v) => !v); setCustomRest(false); }}
        className="flex w-full items-center gap-3 p-3 pr-4 text-left">
        <ExerciseThumb image={ex.image_url ?? undefined} name={ex.name} muscleGroup={ex.muscle_group} size="md" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 type-headline">{ex.name}</span>
          <span className="mt-0.5 block truncate type-footnote tabular-nums text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180 text-primary")} aria-hidden />
      </button>
      {open && (
        <div className="space-y-5 px-3 pb-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <Stepper label="Series" name="Series" value={Number(ex.series) || 1} min={1} max={10}
              onChange={(n) => onChange({ ...ex, series: n })} />
            <label className="flex min-w-0 flex-col gap-1.5">
              <FieldLabel>Peso</FieldLabel>
              <span className="flex h-11 items-center gap-1 rounded-full bg-secondary px-4">
                <input
                  aria-label="Peso en kilos"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  // Coma decimal en pantalla y punto al guardarlo («62,5» ↔ «62.5»).
                  value={weightText(ex.weight)}
                  placeholder="—"
                  onChange={(e) => onChange({ ...ex, weight: typedWeight(e.target.value) })}
                  className="min-w-0 flex-1 bg-transparent type-headline tabular-nums outline-none placeholder:text-muted-foreground"
                />
                <span className="shrink-0 type-subhead text-muted-foreground" aria-hidden>kg</span>
              </span>
            </label>
          </div>

          {/* Repeticiones: «Fijo» (− 10 +) o «Rango» (mínimo y máximo, «8-12»). Los isométricos, en segundos. */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <FieldLabel>{seconds ? "Tiempo" : "Repeticiones"}</FieldLabel>
              <Tabs value={reps.kind === "range" ? "range" : "fixed"} onValueChange={(mode) => {
                void hapticSelection();
                if (mode === "range" && reps.kind !== "range") setReps(toRange(reps));
                if (mode === "fixed" && reps.kind === "range") setReps(toFixed(reps));
              }}>
                <TabsList className="w-40 shrink-0" aria-label={`Tipo de ${noun}`}>
                  <TabsTrigger value="fixed" className="flex-1" aria-controls={undefined}>Fijo</TabsTrigger>
                  <TabsTrigger value="range" className="flex-1" aria-controls={undefined}>Rango</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {reps.kind === "range" ? (
                <>
                  <Stepper label="Mínimo" name={`Mínimo de ${noun}`} value={reps.min} unit={seconds ? "s" : undefined}
                    min={limits.min} max={Math.max(limits.min, reps.max - limits.step)} step={limits.step}
                    onChange={(n) => setReps({ ...reps, min: n })} />
                  <Stepper label="Máximo" name={`Máximo de ${noun}`} value={reps.max} unit={seconds ? "s" : undefined}
                    min={Math.min(limits.max, reps.min + limits.step)} max={limits.max} step={limits.step}
                    onChange={(n) => setReps({ ...reps, max: n })} />
                </>
              ) : (
                <Stepper name={seconds ? "Segundos" : "Repeticiones"} value={reps.value}
                  text={reps.kind === "text" ? reps.text : undefined} unit={seconds ? "s" : undefined}
                  min={limits.min} max={limits.max} step={limits.step}
                  onChange={(n) => setReps({ kind: "fixed", value: n, unit })} />
              )}
            </div>
          </div>

          {/* Descanso: los rápidos u «Otro» con su contador libre («75 s»). Se guarda «90s», como el generador. */}
          <div className="flex flex-col gap-1.5" role="group" aria-label="Descanso">
            <FieldLabel>Descanso</FieldLabel>
            <div className="grid grid-cols-5 gap-2">
              {RESTS.map((s) => (
                <RestChip key={s} on={chosenRest === s} label={formatRest(s)} spoken={`Descanso de ${formatRestSpoken(s)}`}
                  onClick={() => { setCustomRest(false); if (rest !== s) onChange({ ...ex, rest: restValue(s) }); }} />
              ))}
              <RestChip on={otherRest} label="Otro" spoken="Otro descanso" onClick={() => setCustomRest(true)} />
            </div>
            {otherRest && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Stepper name="Descanso en segundos" value={restBase(ex.rest)}
                  text={rest === null && restText ? restText : undefined} unit={rest === null && restText ? undefined : "s"}
                  min={REST_LIMITS.min} max={REST_LIMITS.max} step={REST_LIMITS.step}
                  onChange={(n) => { setCustomRest(true); onChange({ ...ex, rest: restValue(n) }); }} />
              </div>
            )}
          </div>

          <div className="sep-t flex items-center gap-1 pt-2">
            <button type="button" aria-label={`Subir ${ex.name}`} disabled={index === 0} onClick={() => onMove(-1)}
              className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition active:bg-secondary disabled:opacity-30">
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" aria-label={`Bajar ${ex.name}`} disabled={index === total - 1} onClick={() => onMove(1)}
              className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition active:bg-secondary disabled:opacity-30">
              <ArrowDown className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" aria-label={`Quitar ${ex.name}`} onClick={onRemove}
              className="ml-auto flex h-11 items-center gap-1.5 rounded-full px-4 type-subhead font-semibold text-destructive transition active:opacity-60">
              <Trash2 className="h-4 w-4" aria-hidden /> Quitar
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

export default ExerciseRowEditor;
