import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ExerciseThumb } from "@/components/ExerciseMedia";
import { hapticSelection } from "@/lib/native";
import { cn } from "@/lib/utils";
import type { GymExerciseEntry } from "@/types/training";

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

const GROUPS = ["Todos", "Pecho", "Espalda", "Hombros", "Piernas", "Glúteos", "Bíceps", "Tríceps", "Core"];

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (entry: GymExerciseEntry) => void;
}

const ExercisePicker = ({ open, onOpenChange, onPick }: Props) => {
  const [rows, setRows] = useState<Row[]>(cache ?? []);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("Todos");

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
    const term = q.trim().toLocaleLowerCase("es-ES");
    return rows
      .filter((r) => group === "Todos" || r.muscle_group === group)
      .filter((r) => !term || r.name.toLocaleLowerCase("es-ES").includes(term))
      .slice(0, 80);
  }, [rows, q, group]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-3 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir ejercicio</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ejercicio" className="pl-9" aria-label="Buscar ejercicio" />
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Grupo muscular">
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={group === g}
              onClick={() => { void hapticSelection(); setGroup(g); }}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
                group === g ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground",
              )}
            >
              {g}
            </button>
          ))}
        </div>
        <ul className="-mx-2 flex-1 overflow-y-auto">
          {list.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => { void hapticSelection(); onPick(toEntry(r)); onOpenChange(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/50"
              >
                <ExerciseThumb image={r.image_url ?? undefined} video={r.video_url ?? undefined} name={r.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[r.muscle_group, r.exercise_type].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {rows.length > 0 && list.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">Sin resultados</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
};

export default ExercisePicker;
