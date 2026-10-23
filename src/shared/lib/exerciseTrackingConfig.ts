export type ExerciseTrackingKind =
  | "weighted_reps"
  | "bodyweight_reps"
  | "weighted_bodyweight"
  | "bodyweight_seconds"
  | "seconds_only"
  | "assisted_reps"
  | "cardio_duration_distance"
  | "reps_only";

export interface ExerciseTrackingConfig {
  kind: ExerciseTrackingKind;
  weightLabel: string;
  valueLabel: string;
  secondaryLabel?: string;
  supportsWeight: boolean;
  supportsSecondaryMetric: boolean;
  description: string;
  /** Casilla de carga fija «PC»: solo se anotan repeticiones. */
  fixedBodyweight?: boolean;
  /** Sufijo de la métrica principal en el histórico (p. ej. «s»). */
  valueSuffix?: string;
  /** Sugerencia por defecto en la casilla de carga. */
  weightPlaceholder?: string;
}

export type ExerciseTrackingInput =
  | string
  | null
  | undefined
  | {
      name?: string | null;
      skill_tag?: string | null;
      movement_pattern?: string | null;
      exercise_type?: string | null;
      tracking_mode?: string | null;
    };

const normalizeExerciseName = (value?: string | null) => (value || "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

export const TRACKING_MODES: Record<string, ExerciseTrackingConfig> = {
  weighted_reps: { kind: "weighted_reps", weightLabel: "KG", valueLabel: "Repeticiones", supportsWeight: true, supportsSecondaryMetric: false, description: "Carga externa: kilos y repeticiones.", weightPlaceholder: "kg" },
  bodyweight_reps: { kind: "bodyweight_reps", weightLabel: "Carga", valueLabel: "Repeticiones", supportsWeight: false, supportsSecondaryMetric: false, description: "Peso corporal puro: solo repeticiones.", fixedBodyweight: true },
  weighted_bodyweight: { kind: "weighted_bodyweight", weightLabel: "+KG (Lastre)", valueLabel: "Repeticiones", supportsWeight: true, supportsSecondaryMetric: false, description: "Calistenia con lastre: 0 kg = peso corporal.", weightPlaceholder: "0" },
  seconds_only: { kind: "seconds_only", weightLabel: "Carga", valueLabel: "Segundos", secondaryLabel: "Intentos", supportsWeight: false, supportsSecondaryMetric: true, description: "Isométricos: segundos sostenidos.", fixedBodyweight: true, valueSuffix: "s" },
  assisted_reps: { kind: "assisted_reps", weightLabel: "-KG (Asist.)", valueLabel: "Repeticiones", supportsWeight: true, supportsSecondaryMetric: false, description: "Progresión asistida: kilos de asistencia o goma.", weightPlaceholder: "0" },
};

export function getExerciseTrackingConfig(exercise?: ExerciseTrackingInput): ExerciseTrackingConfig {
  const candidate = typeof exercise === "string" ? { name: exercise } : exercise ?? {};
  const explicit = candidate.tracking_mode ? TRACKING_MODES[candidate.tracking_mode] : undefined;
  if (explicit) return explicit;
  const name = normalizeExerciseName(candidate.name);
  const skillTag = normalizeExerciseName(candidate.skill_tag);
  const pattern = normalizeExerciseName(candidate.movement_pattern);
  const exerciseType = normalizeExerciseName(candidate.exercise_type);

  if (
    name.includes("front lever")
    || name.includes("lever frontal")
    || skillTag.includes("front lever")
    || skillTag.includes("front lever")
    || name.includes("frontlever")
  ) {
    return {
      kind: "bodyweight_seconds",
      weightLabel: "Peso corporal",
      valueLabel: "Segundos",
      secondaryLabel: "Intentos",
      supportsWeight: false,
      supportsSecondaryMetric: true,
      description: "Front Lever: se mide el tiempo bajo carga corporal, con intentos opcionales.",
    };
  }

  if (
    name.includes("back lever")
    || name.includes("lever trasero")
    || skillTag.includes("back lever")
    || name.includes("backlever")
  ) {
    return {
      kind: "bodyweight_seconds",
      weightLabel: "Peso corporal",
      valueLabel: "Segundos",
      secondaryLabel: "Intentos",
      supportsWeight: false,
      supportsSecondaryMetric: true,
      description: "Back Lever: se registra la duración en segundos y el número de intentos.",
    };
  }

  if (
    name.includes("l sit")
    || name.includes("l-sit")
    || skillTag.includes("l sit")
    || skillTag.includes("l sit")
    || name.includes("lsit")
  ) {
    return {
      kind: "bodyweight_seconds",
      weightLabel: "Peso corporal",
      valueLabel: "Segundos",
      secondaryLabel: "Intentos",
      supportsWeight: false,
      supportsSecondaryMetric: true,
      description: "L-Sit: carga corporal con medición de tiempo total en segundos.",
    };
  }

  if (name.includes("handstand") || skillTag.includes("handstand")) {
    return {
      kind: "seconds_only",
      weightLabel: "Peso corporal",
      valueLabel: "Segundos",
      secondaryLabel: "Intentos",
      supportsWeight: false,
      supportsSecondaryMetric: true,
      description: "Handstand: tiempo sostenido e intentos por sesión.",
    };
  }

  if (
    name.includes("muscle up")
    || name.includes("muscle-up")
    || skillTag.includes("muscle up")
    || skillTag.includes("muscle_up")
    || name.includes("muscleup")
  ) {
    return {
      kind: "assisted_reps",
      weightLabel: "Lastre (kg)",
      valueLabel: "Repeticiones",
      secondaryLabel: "Asistencia",
      supportsWeight: true,
      supportsSecondaryMetric: true,
      description: "Muscle-up: repeticiones con lastre o asistencia, útil para progresión y volumen.",
    };
  }

  if (
    name.includes("dominada")
    || name.includes("pull up")
    || name.includes("pull-up")
    || name.includes("pullup")
    || skillTag.includes("dominadas")
    || pattern.includes("tirón")
    || exerciseType.includes("tirón")
  ) {
    return {
      kind: "assisted_reps",
      weightLabel: "Lastre (kg)",
      valueLabel: "Repeticiones",
      secondaryLabel: "Peso corporal / asistencia",
      supportsWeight: true,
      supportsSecondaryMetric: true,
      description: "Dominadas: diferencia entre peso corporal, asistencia y lastre para mantener trazabilidad.",
    };
  }

  if (
    name.includes("cardio")
    || name.includes("run")
    || name.includes("running")
    || name.includes("cinta")
    || name.includes("bicicleta")
    || name.includes("ergómetro")
    || name.includes("ergo")
  ) {
    return {
      kind: "cardio_duration_distance",
      weightLabel: "Distancia (km)",
      valueLabel: "Duración (min)",
      secondaryLabel: "Pulsaciones / esfuerzo",
      supportsWeight: false,
      supportsSecondaryMetric: true,
      description: "Cardio: duración y distancia para comparar rendimiento del trabajo aeróbico.",
    };
  }

  if (
    name.includes("press banca")
    || name.includes("bench")
    || name.includes("sentadilla")
    || name.includes("squat")
    || name.includes("peso muerto")
    || name.includes("deadlift")
    || name.includes("press militar")
    || name.includes("remo")
    || name.includes("press")
  ) {
    return {
      kind: "weighted_reps",
      weightLabel: "KG",
      valueLabel: "Repeticiones",
      secondaryLabel: "RPE",
      supportsWeight: true,
      supportsSecondaryMetric: true,
      description: "Levantamiento con carga: peso y repeticiones, con capacidad de añadir esfuerzo o RPE.",
    };
  }

  // Ejercicios de gimnasio o máquina: siempre llevan carga, aunque el nombre
  // no coincida con un patrón conocido (p. ej. «Abductores en máquina»).
  if (exerciseType && /gimnasio|gym|m[áa]quina|maquina/.test(exerciseType)) {
    return {
      kind: "weighted_reps",
      weightLabel: "KG",
      valueLabel: "Repeticiones",
      secondaryLabel: "RPE",
      supportsWeight: true,
      supportsSecondaryMetric: true,
      description: "Levantamiento con carga: peso y repeticiones, con capacidad de añadir esfuerzo o RPE.",
    };
  }

  return {
    kind: "reps_only",
    weightLabel: "Peso corporal",
    valueLabel: "Repeticiones",
    secondaryLabel: "RPE",
    supportsWeight: false,
    supportsSecondaryMetric: true,
    description: "Ejercicio general: se registra el esfuerzo principal en repeticiones.",
  };
}
