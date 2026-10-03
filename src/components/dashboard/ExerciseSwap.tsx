import { useState } from "react";
import { ArrowLeftRight, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  original: string;
  current?: string;
  movementPattern?: string | null;
  muscleGroup?: string | null;
  onSelect: (name: string | null) => void;
}

export function ExerciseSwap({ original, current, movementPattern, muscleGroup, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<string[] | null>(null);

  const load = async () => {
    if (options || loading) return;
    setLoading(true);
    let query = supabase.from("exercises").select("name").neq("name", original).limit(4);
    if (movementPattern) query = query.eq("movement_pattern", movementPattern);
    else if (muscleGroup) query = query.eq("muscle_group", muscleGroup);
    const { data } = await query;
    setOptions((data || []).map((row) => row.name));
    setLoading(false);
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) void load(); }}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label="Cambiar ejercicio"
          onClick={stop}
          onKeyDown={stop}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2" onClick={stop}>
        <p className="px-2 pb-1 pt-1 text-xs font-semibold">¿Máquina ocupada o molestia?</p>
        <p className="px-2 pb-2 text-[11px] text-muted-foreground">Cambia por una alternativa. Tus series se mantienen.</p>
        {loading && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>}
        {options?.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No hay alternativas en la biblioteca.</p>}
        {options?.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => { onSelect(name); setOpen(false); }}
            className={`block w-full truncate rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary ${current === name ? "text-primary font-semibold" : ""}`}
          >
            {name}
          </button>
        ))}
        {current && (
          <button type="button" onClick={() => { onSelect(null); setOpen(false); }} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-muted-foreground hover:bg-secondary">
            <RotateCcw className="h-3.5 w-3.5" /> Volver a {original}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
