import { useEffect, useState, type ReactNode, type SyntheticEvent } from "react";
import { BookOpen, CalendarDays, Check, ChevronRight, Clock, Flame, Pencil, Play } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ListRow } from "@/shared/components/ui/list";
import { cn } from "@/shared/lib/utils";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import type { DayPlan } from "@/shared/types/training";
import { formatTrainingTitle } from "@/shared/lib/trainingDisplay";
import { restLabel } from "@/shared/lib/planEditorValues";
import { planModeLine } from "@/shared/lib/customRoutines";
import { sessionLine, sessionMuscles, sessionName } from "@/shared/lib/sessionSummary";
import AIDisclaimer from "@/shared/components/AIDisclaimer";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import ExerciseFocus from "@/app/components/ExerciseFocus";
import { useExerciseMetadata } from "@/shared/hooks/useExerciseMetadata";
import { cachedSessionCover, useSessionCover } from "@/shared/hooks/useSessionCover";
import { BRAND_PHOTOS, useBrandPhotos } from "@/shared/lib/brandPhotos";
import { fastImage, THUMB_SIDE } from "@/shared/lib/fastImage";
import { doneSessionCount, nextPendingSession, routineSessions } from "@/shared/lib/routineOrder";
import { cleanSessionIcon } from "@/shared/lib/sessionIdentity";
import SessionIdentitySheet from "@/app/components/dashboard/SessionIdentitySheet";

interface Props {
  dayPlans: DayPlan[];
  /** Sesión que debe abrirse al entrar (la clave `day` de la sesión pulsada en «Hoy»). */
  initialDay?: string;
  /** Claves de las sesiones hechas esta semana (`day_completions.day_label`). */
  doneThisWeek?: string[];
  /** Claves de las sesiones completadas hoy. */
  doneToday?: string[];
  /** Día de la rutina que tiene un borrador de entreno recuperable. */
  resumableDay?: string | null;
  onOpenWorkout?: (day: string) => void;
  /** Cabecera: «Entreno vacío» y «Ejercicios», las dos píldoras tranquilas bajo el modo del plan. */
  onEmptyWorkout?: () => void;
  onOpenLibrary?: () => void;
  /** «Editar» junto a «Esta semana» (y en el plan sin sesiones): el editor del plan. */
  onEditPlan?: () => void;
  /** Guarda el nombre y el icono de una sesión («Nombre e icono»); false si no se pudo. */
  onPersonalize?: (day: string, identity: { name: string; icon: string | null }) => Promise<boolean>;
  /** «Mis rutinas» (rutinas propias con «Empezar» y, en «···», Editar, Duplicar y Borrar): va bajo las sesiones. */
  routines?: ReactNode;
}

const sessionTitle = (plan: DayPlan) =>
  plan.type === "gimnasio"
    ? formatTrainingTitle(plan.routine_name, plan.muscle_focus) || "Entrenamiento"
    : plan.sport || "Actividad";

/** Estado de la sesión en la lista: hecha esta semana, la de hoy (la que propone Hoy) o la siguiente. */
type SessionState = "done" | "today" | "next" | null;
const STATE_SPOKEN: Record<Exclude<SessionState, null>, string> = { done: "hecha esta semana", today: "para hoy", next: "siguiente" };

/** Píldora tranquila de la cabecera (secundaria, con relieve): «Entreno vacío» y «Ejercicios». */
const QuietPill = ({ icon: Icon, label, onClick }: { icon: typeof Play; label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={() => { void hapticTap(); onClick(); }}
    className="btn-raised flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-secondary px-4 type-subhead font-semibold transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
    {label}
  </button>
);

interface SessionRowProps {
  number: number;
  plan: DayPlan;
  state: SessionState;
  expanded: boolean;
  /** Foto de respaldo (portada propia o en caché, foto del primer ejercicio o foto de marca). */
  photo: string | null;
  muscles: string;
  onSelect: () => void;
}

// Fila de la lista: miniatura, nombre, músculos y «6 ejercicios · ≈ 45 min», con su estado a la
// derecha («Hoy», «Hecha» o «Siguiente»). Sin días de la semana: cualquier sesión se hace el día que
// venga bien. Solo la fila abierta pide la portada con IA; las demás usan la caché o su respaldo.
const SessionRow = ({ number, plan, state, expanded, photo, muscles, onSelect }: SessionRowProps) => {
  const gym = plan.type === "gimnasio";
  const ids = gym && expanded && !plan.cover_url ? (plan.exercises ?? []).map((exercise) => exercise.exercise_id) : [];
  const cover = useSessionCover(ids, photo);
  const name = sessionName(sessionTitle(plan));
  const line = sessionLine(plan);
  const emoji = cleanSessionIcon(plan.session_icon);
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={`Sesión ${number}: ${name}${muscles ? `, ${muscles}` : ""}, ${line}${state ? `, ${STATE_SPOKEN[state]}` : ""}`}
      onClick={onSelect}
      className="flex min-h-[80px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors duration-150 active:bg-accent focus-visible:bg-accent focus-visible:outline-none"
    >
      {emoji ? (
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-chip bg-secondary text-[28px] leading-none">
          {emoji}
        </span>
      ) : gym ? (
        <span aria-hidden className="relative h-14 w-14 shrink-0 overflow-hidden rounded-chip bg-secondary">
          {/* Miniatura de 56 px: 192 px, la misma que las de ejercicio (no la portada de 1000). */}
          {cover && <img src={fastImage(cover, THUMB_SIDE)} alt="" decoding="async" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />}
        </span>
      ) : (
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-chip bg-secondary text-primary">
          <Flame className="h-6 w-6" />
        </span>
      )}
      <span aria-hidden className="min-w-0 flex-1">
        <span className="line-clamp-2 break-words type-headline">{name}</span>
        {/* Con letra grande bajan de línea (hasta dos), nunca se corta una cifra con su unidad. */}
        {muscles && <span className="mt-0.5 line-clamp-2 type-subhead text-muted-foreground">{muscles}</span>}
        <span className="mt-0.5 line-clamp-2 type-footnote tabular-nums text-muted-foreground">{line}</span>
      </span>
      {state === "done" ? (
        <span aria-hidden className="inline-flex shrink-0 items-center gap-1 type-footnote font-semibold text-primary">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />Hecha
        </span>
      ) : state === "today" ? (
        <span aria-hidden className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 type-footnote font-semibold text-primary">Hoy</span>
      ) : state === "next" ? (
        <span aria-hidden className="shrink-0 type-footnote font-medium text-muted-foreground">Siguiente</span>
      ) : null}
      <ChevronRight
        aria-hidden
        className={cn("h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-150", expanded && "rotate-90 text-primary")}
        strokeWidth={2.5}
      />
    </button>
  );
};

/**
 * Entrenar (`RoutineListView` + `TrainView` en la app): el modo del plan en una frase y «Entreno vacío» /
 * «Ejercicios» como píldoras tranquilas; «Esta semana» con «Editar», lo hecho en tramos y las sesiones en
 * una sola lista (la elegida se abre debajo, dentro de la misma tarjeta); después «Mis rutinas».
 */
const TrainingPlanView = ({
  dayPlans, initialDay, doneThisWeek = [], doneToday = [], resumableDay = null, onOpenWorkout,
  onEmptyWorkout, onOpenLibrary, onEditPlan, onPersonalize, routines,
}: Props) => {
  useBrandPhotos(); // repinta las fotos de marca cuando llega su URL actual
  // La rutina en orden: solo sesiones, sin días de la semana ni días de descanso.
  const sessions = routineSessions(dayPlans);
  const next = nextPendingSession(sessions, doneThisWeek);
  const doneCount = doneSessionCount(sessions, doneThisWeek);
  const hasSession = (key?: string | null) => Boolean(key) && sessions.some((session) => session.day === key);
  // Se abre la pedida desde «Hoy»; si no, la siguiente pendiente; si no, la primera.
  const openKeyFor = (preferred?: string | null) =>
    (hasSession(preferred) ? preferred! : next?.day ?? sessions[0]?.day) ?? null;
  // `null` = todas plegadas a propósito; `undefined` = aún sin decidir (se abre la que toca).
  const [expandedDay, setExpandedDay] = useState<string | null | undefined>(() => openKeyFor(initialDay) ?? undefined);
  // La vista no se desmonta al cambiar de pestaña: sincroniza cada sesión pedida desde «Hoy».
  useEffect(() => {
    if (hasSession(initialDay)) setExpandedDay(initialDay!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayPlans, initialDay]);
  // El plan puede llegar después de montar: si la abierta ya no existe, se abre la que toca.
  useEffect(() => {
    setExpandedDay((current) => (current === null || hasSession(current) ? current : openKeyFor(initialDay) ?? undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayPlans, initialDay, next?.day]);
  const [detail, setDetail] = useState<{
    name: string;
    image?: string | null;
    video?: string | null;
    series?: string;
    reps?: string;
    rest?: string;
    category?: string | null;
    type?: string | null;
    pattern?: string | null;
    stimulus?: string | null;
    load?: string | null;
  } | null>(null);
  const exerciseMetadata = useExerciseMetadata(dayPlans);
  const metaMuscle = (exercise: { exercise_id: string; name: string }) =>
    (exerciseMetadata.byId[exercise.exercise_id] || exerciseMetadata.byName[exercise.name])?.muscle_group;
  /** Sesión que se está personalizando (nombre e icono). */
  const [personalizing, setPersonalizing] = useState<string | null>(null);
  const personalizePlan = sessions.find((session) => session.day === personalizing) ?? null;
  // Lo secundario de la sesión, tranquilo y al final de lo que se abre.
  const personalizeButton = (plan: DayPlan) => onPersonalize && (
    <button
      type="button"
      onClick={() => { void hapticSelection(); setPersonalizing(plan.day); }}
      className="mx-auto mt-1 flex min-h-11 items-center gap-1.5 rounded-full px-4 type-subhead font-semibold text-muted-foreground transition-opacity active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Pencil className="h-4 w-4" aria-hidden /> Nombre e icono
    </button>
  );
  /** Imágenes de ejercicio que fallaron al cargar: la miniatura y la ficha usan su hueco compuesto, nunca la imagen rota. */
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const usableImage = (src?: string | null) => (src && !failedImages.has(src) ? src : null);
  const handleImageError = (event: SyntheticEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    const src = target.getAttribute("src");
    if (!src) return;
    setFailedImages((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));
  };

  const selectedPlan = sessions.find((session) => session.day === expandedDay);
  const hasExercises = Boolean(selectedPlan?.exercises && selectedPlan.exercises.length > 0);
  // «Hoy» es la siguiente sesión mientras hoy no se haya entrenado (la misma que propone Hoy).
  const stateOf = (plan: DayPlan): SessionState =>
    doneThisWeek.includes(plan.day) ? "done" : next?.day === plan.day ? (doneToday.length === 0 ? "today" : "next") : null;

  // Respaldo de la foto de cada fila: la portada propia, la ya generada (caché), la foto del primer
  // ejercicio y, si no hay, la foto de marca. Nunca se pide una portada nueva por fila cerrada.
  const rowPhoto = (plan: DayPlan) => {
    if (plan.type !== "gimnasio") return null;
    if (plan.cover_url) return plan.cover_url;
    const exercises = plan.exercises ?? [];
    const first = exercises[0];
    const image = first ? (exerciseMetadata.byId[first.exercise_id] || exerciseMetadata.byName[first.name])?.image_url || first.image_url : null;
    return cachedSessionCover(exercises.map((exercise) => exercise.exercise_id)) || usableImage(image) || BRAND_PHOTOS.gym;
  };

  // Estado «hecho» de la sesión elegida: misma forma y alto que la píldora de acción, en dorado y sin acción.
  const completed = (label: string) => (
    <p role="status" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary/10 px-4 type-headline text-primary">
      <Check className="h-4 w-4" aria-hidden />{label}
    </p>
  );

  // Lo que se abre bajo la fila elegida, dentro de la misma tarjeta: la acción, los ejercicios y «Nombre e icono».
  const renderDetail = () => {
    if (selectedPlan?.type === "gimnasio") {
      return (
        <section aria-label={`Ejercicios de ${sessionTitle(selectedPlan)}`} className="pb-2">
          <div className="px-4 pb-2 empty:hidden">
            {doneToday.includes(selectedPlan.day) ? completed("Entrenamiento completado") : onOpenWorkout && hasExercises ? (
              <Button type="button" variant="hero" size="lg" className="w-full" onClick={() => onOpenWorkout(selectedPlan.day)}>
                <Play fill="currentColor" strokeWidth={0} aria-hidden />
                {resumableDay === selectedPlan.day ? "Continuar entreno" : "Empezar sesión"}
              </Button>
            ) : null}
          </div>
          {hasExercises ? (
            <div role="group" aria-label="Ejercicios">
              {selectedPlan.exercises?.map((ex, i) => {
                const metadata = exerciseMetadata.byId[ex.exercise_id] || exerciseMetadata.byName[ex.name];
                const video = metadata?.video_url || ex.video_url;
                const image = metadata?.image_url || ex.image_url;
                const category = ex.muscle_group || metadata?.muscle_group;
                const exerciseType = ex.exercise_type || metadata?.exercise_type;
                const pattern = metadata?.movement_pattern ?? null;
                const stimulus = metadata?.stimulus_type ?? null;
                const load = metadata?.load_level ?? null;
                // Su músculo y el descanso con su unidad («90 s», «2 min»), sin partir; el tipo, en la ficha.
                const info = [category, ex.rest ? `Descanso\u00a0${restLabel(ex.rest).replace(/ /g, "\u00a0")}` : null].filter(Boolean).join(" · ");

                return (
                  <ListRow
                    key={`${selectedPlan.day}-${ex.exercise_id || ex.name}-${i}`}
                    // La miniatura se mueve con su clip de técnica (sobre la foto): al tocar la fila se abre la ficha.
                    leading={<ExerciseThumb image={usableImage(image)} video={video} name={ex.name} pattern={pattern} stimulus={stimulus} load={load} muscleGroup={category} size="sm" />}
                    title={<span className="line-clamp-2 whitespace-normal">{ex.name}</span>}
                    subtitle={info ? <span className="line-clamp-2">{info}</span> : undefined}
                    value={<span className="tabular-nums">{`${ex.series}\u00a0×\u00a0${ex.reps}`}</span>}
                    chevron
                    onClick={() =>
                      setDetail({
                        name: ex.name,
                        image,
                        video,
                        series: ex.series ? String(ex.series) : undefined,
                        reps: ex.reps ? String(ex.reps) : undefined,
                        rest: ex.rest,
                        category,
                        type: exerciseType,
                        pattern,
                        stimulus,
                        load,
                      })
                    }
                  />
                );
              })}
            </div>
          ) : (
            <p className="px-4 pb-2 type-subhead text-muted-foreground">Añade sus ejercicios con «Editar» y empiézala cuando quieras.</p>
          )}
          {personalizeButton(selectedPlan)}
        </section>
      );
    }
    if (selectedPlan?.type === "actividad") {
      return (
        <section aria-label={`Detalle de ${sessionTitle(selectedPlan)}`} className="pb-2">
          <div className="px-4 pb-2 empty:hidden">
            {doneToday.includes(selectedPlan.day) ? completed("Actividad completada") : onOpenWorkout ? (
              <Button type="button" variant="hero" size="lg" className="w-full" onClick={() => onOpenWorkout(selectedPlan.day)}>
                Empezar actividad
              </Button>
            ) : null}
          </div>
          <ListRow icon={<Flame className="text-muted-foreground" />} title="Intensidad" value={selectedPlan.intensity || "Libre"} />
          <ListRow icon={<Clock className="text-muted-foreground" />} title="Duración" value={selectedPlan.duration || "Libre"} />
          {personalizeButton(selectedPlan)}
        </section>
      );
    }
    return null;
  };

  return (
    // La columna centrada de 680 de Hoy y Nutrición, también en la web ancha (= Mac).
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-8" onErrorCapture={handleImageError}>
      <h2 className="sr-only">Entrenar</h2>

      {/* Cabecera: el modo del plan en una frase y, debajo, dos accesos tranquilos. */}
      <div className="flex flex-col gap-4">
        <p className="type-subhead text-muted-foreground">{planModeLine(dayPlans)}</p>
        {(onEmptyWorkout || onOpenLibrary) && (
          // Lado a lado si caben; si no (letra grande), uno bajo otro, sin cortar.
          <div className="flex flex-wrap gap-2">
            {onEmptyWorkout && <QuietPill icon={Play} label="Entreno vacío" onClick={onEmptyWorkout} />}
            {onOpenLibrary && <QuietPill icon={BookOpen} label="Ejercicios" onClick={onOpenLibrary} />}
          </div>
        )}
      </div>

      {sessions.length > 0 ? (
        <section aria-labelledby="entrenar-semana" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="entrenar-semana" className="type-title3">Esta semana</h3>
            {onEditPlan && (
              <button
                type="button"
                aria-label="Editar plan"
                onClick={() => { void hapticTap(); onEditPlan(); }}
                className="-my-3 min-h-11 shrink-0 px-1 type-subhead font-semibold text-primary transition-opacity active:opacity-60"
              >
                Editar
              </button>
            )}
          </div>
          {/* Lo hecho esta semana: un tramo por sesión, dorado si ya está hecha. */}
          <div className="flex items-center gap-3" aria-label={`Esta semana: ${doneCount} de ${sessions.length} sesiones`} role="group">
            <div aria-hidden="true" className="flex flex-1 gap-1.5">
              {sessions.map((session) => (
                <span key={session.day} className={cn("h-1.5 flex-1 rounded-full", doneThisWeek.includes(session.day) ? "bg-primary" : "bg-secondary")} />
              ))}
            </div>
            <span aria-hidden="true" className="shrink-0 type-footnote tabular-nums text-muted-foreground">{`${doneCount} de ${sessions.length}`}</span>
          </div>

          {/* Una sola lista: la sesión elegida se abre debajo de su fila, en la misma tarjeta. */}
          <ul data-session-list className="overflow-hidden rounded-card bg-card">
            {sessions.map((session, index) => {
              const expanded = expandedDay === session.day;
              return (
                <li key={session.day} className="relative">
                  {/* El separador nace donde empieza el texto (16 + 56 + 14). */}
                  {index > 0 && <span aria-hidden="true" className="absolute left-[86px] right-4 top-0 sep-t" />}
                  <SessionRow
                    number={index + 1}
                    plan={session}
                    state={stateOf(session)}
                    expanded={expanded}
                    photo={rowPhoto(session)}
                    muscles={sessionMuscles(session, metaMuscle)}
                    onSelect={() => {
                      void hapticSelection();
                      // Tocar la abierta la pliega; tocar otra la abre.
                      setExpandedDay((current) => (current === session.day ? null : session.day));
                    }}
                  />
                  {expanded && renderDetail()}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        // Plan sin sesiones: tarjeta sin borde con su icono en dorado y el siguiente paso (como la app).
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-sheet bg-card px-5 py-6 text-center">
          <span aria-hidden className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
            <CalendarDays className="h-[26px] w-[26px]" strokeWidth={1.75} />
          </span>
          <p className="mt-4 type-headline">Tu plan aún no tiene sesiones</p>
          <p className="mt-1.5 max-w-[32ch] type-subhead text-muted-foreground">Edita tu rutina para añadir tus sesiones.</p>
          {onEditPlan && (
            <Button type="button" variant="secondary" className="mt-5" onClick={() => { void hapticTap(); onEditPlan(); }}>
              Editar plan
            </Button>
          )}
        </div>
      )}

      {routines}

      <AIDisclaimer variant="compact" className="px-4 text-center" />

      {/* El ejercicio a pantalla completa: nada más alrededor */}
      <ExerciseFocus
        exercise={detail ? {
          name: detail.name,
          image: usableImage(detail.image),
          video: detail.video,
          series: detail.series,
          reps: detail.reps,
          rest: detail.rest,
          muscleGroup: detail.category,
          exerciseType: detail.type,
          pattern: detail.pattern,
          stimulus: detail.stimulus,
          load: detail.load,
        } : null}
        onClose={() => setDetail(null)}
      />
      {onPersonalize && (
        <SessionIdentitySheet
          plan={personalizePlan}
          number={personalizePlan ? sessions.indexOf(personalizePlan) + 1 : 0}
          onOpenChange={(open) => { if (!open) setPersonalizing(null); }}
          onSave={(identity) => onPersonalize(personalizePlan!.day, identity)}
        />
      )}
    </div>
  );
};

export default TrainingPlanView;
