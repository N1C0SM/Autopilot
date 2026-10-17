import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExerciseThumb } from "@/components/ExerciseMedia";
import { hapticSelection, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";
import type { GymExerciseEntry } from "@/types/training";
import ResponsiveSheet from "./ResponsiveSheet";

interface Row {
  id: string;
  name: string;
  muscle_group: string | null;
  exercise_type: string | null;
  image_url: string | null;
  video_url: string | null;
  tracking_mode: string | null;
  fatigue_level: string | null;
}

let cache: Row[] | null = null;

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

  useEffect(() => { if (open) { setPicked([]); setQ(""); } }, [open]);

  useEffect(() => {
    if (!open || cache) return;
    void supabase
      .from("exercises")
      .select("id,name,muscle_group,exercise_type,image_url,video_url,tracking_mode,fatigue_level")
      .order("name")
      .then(({ data }) => {
        cache = (data as Row[]) ?? [];
        setRows(cache);
      });
  }, [open]);

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

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors md:py-1.5",
      active ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
    );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Añadir ejercicios"
      description="Toca todos los que quieras y añádelos de una vez."
      desktopClassName="sm:max-w-3xl"
      footer={
        <Button type="button" variant="hero" size="lg" className="min-h-12 w-full" disabled={!picked.length} onClick={confirm}>
          {picked.length ? `Añadir ${picked.length} ${picked.length === 1 ? "ejercicio" : "ejercicios"}` : "Elige ejercicios"}
        </Button>
      }
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o músculo" className="h-11 pl-9" aria-label="Buscar ejercicio" />
      </div>
      <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Material">
        {TYPES.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => { void hapticSelection(); setType(t); }} className={chip(type === t)}>{t}</button>
        ))}
        <span className="mx-1 w-px shrink-0 bg-border" aria-hidden />
        {GROUPS.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => { void hapticSelection(); setGroup(g); }} className={chip(group === g)}>{g}</button>
        ))}
      </div>
      <ul className="-mx-2 mt-2 grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-0.5 overflow-y-auto overscroll-contain md:grid-cols-2 md:gap-1">
        {rows.length === 0 && Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="m-2 h-12 animate-pulse rounded-xl bg-muted/40" />
        ))}
        {list.map((r) => {
          const sel = picked.findIndex((x) => x.id === r.id);
          const inSession = existing.includes(r.name);
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={sel >= 0}
                onClick={() => toggle(r)}
                className={cn(
                  "flex min-h-[60px] w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
                  sel >= 0 ? "bg-primary/10" : "hover:bg-muted/50 active:bg-muted/60",
                )}
              >
                <ExerciseThumb image={r.image_url ?? undefined} video={r.video_url ?? undefined} name={r.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[r.muscle_group, r.exercise_type, inSession ? "Ya en la sesión" : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
                  sel >= 0 ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent",
                )}>
                  {sel >= 0 ? sel + 1 : <Check className="h-3.5 w-3.5" aria-hidden />}
                </span>
              </button>
            </li>
          );
        })}
        {rows.length > 0 && list.length === 0 && (
          <li className="col-span-full py-10 text-center text-sm text-muted-foreground">Sin resultados. Prueba otro nombre o quita filtros.</li>
        )}
      </ul>
    </ResponsiveSheet>
  );
};

export default ExercisePicker;
