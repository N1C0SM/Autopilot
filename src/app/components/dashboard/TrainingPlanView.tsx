import { useEffect, useState, type ReactNode, type SyntheticEvent } from "react";
import { CalendarDays, Check, ChevronRight, Clock, Flame, Pencil } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { cn } from "@/shared/lib/utils";
import { hapticSelection } from "@/shared/lib/native";
import type { DayPlan } from "@/shared/types/training";
import { formatTrainingTitle } from "@/shared/lib/trainingDisplay";
import AIDisclaimer from "@/shared/components/AIDisclaimer";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import ExerciseFocus from "@/app/components/ExerciseFocus";
import { useExerciseMetadata } from "@/shared/hooks/useExerciseMetadata";
import { cachedSessionCover, useSessionCover } from "@/shared/hooks/useSessionCover";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";
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
  /** Cabecera de la rutina (modo del plan, Libre, Editar, Ejercicios): va arriba, antes de las sesiones. */
  tools?: ReactNode;
  /** Guarda el nombre y el icono de una sesión («Personalizar»); false si no se pudo. */
  onPersonalize?: (day: string, identity: { name: string; icon: string | null }) => Promise<boolean>;
}

const sessionTitle = (plan: DayPlan) =>
  plan.type === "gimnasio"
    ? formatTrainingTitle(plan.routine_name, plan.muscle_focus) || "Entrenamiento"
    : plan.sport || "Actividad";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const sessionSummary = (plan: DayPlan) => {
  const exercises = plan.exercises ?? [];
  if (exercises.length === 0) return null;
  const sets = exercises.reduce((total, ex) => total + (Number(ex.series) || 0), 0);
  return [plural(exercises.length, "ejercicio", "ejercicios"), sets > 0 ? plural(sets, "serie", "series") : null]
    .filter(Boolean)
    .join(" · ");
};

/** Detalle corto de la fila: series y ejercicios del gimnasio, intensidad y duración de la actividad. */
const sessionMeta = (plan: DayPlan) => {
  if (plan.type === "gimnasio") return sessionSummary(plan) || "Sin ejercicios todavía";
  return [plan.intensity ? `Intensidad ${plan.intensity.toLocaleLowerCase("es-ES")}` : null, plan.duration].filter(Boolean).join(" · ") || "Actividad";
};

interface SessionRowProps {
  number: number;
  plan: DayPlan;
  isNext: boolean;
  done: boolean;
  expanded: boolean;
  /** Foto de respaldo (caché de la portada, foto del primer ejercicio o foto de marca). */
  photo: string | null;
  onSelect: () => void;
}

// Fila de la rutina: foto, «Sesión N» (con «Siguiente» u «Hecha esta semana»), nombre y detalle.
// Sin días de la semana: cualquier sesión se hace el día que venga bien.
// Solo la fila abierta pide la portada con IA; las demás usan la caché o su respaldo.
const SessionRow = ({ number, plan, isNext, done, expanded, photo, onSelect }: SessionRowProps) => {
  const gym = plan.type === "gimnasio";
  const ids = gym && expanded ? (plan.exercises ?? []).map((exercise) => exercise.exercise_id) : [];
  const cover = useSessionCover(ids, photo);
  const title = sessionTitle(plan);
  const emoji = cleanSessionIcon(plan.session_icon);
  const status = done ? "hecha esta semana" : isNext ? "siguiente" : null;
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={`Sesión ${number}: ${title}${status ? `, ${status}` : ""}`}
      onClick={onSelect}
      className={cn(
        "flex min-h-[88px] w-full items-center gap-3.5 rounded-[22px] border bg-card p-3 pr-4 text-left transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        expanded ? "border-primary/60" : "border-border",
      )}
    >
      {emoji ? (
        <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-secondary text-[32px] leading-none">
          {emoji}
        </span>
      ) : gym ? (
        <span aria-hidden className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-secondary">
          {cover && <img src={cover} alt="" decoding="async" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />}
        </span>
      ) : (
        <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Flame className="h-6 w-6" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 type-footnote font-medium text-muted-foreground">
          {`Sesión ${number}`}
          {done ? (
            <span className="inline-flex items-center gap-0.5 text-success">
              · <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />Hecha
            </span>
          ) : isNext ? (
            <span className="text-primary">· Siguiente</span>
          ) : null}
        </span>
        <h3 className="mt-0.5 line-clamp-2 type-headline">{title}</h3>
        <span className="mt-0.5 block truncate type-footnote tabular-nums text-muted-foreground">{sessionMeta(plan)}</span>
      </span>
      <ChevronRight
        aria-hidden
        className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150", expanded && "rotate-90 text-primary")}
        strokeWidth={2.5}
      />
    </button>
  );
};

const TrainingPlanView = ({ dayPlans, initialDay, doneThisWeek = [], doneToday = [], resumableDay = null, onOpenWorkout, tools, onPersonalize }: Props) => {
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
  /** Sesión que se está personalizando (nombre e icono). */
  const [personalizing, setPersonalizing] = useState<string | null>(null);
  const personalizePlan = sessions.find((session) => session.day === personalizing) ?? null;
  const personalizeButton = (plan: DayPlan) => onPersonalize && (
    <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => { void hapticSelection(); setPersonalizing(plan.day); }}>
      <Pencil className="h-4 w-4" aria-hidden /> Nombre e icono
    </Button>
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

  // Respaldo de la foto de cada fila: la portada ya generada (caché), la foto del primer
  // ejercicio y, si no hay, la foto de marca. Nunca se pide una portada nueva por fila cerrada.
  const rowPhoto = (plan: DayPlan) => {
    if (plan.type !== "gimnasio") return null;
    const exercises = plan.exercises ?? [];
    const first = exercises[0];
    const image = first ? (exerciseMetadata.byId[first.exercise_id] || exerciseMetadata.byName[first.name])?.image_url || first.image_url : null;
    return cachedSessionCover(exercises.map((exercise) => exercise.exercise_id)) || usableImage(image) || BRAND_PHOTOS.gym;
  };

  // Lo que se abre bajo la fila elegida: empezar la sesión y sus ejercicios, la actividad o el descanso.
  const renderDetail = () => {
    if (selectedPlan?.type === "gimnasio") {
      return (
        <section aria-label={`Ejercicios de ${sessionTitle(selectedPlan)}`} className="space-y-3">
          {doneToday.includes(selectedPlan.day) ? (
            <p role="status" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary/10 px-4 type-headline text-primary">
              <Check className="h-4 w-4" aria-hidden />Entrenamiento completado
            </p>
          ) : onOpenWorkout && hasExercises ? (
            <Button type="button" variant="hero" size="lg" className="w-full" onClick={() => onOpenWorkout(selectedPlan.day)}>
              {resumableDay === selectedPlan.day ? "Continuar entreno" : "Empezar sesión"}
            </Button>
          ) : null}
          {hasExercises && (
            <ListGroup aria-label="Ejercicios">
              {selectedPlan.exercises?.map((ex, i) => {
                const metadata = exerciseMetadata.byId[ex.exercise_id] || exerciseMetadata.byName[ex.name];
                const video = ex.video_url || metadata?.video_url;
                const image = metadata?.image_url || ex.image_url;
                const category = ex.muscle_group || metadata?.muscle_group;
                const exerciseType = ex.exercise_type || metadata?.exercise_type;
                const pattern = metadata?.movement_pattern ?? null;
                const stimulus = metadata?.stimulus_type ?? null;
                const load = metadata?.load_level ?? null;
                const info = [ex.rest, category, exerciseType].filter(Boolean).join(" · ");

                return (
                  <ListRow
                    key={`${selectedPlan.day}-${ex.exercise_id || ex.name}-${i}`}
                    // La miniatura es la portada del vídeo: al tocar la fila se abre la ficha, cuyo héroe es el vídeo.
                    leading={<ExerciseThumb image={usableImage(image)} video={video} name={ex.name} pattern={pattern} stimulus={stimulus} load={load} size="sm" />}
                    title={<span className="line-clamp-2 whitespace-normal">{ex.name}</span>}
                    subtitle={info ? <span className="block truncate">{info}</span> : undefined}
                    value={<span className="tabular-nums">{ex.series} × {ex.reps}</span>}
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
            </ListGroup>
          )}
          {!hasExercises && <p className="px-1 type-subhead text-muted-foreground">Esta sesión no tiene ejercicios todavía.</p>}
          {personalizeButton(selectedPlan)}
        </section>
      );
    }
    if (selectedPlan?.type === "actividad") {
      return (
        <section aria-label={`Detalle de ${sessionTitle(selectedPlan)}`} className="space-y-3">
          {doneToday.includes(selectedPlan.day) ? (
            <p role="status" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary/10 px-4 type-headline text-primary">
              <Check className="h-4 w-4" aria-hidden />Actividad completada
            </p>
          ) : onOpenWorkout ? (
            <Button type="button" variant="hero" size="lg" className="w-full" onClick={() => onOpenWorkout(selectedPlan.day)}>
              Empezar actividad
            </Button>
          ) : null}
          <ListGroup>
            <ListRow icon={<Flame className="text-muted-foreground" />} title="Intensidad" value={selectedPlan.intensity} />
            <ListRow icon={<Clock className="text-muted-foreground" />} title="Duración" value={selectedPlan.duration} />
          </ListGroup>
          {personalizeButton(selectedPlan)}
        </section>
      );
    }
    return null;
  };

  return (
    <div className="flex w-full flex-col gap-5" onErrorCapture={handleImageError}>
      <h2 className="sr-only">Entrenar</h2>
      {/* En el móvil, bajo el título grande «Entrenar»; en escritorio la barra ya lleva su pista. */}
      <p className="-mt-1 type-subhead text-muted-foreground md:hidden">Tus sesiones en orden. Hazlas el día que te venga bien.</p>

      {tools}

      {sessions.length > 0 ? (
        <>
          {/* Lo hecho esta semana: un tramo por sesión, dorado si ya está hecha. */}
          <div className="flex items-center gap-3" aria-label={`Esta semana: ${doneCount} de ${sessions.length} sesiones`} role="group">
            <div aria-hidden="true" className="flex flex-1 gap-1.5">
              {sessions.map((session) => (
                <span key={session.day} className={cn("h-1.5 flex-1 rounded-full", doneThisWeek.includes(session.day) ? "bg-primary" : "bg-secondary")} />
              ))}
            </div>
            <span aria-hidden="true" className="shrink-0 type-footnote tabular-nums text-muted-foreground">{`${doneCount} de ${sessions.length} esta semana`}</span>
          </div>

          {/* La rutina en orden: la sesión elegida se abre debajo de su fila. */}
          <ul data-session-list className="space-y-3">
            {sessions.map((session, index) => {
              const expanded = expandedDay === session.day;
              return (
                <li key={session.day} className="space-y-3">
                  <SessionRow
                    number={index + 1}
                    plan={session}
                    isNext={next?.day === session.day}
                    done={doneThisWeek.includes(session.day)}
                    expanded={expanded}
                    photo={rowPhoto(session)}
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
        </>
      ) : (
        <EmptyState
          card
          icon={CalendarDays}
          title="Tu plan aún no tiene sesiones"
          description="Edita tu rutina para añadir tus sesiones."
        />
      )}

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
