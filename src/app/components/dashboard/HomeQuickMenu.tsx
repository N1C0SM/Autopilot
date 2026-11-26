import { Dumbbell, Pencil, Play, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { hapticSelection, hapticTap } from "@/shared/lib/native";

export interface HomeQuickActions {
  /** «Entreno vacío»: eliges los ejercicios y empiezas, sin rutina. */
  onEmptyWorkout: () => void;
  /** «Nueva rutina»: crea una rutina propia (también sin plan todavía). */
  onNewRoutine: () => void;
  /** «Mis rutinas»: abre Entrenar con «Mis rutinas» arriba. */
  onOpenRoutines: () => void;
  /** «Editar plan»: el editor de la rutina. */
  onEditPlan: () => void;
}

/**
 * El «+» redondo de la cabecera de Hoy (junto a la campana): la entrada discreta a Entrenar, que no es
 * pestaña ni fila de la barra lateral. Es `HomeQuickMenu` en la app (iPhone y Mac), con las mismas
 * cuatro opciones en el mismo orden.
 */
const HomeQuickMenu = ({ onEmptyWorkout, onNewRoutine, onOpenRoutines, onEditPlan }: HomeQuickActions) => {
  const run = (action: () => void) => {
    void hapticTap();
    action();
  };
  return (
    // Sin modo modal: al abrir la hoja que elige cada opción no queda la página bloqueada.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Entrenar y rutinas"
          onClick={() => void hapticSelection()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-opacity active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="btn-raised flex h-[30px] w-[30px] items-center justify-center rounded-full bg-secondary">
            <Plus className="h-[17px] w-[17px]" strokeWidth={2.25} aria-hidden="true" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        <DropdownMenuItem onSelect={() => run(onEmptyWorkout)}>
          <Play className="h-4 w-4 text-muted-foreground" fill="currentColor" strokeWidth={0} aria-hidden="true" /> Entreno vacío
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run(onNewRoutine)}>
          <Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Nueva rutina
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => run(onOpenRoutines)}>
          <Dumbbell className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Mis rutinas
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run(onEditPlan)}>
          <Pencil className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Editar plan
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default HomeQuickMenu;
