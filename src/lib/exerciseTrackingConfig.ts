export type ExerciseTrackingKind =
  | "weighted_reps"
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
    };

const normalizeExerciseName = (value?: string | null) => (value || "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

export function getExerciseTrackingConfig(exercise?: ExerciseTrackingInput): ExerciseTrackingConfig {
  const candidate = typeof exercise === "string" ? { name: exercise } : exercise ?? {};
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
      valueLabel: "Reps",
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
      valueLabel: "Reps",
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
      valueLabel: "Reps",
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
