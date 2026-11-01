import { useState, useEffect, useRef } from "react";
import { Search, Dumbbell, X, Plus } from "lucide-react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { Spinner } from "@/shared/components/ui/spinner";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { hapticTap, hapticSelection } from "@/shared/lib/native";

interface Exercise {
  name: string;
  muscle_group: string | null;
  exercise_type: string | null;
  movement_pattern: string | null;
  stimulus_type: string | null;
  load_level: string | null;
  image_url: string | null;
  tracking_mode: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
  /** Ejercicios ya añadidos (para marcarlos) */
  added?: string[];
}

const MUSCLE_GROUPS = [
  "Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps",
  "Piernas", "Glúteos", "Abdominales", "Isquiotibiales", "Gemelos",
];

export function FreeWorkoutPicker({ open, onClose, onAdd, added = [] }: Props) {
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [results, setResults] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Buscar cada vez que cambia el texto o el filtro
  useEffect(() => {
    if (!open) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const run = async () => {
      setLoading(true);
      let query = supabase
        .from("exercises")
        .select("name, muscle_group, exercise_type, movement_pattern, stimulus_type, load_level, image_url, tracking_mode")
        .order("recommended_order", { ascending: true, nullsFirst: false })
        .order("name")
        .limit(40);

      if (search.trim()) {
        query = query.ilike("name", `%${search.trim()}%`);
      }
      if (muscle) {
        query = query.eq("muscle_group", muscle);
      }

      const { data } = await query;
      if (controller.signal.aborted) return;
      setResults((data || []) as Exercise[]);
      setLoading(false);
    };

    // Debounce 200ms para el texto
    const timer = setTimeout(() => void run(), search ? 200 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, search, muscle]);

  // Foco al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch("");
      setMuscle(null);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="bottom"
        className="flex h-[85dvh] flex-col rounded-t-[20px] p-0"
      >
        <SheetHeader className="shrink-0 px-5 pb-0 pt-5">
          <SheetTitle className="type-title2 text-left">Añadir ejercicio</SheetTitle>
        </SheetHeader>

        {/* Barra de búsqueda */}
        <div className="shrink-0 px-4 pt-3">
          <div className="flex items-center gap-2 rounded-media bg-secondary px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ejercicio…"
              className="h-10 flex-1 bg-transparent type-body outline-none placeholder:text-muted-foreground/60"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {search && (
              <button
                type="button"
                onClick={() => { void hapticTap(); setSearch(""); }}
                className="shrink-0 text-muted-foreground"
                aria-label="Borrar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filtros de músculo */}
        <div className="no-scrollbar shrink-0 flex gap-2 overflow-x-auto px-4 py-2">
          <button
            type="button"
            onClick={() => { void hapticSelection(); setMuscle(null); }}
            className={`shrink-0 rounded-full px-3 py-1.5 type-footnote font-medium transition-colors ${
              !muscle ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            Todos
          </button>
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => { void hapticSelection(); setMuscle(muscle === g ? null : g); }}
              className={`shrink-0 rounded-full px-3 py-1.5 type-footnote font-medium transition-colors ${
                muscle === g ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Lista de resultados */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner label="Buscando ejercicios" />
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Dumbbell className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
              <p className="type-subhead text-muted-foreground">Sin resultados</p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {results.map((ex) => {
                const isAdded = added.includes(ex.name);
                return (
                  <li key={ex.name}>
                    <button
                      type="button"
                      onClick={() => {
                        void hapticTap();
                        if (!isAdded) onAdd(ex);
                      }}
                      className="flex w-full items-center gap-3 rounded-media px-3 py-2.5 text-left transition-colors active:bg-secondary disabled:opacity-50"
                      disabled={isAdded}
                      aria-label={`Añadir ${ex.name}${isAdded ? " (ya añadido)" : ""}`}
                    >
                      <ExerciseThumb
                        image={ex.image_url}
                        name={ex.name}
                        pattern={ex.movement_pattern}
                        stimulus={ex.stimulus_type}
                        load={ex.load_level}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate type-subhead font-medium ${isAdded ? "text-muted-foreground" : ""}`}>
                          {ex.name}
                        </p>
                        {(ex.muscle_group || ex.exercise_type) && (
                          <p className="truncate type-footnote text-muted-foreground">
                            {[ex.muscle_group, ex.exercise_type].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      {isAdded ? (
                        <span className="shrink-0 type-footnote text-muted-foreground">Añadido</span>
                      ) : (
                        <Plus className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
