import { useEffect, useMemo, useState } from "react";
import { Search, WifiOff } from "lucide-react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { SearchPill } from "@/shared/components/ui/search-pill";
import { Spinner } from "@/shared/components/ui/spinner";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { exerciseCount } from "@/shared/lib/exerciseLibrary";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import type { GymExerciseEntry } from "@/shared/types/training";
import ResponsiveSheet from "@/app/components/dashboard/ResponsiveSheet";

interface Row {
  id: string;
  name: string;
  muscle_group: string | null;
  exercise_type: string | null;
  movement_pattern: string | null;
  stimulus_type: string | null;
  load_level: string | null;
  image_url: string | null;
  video_url: string | null;
  tracking_mode: string | null;
  fatigue_level: string | null;
}

let cache: Row[] | null = null;

/** Modalidad y grupo, en el mismo orden que `ExercisePickerView.types` y `.groups` en la app. */
const GROUPS = ["Todos", "Pecho", "Espalda", "Hombros", "Piernas", "Glúteos", "Isquiotibiales", "Bíceps", "Tríceps", "Core", "Gemelos"];
const TYPES = ["Todo", "Gimnasio", "Calistenia"];

export const toEntry = (r: Row): GymExerciseEntry => ({
  exercise_id: r.id,
  name: r.name,
  series: 3,
  reps: 10,
  weight: "",
  rest: "90 s",
  image_url: r.image_url,
  video_url: r.video_url,
  muscle_group: r.muscle_group,
  exercise_type: r.exercise_type,
  fatigue_level: r.fatigue_level,
  tracking_mode: (r.tracking_mode as GymExerciseEntry["tracking_mode"]) ?? null,
});

const norm = (t: string) => t.toLocaleLowerCase("es-ES").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama con todos los ejercicios elegidos, en el orden en que se tocaron. */
  onPick: (entries: GymExerciseEntry[]) => void;
  /** Nombres ya presentes en la sesión, para marcarlos. */
  existing?: string[];
}

const ExercisePicker = ({ open, onOpenChange, onPick, existing = [] }: Props) => {
  const [rows, setRows] = useState<Row[]>(cache ?? []);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("Todos");
  const [type, setType] = useState("Todo");
  const [picked, setPicked] = useState<Row[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { if (open) { setPicked([]); setQ(""); } }, [open]);

  useEffect(() => {
    // La caché pinta al instante, pero cada apertura revalida para recoger
    // ejercicios nuevos o fotos editadas en la biblioteca sin recargar.
    if (!open) return;
    let alive = true;
    setFailed(false);
    void supabase
      .from("exercises")
      .select("id,name,muscle_group,exercise_type,movement_pattern,stimulus_type,load_level,image_url,video_url,tracking_mode,fatigue_level")
      .order("name")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) { setFailed(true); return; }
        cache = data as Row[];
        setRows(cache);
      });
    return () => { alive = false; };
  }, [open, attempt]);

  const list = useMemo(() => {
    const term = norm(q.trim());
    return rows
      .filter((r) => group === "Todos" || r.muscle_group === group)
      .filter((r) => type === "Todo" || r.exercise_type === type || (type === "Calistenia" && r.exercise_type === "Mixto"))
      .filter((r) => !term || norm(r.name).includes(term) || norm(r.muscle_group ?? "").includes(term))
      .slice(0, 120);
  }, [rows, q, group, type]);

  const toggle = (r: Row) => {
    void hapticSelection();
    setPicked((p) => (p.some((x) => x.id === r.id) ? p.filter((x) => x.id !== r.id) : [...p, r]));
  };

  const confirm = () => {
    if (!picked.length) return;
    void hapticTap();
    onPick(picked.map(toEntry));
    onOpenChange(false);
  };

  // Mismo chip que los filtros de la biblioteca: dorado suave el activo, gris el resto.
  const chip = (active: boolean) =>
    cn(
      "flex h-10 shrink-0 items-center rounded-full px-4 type-footnote font-semibold transition active:opacity-60",
      active ? "bg-primary/15 text-primary" : "bg-secondary text-foreground",
    );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Añadir ejercicios"
      description="Toca todos los que quieras y añádelos de una vez."
      desktopClassName="sm:max-w-2xl"
      footer={
        // La única acción dorada: «Añadir 3 ejercicios» (o «Elige ejercicios» mientras no hay ninguno).
        <Button type="button" variant="hero" size="lg" className="min-h-12 w-full" disabled={!picked.length} onClick={confirm}>
          {picked.length ? `Añadir ${exerciseCount(picked.length)}` : "Elige ejercicios"}
        </Button>
      }
    >
      <SearchPill value={q} onChange={setQ} placeholder="Buscar por nombre o músculo" />
      <div className="-mx-1 mt-3 flex shrink-0 items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtros">
        {TYPES.map((t) => (
          <button key={t} type="button" aria-pressed={type === t} onClick={() => { void hapticSelection(); setType(t); }} className={chip(type === t)}>{t}</button>
        ))}
        <span className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden />
        {GROUPS.map((g) => (
          <button key={g} type="button" aria-pressed={group === g} onClick={() => { void hapticSelection(); setGroup(g); }} className={chip(group === g)}>{g}</button>
        ))}
      </div>
      <div className="-mx-1 mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-2">
        {failed ? (
          <EmptyState
            icon={WifiOff}
            title="No hemos podido cargar los ejercicios"
            description="Revisa tu conexión y vuelve a intentarlo."
            action={<Button type="button" variant="secondary" size="lg" onClick={() => setAttempt((n) => n + 1)}>Reintentar</Button>}
          />
        ) : rows.length === 0 && !cache ? (
          // La firma de marca (el AP latiendo), nunca bloques grises.
          <div className="flex flex-col items-center gap-3 py-12" aria-busy="true">
            <Spinner size="lg" label="Cargando ejercicios" />
            <p className="type-footnote text-muted-foreground" aria-hidden>Cargando ejercicios…</p>
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon={Search} title="Prueba con otro nombre" description="Busca por ejercicio o músculo, o quita algún filtro." />
        ) : (
          // Filas en un grupo sin borde, como la biblioteca.
          <ul className="overflow-hidden rounded-[22px] bg-card">
            {list.map((r) => {
              const sel = picked.findIndex((x) => x.id === r.id);
              const inSession = existing.includes(r.name);
              const info = [r.muscle_group, r.exercise_type, inSession ? "Ya en la sesión" : null].filter(Boolean).join(" · ");
              return (
                <li key={r.id} className="group/row">
                  <button
                    type="button"
                    aria-pressed={sel >= 0}
                    aria-label={info ? `${r.name}, ${info}` : r.name}
                    disabled={inSession}
                    onClick={() => toggle(r)}
                    className={cn(
                      "flex w-full items-center gap-3 pl-3 text-left transition-colors duration-150 disabled:opacity-50",
                      sel >= 0 ? "bg-primary/10" : "active:bg-accent",
                    )}
                  >
                    <span className="py-2.5">
                      <ExerciseThumb image={r.image_url ?? undefined} video={r.video_url} name={r.name} pattern={r.movement_pattern} stimulus={r.stimulus_type} load={r.load_level} muscleGroup={r.muscle_group} size="md" />
                    </span>
                    {/* El separador nace donde empieza el texto, como en la biblioteca. */}
                    <span className="flex min-w-0 flex-1 items-center gap-3 self-stretch py-2.5 pr-3 group-[:not(:last-child)]/row:sep-b">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate type-headline">{r.name}</span>
                        {info && <span className="block truncate type-footnote text-muted-foreground">{info}</span>}
                      </span>
                      {/* Círculo de selección: dorado con el orden en que se tocó, o un aro gris. */}
                      <span aria-hidden className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full type-footnote font-bold tabular-nums",
                        sel >= 0 ? "bg-primary text-primary-foreground" : "border-[1.5px] border-muted-foreground/40",
                      )}>
                        {sel >= 0 ? sel + 1 : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ResponsiveSheet>
  );
};

export default ExercisePicker;
