/**
 * Admin → Biblioteca → «Generar vídeos de los ejercicios de los planes». Lógica pura (sin red):
 * qué ejercicios usan los planes de los usuarios, cuáles no tienen vídeo todavía y cuánto
 * cuesta crearlos. La tarjeta es `PlanVideos.tsx` en la web y `AdminPlanVideosCard` en la app.
 */

/** Un clip de técnica de 4 s (Veo 3.1 Fast en el AI Gateway de Lovable) cuesta unos 1,6 créditos. */
export const CREDITS_PER_CLIP = 1.6;

/** Lo que tarda como mucho un vídeo antes de darlo por atascado (suelen ser 1–3 minutos). */
export const PLAN_VIDEO_DEADLINE_MS = 10 * 60 * 1000;

/** Cada cuánto se pregunta a `exercise-video` (acción `check`) si el vídeo ya está. */
export const PLAN_VIDEO_POLL_MS = 8000;

/** Dónde se activan los vídeos si están en pausa (`app_secrets.AI_VIDEO_ENABLED = "0"`). */
export const VIDEO_SETTING_PATH = "Admin → Landing → Claves de IA → Vídeos de ejercicios";

/** Textos de la tarjeta, iguales en la web y en la app. */
export const PLAN_VIDEOS_COPY = {
  title: "Vídeos de los planes",
  body: "Los ejercicios que usan los planes de tus usuarios, en movimiento: un clip de 4 s por ejercicio, hecho a partir de su foto. Los que ya tienen vídeo se saltan.",
  button: "Generar vídeos de los ejercicios de los planes",
  counting: "Contando los ejercicios de los planes…",
  loadError: "No hemos podido contar los ejercicios de los planes.",
  retry: "Reintentar",
  allDone: "Todos los ejercicios de los planes ya tienen su vídeo.",
  noPlans: "Aún no hay ejercicios en los planes de tus usuarios.",
  paused: "Vídeos en pausa",
  pausedHelp: `Los vídeos de técnica están en pausa. Actívalos en ${VIDEO_SETTING_PATH} y vuelve aquí.`,
  cancel: "Ahora no",
  stop: "Parar",
  stopping: "Parando al terminar este vídeo…",
  failures: "Para reintentar",
  creditsOut: "Se han acabado los créditos de IA: la cola se ha parado. Recarga créditos en Lovable y vuelve a pulsar el botón.",
} as const;

/** Lo mínimo de una sesión de `training_plan.workouts_json` que hace falta aquí. */
type PlanEntry = { exercise_id?: unknown; name?: unknown };
type PlanDay = { exercises?: unknown };

/** Fila de `exercises` que lee la tarjeta. */
export type PlanVideoExercise = {
  id: string;
  name: string;
  image_url: string | null;
  video_url: string | null;
};

/** Ids y nombres (normalizados) de todos los ejercicios de todos los planes, sin repetir. */
export type PlanExerciseKeys = { ids: Set<string>; names: Set<string> };

const normalize = (name: string) => name.trim().toLocaleLowerCase("es");

/** Recorre `workouts_json` de cada plan (un array de sesiones) y junta sus ejercicios. */
export const planExerciseKeys = (plans: readonly unknown[]): PlanExerciseKeys => {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const plan of plans) {
    if (!Array.isArray(plan)) continue;
    for (const day of plan as PlanDay[]) {
      if (!day || typeof day !== "object" || !Array.isArray(day.exercises)) continue;
      for (const entry of day.exercises as PlanEntry[]) {
        if (!entry || typeof entry !== "object") continue;
        if (typeof entry.exercise_id === "string" && entry.exercise_id.trim()) ids.add(entry.exercise_id.trim());
        if (typeof entry.name === "string" && entry.name.trim()) names.add(normalize(entry.name));
      }
    }
  }
  return { ids, names };
};

/** Recuento y cola de la tarjeta. */
export type PlanVideoQueue = {
  /** Ejercicios de la biblioteca que usa algún plan. */
  inPlans: number;
  /** De ellos, los que ya tienen vídeo (se saltan). */
  withVideo: number;
  /** Sin vídeo todavía (lo que se cuenta y se cobra). */
  missing: PlanVideoExercise[];
  /** Sin vídeo y con foto: los que se pueden generar ya (el vídeo parte de la foto). */
  ready: PlanVideoExercise[];
  /** Sin vídeo ni foto: primero necesitan su foto. */
  needPhoto: PlanVideoExercise[];
};

const hasValue = (value: string | null | undefined) => Boolean(value && value.trim());

/** Cruza la biblioteca con los planes (por id y, si no, por nombre) y separa con y sin vídeo. */
export const planVideoQueue = (library: readonly PlanVideoExercise[], keys: PlanExerciseKeys): PlanVideoQueue => {
  const used = library
    .filter((exercise) => keys.ids.has(exercise.id) || keys.names.has(normalize(exercise.name)))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const missing = used.filter((exercise) => !hasValue(exercise.video_url));
  return {
    inPlans: used.length,
    withVideo: used.length - missing.length,
    missing,
    ready: missing.filter((exercise) => hasValue(exercise.image_url)),
    needPhoto: missing.filter((exercise) => !hasValue(exercise.image_url)),
  };
};

/** Créditos estimados: vídeos × 1,6, con un decimal. */
export const planVideoCredits = (count: number): number => Math.round(Math.max(0, count) * CREDITS_PER_CLIP * 10) / 10;

/** «1,6», «19,2», «64»: decimal con coma y sin ceros de más. */
export const formatCredits = (value: number): string =>
  value.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

const plural = (count: number, one: string, many: string) => `${count.toLocaleString("es-ES")} ${count === 1 ? one : many}`;

/** «40 ejercicios en los planes · 28 con vídeo · 12 sin vídeo». */
export const planVideoSummary = (queue: Pick<PlanVideoQueue, "inPlans" | "withVideo" | "missing">): string =>
  `${plural(queue.inPlans, "ejercicio", "ejercicios")} en los planes · ${queue.withVideo.toLocaleString("es-ES")} con vídeo · ${queue.missing.length.toLocaleString("es-ES")} sin vídeo`;

/** «12 vídeos de 4 s · ≈19,2 créditos de Lovable (1,6 por vídeo)». */
export const planVideoEstimate = (count: number): string =>
  `${plural(count, "vídeo", "vídeos")} de 4 s · ≈${formatCredits(planVideoCredits(count))} créditos de Lovable (${formatCredits(CREDITS_PER_CLIP)} por vídeo)`;

/** «3 necesitan antes su foto: créala desde su ficha y entrarán en la siguiente tanda». */
export const planVideoNeedPhoto = (count: number): string =>
  count === 1
    ? "1 necesita antes su foto (el vídeo parte de ella): créala desde su ficha y entrará en la siguiente tanda."
    : `${count.toLocaleString("es-ES")} necesitan antes su foto (el vídeo parte de ella): créala desde su ficha y entrarán en la siguiente tanda.`;

/** Título de la confirmación: «¿Generar 12 vídeos?». */
export const planVideoConfirmTitle = (count: number): string => `¿Generar ${plural(count, "vídeo", "vídeos")}?`;

/** Botón de la confirmación: «Generar 12 vídeos». */
export const planVideoConfirmAction = (count: number): string => `Generar ${plural(count, "vídeo", "vídeos")}`;

/** Texto de la confirmación (cuenta, coste, uno a uno y se saltan los que ya tienen vídeo). */
export const planVideoConfirmBody = (count: number): string =>
  `Se creará un clip de 4 s para cada ejercicio de los planes que aún no tiene vídeo, uno detrás de otro. Coste estimado: ≈${formatCredits(planVideoCredits(count))} créditos de Lovable (${formatCredits(CREDITS_PER_CLIP)} por vídeo). Los que ya tienen vídeo se saltan y puedes parar cuando quieras.`;

/** «Generando 12 de 40». */
export const planVideoProgress = (current: number, total: number): string =>
  `Generando ${current.toLocaleString("es-ES")} de ${total.toLocaleString("es-ES")}`;

/** Resumen al terminar o al parar. */
export const planVideoDone = (created: number, total: number, stopped: boolean): string =>
  stopped
    ? `Parado: ${created.toLocaleString("es-ES")} de ${plural(total, "vídeo creado", "vídeos creados")}.`
    : `Listo: ${plural(created, "vídeo nuevo", "vídeos nuevos")}.`;

/** ¿Este error es de saldo? Entonces se para la cola entera en vez de fallar uno a uno. */
export const isCreditsError = (message: string): boolean => /créditos|credit limit|sin saldo|insufficient_quota|402/i.test(message);
