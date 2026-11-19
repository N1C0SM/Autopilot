import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { SectionHeader } from "@/shared/components/ui/section-header";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/components/ui/drawer";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { useExerciseMetadata } from "@/shared/hooks/useExerciseMetadata";
import { hapticNotify, hapticSelection, hapticTap } from "@/shared/lib/native";
import { routineMeta, routineName, SESSION_LIMIT_MESSAGE } from "@/shared/lib/customRoutines";
import type { DayPlan } from "@/shared/types/training";

/** Miniaturas que se enseñan por rutina; el resto, «+N». */
const THUMBS = 4;

interface Props {
  /** Rutinas del usuario (`myRoutines(dayPlans)`), en el orden de la rutina. */
  routines: DayPlan[];
  /** Ya hay siete sesiones: «Nueva rutina» y «Duplicar» explican por qué no cabe otra. */
  limitReached: boolean;
  /** Sesión con un entreno a medias guardado: su acción pasa a «Continuar entreno». */
  resumableDay?: string | null;
  /** Sesiones hechas hoy: su acción pasa a «Hecha hoy». */
  doneToday?: string[];
  onNew: () => void;
  onStart: (day: string) => void;
  onEdit: (day: string) => void;
  onDuplicate: (day: string) => Promise<boolean>;
  onDelete: (day: string) => Promise<boolean>;
  /** «Ver todas» desde Hoy: al llegar, la sección se pone arriba (como `scrollTo` en la app). */
  focus?: boolean;
}

/**
 * «Mis rutinas» en Entrenar (`MyRoutinesSection` en la app): cada rutina con su nombre, cuántos
 * ejercicios y qué músculos, sus miniaturas (foto o la huella del ejercicio) y «Empezar»; en «···»,
 * «Editar», «Duplicar» y «Borrar» (con hoja de confirmación).
 */
const MyRoutines = ({ routines, limitReached, resumableDay = null, doneToday = [], onNew, onStart, onEdit, onDuplicate, onDelete, focus = false }: Props) => {
  const metadata = useExerciseMetadata(routines);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!focus) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sectionRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [focus]);
  const [deleting, setDeleting] = useState<DayPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const count = routines.length;

  const confirmDelete = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    const ok = await onDelete(deleting.day);
    setBusy(false);
    if (ok) setDeleting(null);
  };

  return (
    <section ref={sectionRef} aria-labelledby="mis-rutinas" className="scroll-mt-20 space-y-3">
      <SectionHeader
        title={<span id="mis-rutinas">Mis rutinas</span>}
        hint={count > 0 ? `${count} ${count === 1 ? "rutina tuya" : "rutinas tuyas"}` : undefined}
        action={(
          <button
            type="button"
            onClick={() => { void hapticTap(); onNew(); }}
            aria-describedby={limitReached ? "mis-rutinas-limite" : undefined}
            className="-my-2 inline-flex min-h-11 items-center gap-1 px-1 type-subhead font-semibold text-primary transition-opacity active:opacity-60"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            Nueva rutina
          </button>
        )}
      />
      {limitReached && (
        <p id="mis-rutinas-limite" role="status" className="px-1 type-footnote text-muted-foreground">{SESSION_LIMIT_MESSAGE}.</p>
      )}

      {count === 0 ? (
        <div className="rounded-card bg-card p-5">
          <p className="type-headline">Crea tu primera rutina</p>
          <p className="mt-1 type-subhead text-muted-foreground">Elige tus ejercicios, series y descansos, y empiézala cuando quieras.</p>
          <Button type="button" variant="secondary" size="lg" className="mt-4 w-full" onClick={() => { void hapticTap(); onNew(); }}>
            <Plus aria-hidden="true" /> Nueva rutina
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {routines.map((routine) => {
            const name = routineName(routine);
            const exercises = routine.exercises ?? [];
            const extra = exercises.length - THUMBS;
            const done = doneToday.includes(routine.day);
            return (
              <li key={routine.day} className="rounded-card bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 type-headline">{name}</h3>
                    <p className="mt-0.5 type-footnote tabular-nums text-muted-foreground">{routineMeta(routine)}</p>
                  </div>
                  {/* Sin modo modal: al abrir la hoja de editar o la de borrar desde el menú no queda la página bloqueada. */}
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Más acciones de ${name}`}
                        onClick={() => void hapticSelection()}
                        className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(routine.day)}>
                        <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={limitReached} onSelect={() => { void onDuplicate(routine.day); }}>
                        <Copy className="h-4 w-4" aria-hidden="true" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => { void hapticNotify("warning"); setDeleting(routine); }}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" /> Borrar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {exercises.length > 0 && (
                  <div aria-hidden="true" className="mt-3 flex items-center gap-2">
                    {exercises.slice(0, THUMBS).map((exercise, index) => {
                      const meta = metadata.byId[exercise.exercise_id] || metadata.byName[exercise.name];
                      return (
                        <ExerciseThumb
                          key={`${exercise.exercise_id}-${index}`}
                          image={meta?.image_url || exercise.image_url}
                          video={meta?.video_url || exercise.video_url}
                          name={exercise.name}
                          muscleGroup={exercise.muscle_group || meta?.muscle_group}
                          pattern={meta?.movement_pattern}
                          stimulus={meta?.stimulus_type}
                          load={meta?.load_level}
                          size="md"
                        />
                      );
                    })}
                    {extra > 0 && (
                      <span className="grid h-12 w-12 place-items-center rounded-[12px] bg-secondary type-footnote font-semibold tabular-nums text-muted-foreground">+{extra}</span>
                    )}
                  </div>
                )}
                {done ? (
                  <p role="status" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary/10 px-4 type-headline text-primary">
                    <Check className="h-4 w-4" aria-hidden="true" />Hecha hoy
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="mt-4 w-full"
                    disabled={exercises.length === 0}
                    aria-label={`${resumableDay === routine.day ? "Continuar" : "Empezar"} ${name}`}
                    onClick={() => { void hapticTap(); onStart(routine.day); }}
                  >
                    {resumableDay === routine.day ? "Continuar entreno" : "Empezar"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Borrar: hoja de confirmación, como «¿Descartar entrenamiento?». */}
      <Drawer open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="px-5 pt-4 text-center">
            <DrawerTitle>{`¿Borrar «${deleting ? routineName(deleting) : ""}»?`}</DrawerTitle>
            <DrawerDescription>Se quita de tu plan. Tu historial y tus récords se quedan como están.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="gap-2 px-5 pb-5">
            <Button size="lg" variant="destructive" className="min-h-11 w-full font-semibold" disabled={busy} onClick={() => void confirmDelete()}>
              {busy ? "Borrando…" : "Borrar rutina"}
            </Button>
            <Button size="lg" variant="ghost" className="min-h-11 w-full font-semibold" onClick={() => { void hapticSelection(); setDeleting(null); }}>
              Cancelar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </section>
  );
};

/**
 * «Mis rutinas» en Hoy: hasta tres filas (miniatura, nombre y resumen) que llevan a Entrenar, con
 * «Ver todas» en la cabecera. Es `routinesSection` en `HomeView.swift`.
 */
export const RoutinesPreview = ({ routines, onOpen }: { routines: DayPlan[]; onOpen: () => void }) => {
  const metadata = useExerciseMetadata(routines);
  if (routines.length === 0) return null;
  return (
    <section aria-labelledby="hoy-mis-rutinas">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 id="hoy-mis-rutinas" className="type-title3">Mis rutinas</h3>
        <button type="button" onClick={() => { void hapticTap(); onOpen(); }} className="-my-3 ml-auto min-h-11 px-1 type-subhead font-semibold text-primary active:opacity-60">
          Ver todas
        </button>
      </div>
      <div className="overflow-hidden rounded-card bg-card">
        {routines.slice(0, 3).map((routine, index) => {
          const first = routine.exercises?.[0];
          const meta = first ? metadata.byId[first.exercise_id] || metadata.byName[first.name] : undefined;
          return (
            <button
              key={routine.day}
              type="button"
              onClick={() => { void hapticTap(); onOpen(); }}
              aria-label={`${routineName(routine)}: ${routineMeta(routine)}`}
              className="relative flex min-h-[76px] w-full items-center gap-3.5 px-3.5 py-2.5 text-left transition-colors active:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              {index > 0 && <span aria-hidden="true" className="absolute left-3.5 right-3.5 top-0 h-px bg-border/60" />}
              <ExerciseThumb
                image={meta?.image_url || first?.image_url}
                video={meta?.video_url || first?.video_url}
                name={first?.name ?? routineName(routine)}
                muscleGroup={first?.muscle_group || meta?.muscle_group}
                pattern={meta?.movement_pattern}
                stimulus={meta?.stimulus_type}
                load={meta?.load_level}
                size="md"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate type-headline">{routineName(routine)}</span>
                <span className="mt-0.5 block truncate type-footnote tabular-nums text-muted-foreground">{routineMeta(routine)}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default MyRoutines;
