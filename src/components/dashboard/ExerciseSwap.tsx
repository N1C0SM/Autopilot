import { useState } from "react";
import { ArrowLeftRight, Check, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ExerciseThumb } from "@/components/ExerciseMedia";
import { hapticTap } from "@/lib/native";

interface Props {
  original: string;
  current?: string;
  movementPattern?: string | null;
  muscleGroup?: string | null;
  onSelect: (name: string | null) => void;
}

type Option = { name: string; image: string | null };

export function ExerciseSwap({ original, current, movementPattern, muscleGroup, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);

  const load = async () => {
    if (options || loading) return;
    setLoading(true);
    let query = supabase.from("exercises").select("name, image_url").neq("name", original).limit(4);
    if (movementPattern) query = query.eq("movement_pattern", movementPattern);
    else if (muscleGroup) query = query.eq("muscle_group", muscleGroup);
    const { data } = await query;
    setOptions((data || []).map((row) => ({ name: row.name, image: row.image_url })));
    setLoading(false);
  };

  const choose = (name: string | null) => {
    onSelect(name);
    setOpen(false);
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    // The trigger lives inside the exercise row's <button>: no click from the trigger or the
    // portalled sheet (overlay included) may reach it, or the workout would start.
    <span className="contents" onClick={stop} onKeyDown={stop}>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) void load(); }}>
        <DialogTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            aria-label="Cambiar ejercicio"
            onClick={() => { void hapticTap(); }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-opacity duration-100 active:opacity-60"
          >
            <ArrowLeftRight className="h-5 w-5" strokeWidth={2} />
          </span>
        </DialogTrigger>
        <DialogContent className="gap-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="type-title2 sm:type-title2">Cambiar ejercicio</DialogTitle>
            <DialogDescription>
              ¿Máquina ocupada o molestia? Elige una alternativa. Tus series se mantienen.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner label="Buscando alternativas" />
            </div>
          ) : options?.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title="Sin alternativas"
              description="No hay alternativas en la biblioteca."
              className="py-6 [&>div:first-child]:bg-secondary"
            />
          ) : options ? (
            <ListGroup inset header="Alternativas">
              {options.map((option) => (
                <ListRow
                  key={option.name}
                  leading={<ExerciseThumb image={option.image} name={option.name} size="sm" />}
                  title={<span className="line-clamp-2 whitespace-normal">{option.name}</span>}
                  value={current === option.name ? (
                    <Check className="h-5 w-5 text-primary" strokeWidth={2.5} aria-label="Seleccionado" />
                  ) : undefined}
                  onClick={() => choose(option.name)}
                />
              ))}
            </ListGroup>
          ) : null}

          {current && (
            <ListGroup inset>
              <ListRow
                title={<span className="line-clamp-2 whitespace-normal text-primary">Volver a {original}</span>}
                onClick={() => choose(null)}
              />
            </ListGroup>
          )}
        </DialogContent>
      </Dialog>
    </span>
  );
}
