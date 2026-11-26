import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Copy, MoreHorizontal, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { Spinner } from "@/shared/components/ui/spinner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/components/ui/drawer";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { useExerciseMetadata } from "@/shared/hooks/useExerciseMetadata";
import { hapticNotify, hapticSelection, hapticTap } from "@/shared/lib/native";
import { AUTOPILOT_FILL, autopilotFillSummary, routineMeta, routineName, SESSION_LIMIT_MESSAGE } from "@/shared/lib/customRoutines";
import { keptRoutinesTitle, SHIELD_COPY } from "@/shared/lib/planShield";
import type { DayPlan } from "@/shared/types/training";

/** Miniaturas que se enseñan por rutina (en la fila de «Empezar»); el resto, «+N». */
const THUMBS = 3;

/**
 * «Completar con el autopiloto»: lo ofrece Entrenar cuando `canCompleteWithAutopilot` (plan todo tuyo
 * y menos sesiones que tus días de entreno). Es `MyRoutinesSection.Autopilot` en la app.
 */
export interface AutopilotOffer {
  /** Sesiones tuyas y tus días de entreno: «Tus rutinas cubren 2 de tus 4 días de entreno». */
  own: number;
  frequency: number;
  /** generate-plan alrededor de tus rutinas y el plan se vuelve a leer: cuántas respetó, o null si falló. */
  onComplete: () => Promise<number | null>;
}

type FillState =
  | { status: "idle" }
  | { status: "running"; own: number; frequency: number }
  | { status: "done"; kept: number }
  | { status: "error" };

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
  /** «Completar con el autopiloto» (fila secundaria bajo tus rutinas); null si no se ofrece. */
  autopilot?: AutopilotOffer | null;
}

/**
 * «Mis rutinas» en Entrenar (`MyRoutinesSection` en la app): «Nueva rutina» como píldora tranquila junto
 * al título y cada rutina en una tarjeta compacta (nombre, cuántos ejercicios y qué músculos, tres
 * miniaturas con «+N» y una sola acción, «Empezar»); en «···», «Editar», «Duplicar» y «Borrar» (con hoja
 * de confirmación).
 */
const MyRoutines = ({ routines, limitReached, resumableDay = null, doneToday = [], onNew, onStart, onEdit, onDuplicate, onDelete, focus = false, autopilot = null }: Props) => {
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

  // «Completar con el autopiloto»: el plan nuevo ya no lo pide, así que el aviso de cómo fue se queda
  // en su sitio (y la carga también, aunque el plan se refresque antes de terminar).
  const [fill, setFill] = useState<FillState>({ status: "idle" });
  const completeWithAutopilot = async () => {
    if (!autopilot || fill.status === "running") return;
    void hapticTap();
    setFill({ status: "running", own: autopilot.own, frequency: autopilot.frequency });
    let kept: number | null = null;
    try { kept = await autopilot.onComplete(); } catch { kept = null; }
    if (kept === null) {
      void hapticNotify("error");
      setFill({ status: "error" });
      return;
    }
    void hapticNotify("success");
    setFill({ status: "done", kept: kept > 0 ? kept : autopilot.own });
  };
  const showFill = autopilot !== null || fill.status === "running" || fill.status === "done";

  return (
    <section ref={sectionRef} aria-labelledby="mis-rutinas" className="scroll-mt-20 space-y-3">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h3 id="mis-rutinas" className="type-title3">Mis rutinas</h3>
        {/* Con rutinas, «Nueva rutina» es una píldora tranquila; sin ninguna, la tarjeta de abajo ya la ofrece. */}
        {count > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 font-semibold"
            onClick={() => { void hapticTap(); onNew(); }}
            aria-describedby={limitReached ? "mis-rutinas-limite" : undefined}
          >
            <Plus aria-hidden="true" /> Nueva rutina
          </Button>
        )}
      </div>
      {limitReached && (
        <p id="mis-rutinas-limite" role="status" className="px-1 type-footnote text-muted-foreground">{SESSION_LIMIT_MESSAGE}.</p>
      )}

      {count === 0 ? (
        <div className="rounded-card bg-card p-5">
          <p className="type-headline">Crea tu primera rutina</p>
          <p className="mt-1 type-subhead text-muted-foreground">Elige tus ejercicios, series y descansos, y empiézala cuando quieras.</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4 font-semibold"
            aria-describedby={limitReached ? "mis-rutinas-limite" : undefined}
            onClick={() => { void hapticTap(); onNew(); }}
          >
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
                    <h4 className="line-clamp-2 break-words type-headline">{name}</h4>
                    <p className="mt-0.5 line-clamp-2 type-footnote tabular-nums text-muted-foreground">{routineMeta(routine)}</p>
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
                {/* Una sola fila: sus miniaturas y la acción. Con letra grande, la miniatura que no cabe entera
                    baja a una segunda línea oculta (nunca se ve cortada ni aplasta el botón). */}
                <div className="mt-3 flex items-center gap-3">
                  <div aria-hidden="true" className="flex h-10 min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
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
                          size="sm"
                        />
                      );
                    })}
                    {extra > 0 && (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-secondary type-footnote font-semibold tabular-nums text-muted-foreground">+{extra}</span>
                    )}
                  </div>
                  {done ? (
                    <p role="status" className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-4 type-subhead font-semibold text-primary">
                      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />Hecha hoy
                    </p>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0 px-5"
                      disabled={exercises.length === 0}
                      aria-label={`${resumableDay === routine.day ? "Continuar" : "Empezar"} ${name}`}
                      onClick={() => { void hapticTap(); onStart(routine.day); }}
                    >
                      {resumableDay === routine.day ? "Continuar" : "Empezar"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showFill && (
        <AutopilotFillCard
          status={fill.status}
          own={fill.status === "running" ? fill.own : autopilot?.own ?? 0}
          frequency={fill.status === "running" ? fill.frequency : autopilot?.frequency ?? 0}
          kept={fill.status === "done" ? fill.kept : 0}
          onRun={() => void completeWithAutopilot()}
        />
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
 * Tarjeta compacta bajo tus rutinas (secundaria: la acción dorada de la pantalla es «Empezar sesión»):
 * cuánto cubren tus rutinas y «Completar con el autopiloto»; mientras trabaja, el AP latiendo; al
 * terminar, «Hemos respetado tus N rutinas»; si falla, el aviso de error con «Reintentar». Igual que en la app.
 */
const AutopilotFillCard = ({ status, own, frequency, kept, onRun }: {
  status: FillState["status"];
  own: number;
  frequency: number;
  kept: number;
  onRun: () => void;
}) => {
  const running = status === "running";
  return (
    <div className="rounded-card bg-card p-4">
      {status === "done" ? (
        <div role="status" className="flex items-start gap-3">
          <IconTile icon={Check} size="md" />
          <div className="min-w-0 flex-1">
            <p className="type-headline">{keptRoutinesTitle(kept)}</p>
            <p className="mt-0.5 type-footnote text-muted-foreground">{SHIELD_COPY.description}</p>
          </div>
        </div>
      ) : status === "error" ? (
        <div role="alert">
          <div className="flex items-start gap-3">
            <IconTile icon={TriangleAlert} size="md" tone="destructive" />
            <div className="min-w-0 flex-1">
              <p className="type-headline">{AUTOPILOT_FILL.errorTitle}</p>
              <p className="mt-0.5 type-footnote text-muted-foreground">{AUTOPILOT_FILL.errorDetail}</p>
            </div>
          </div>
          <Button type="button" variant="secondary" className="mt-3 w-full" onClick={onRun}>
            {AUTOPILOT_FILL.retry}
          </Button>
        </div>
      ) : (
        <>
          <p className="type-headline tabular-nums">{autopilotFillSummary(own, frequency)}</p>
          <p className="mt-0.5 type-footnote text-muted-foreground">{AUTOPILOT_FILL.detail}</p>
          {/* Sin `disabled` mientras trabaja: el AP se ve entero, no apagado; un segundo toque no hace nada.
              Con letra grande, el texto baja de línea dentro de la píldora en vez de salirse. */}
          <Button
            type="button"
            variant="secondary"
            className="mt-3 h-auto min-h-11 w-full whitespace-normal px-5 py-2.5 text-center"
            aria-disabled={running || undefined}
            aria-busy={running || undefined}
            onClick={running ? undefined : onRun}
          >
            {running ? (
              <>
                <Spinner size="sm" aria-hidden="true" />
                {AUTOPILOT_FILL.running}
              </>
            ) : AUTOPILOT_FILL.action}
          </Button>
        </>
      )}
    </div>
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
