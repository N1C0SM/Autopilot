import { useState } from "react";
import { ArrowLeftRight, Check, Dumbbell } from "lucide-react";
import { supabase } from "@/shared/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { Spinner } from "@/shared/components/ui/spinner";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { hapticTap } from "@/shared/lib/native";

interface Props {
  original: string;
  current?: string;
  movementPattern?: string | null;
  muscleGroup?: string | null;
  onSelect: (name: string | null) => void;
}

type Option = { name: string; image: string | null };

const GYM_GEAR_RE = /polea|cable|mancuerna|dumbbell|kettlebell|pesa rusa|goblet|barra|m[aá]quina|prensa|smith|multipower|landmine|lastr|disco|trap bar|glute-ham|farmer/i;
const BAR_OK_RE = /en barra|barra fija|dominad|pull-?up|chin-?up|muscle/i;

export function isAllowedForStyle(style: string, type: string | null, name: string): boolean {
  if (style === "Calistenia") {
    if (type === "Gimnasio") return false;
    return !GYM_GEAR_RE.test(name) || (BAR_OK_RE.test(name) && !/lastr|polea|mancuerna/i.test(name));
  }
  if (style === "Gimnasio") return type !== "Calistenia" || !/planche|pino|handstand|frog|lever/i.test(name);
  return true;
}

export function ExerciseSwap({ original, current, movementPattern, muscleGroup, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);

  const [failed, setFailed] = useState(false);

  const load = async () => {
    if (options || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      // Respect the user's discipline: calisthenics users never get gym gear, gym users get gym first.
      // If the discipline can't be read we fail instead of guessing, so weights never leak into calisthenics.
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      let style = "Mixto";
      if (auth.user) {
        const { data: ob, error: obError } = await supabase.from("onboarding").select("equipment_type").eq("user_id", auth.user.id).maybeSingle();
        if (obError) throw obError;
        if (ob?.equipment_type) style = ob.equipment_type;
      }
      let query = supabase.from("exercises").select("name, image_url, muscle_group, exercise_type").neq("name", original).limit(60);
      if (movementPattern) query = query.eq("movement_pattern", movementPattern);
      else if (muscleGroup) query = query.eq("muscle_group", muscleGroup);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []).filter((row) => isAllowedForStyle(style, row.exercise_type, row.name));
      const score = (row: { muscle_group: string | null; exercise_type: string | null }) =>
        (muscleGroup && row.muscle_group === muscleGroup ? 2 : 0) + (row.exercise_type === style ? 1 : 0);
      rows.sort((a, b) => score(b) - score(a));
      setOptions(rows.slice(0, 6).map((row) => ({ name: row.name, image: row.image_url })));
    } catch {
      // Leave options empty so reopening the sheet retries; never spin forever.
      setFailed(true);
    } finally {
      setLoading(false);
    }
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
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-opacity duration-150 active:opacity-60"
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
          ) : failed ? (
            <EmptyState
              icon={Dumbbell}
              title="No se pudieron cargar"
              description="Revisa la conexión y vuelve a abrir para reintentar."
              className="py-6 [&>div:first-child]:bg-secondary"
            />
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
