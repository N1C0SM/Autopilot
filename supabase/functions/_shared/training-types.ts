export type ExerciseTrackingMode = 'weighted_reps' | 'bodyweight_reps' | 'weighted_bodyweight' | 'seconds_only' | 'assisted_reps';

export interface GymExerciseEntry {
  exercise_id: string;
  tracking_mode?: ExerciseTrackingMode | null;
  name: string;
  series: number;
  reps: number;
  weight: string;
  rest: string;
  image_url?: string | null;
  video_url?: string | null;
  muscle_group?: string | null;
  exercise_type?: string | null;
  fatigue_level?: string | null;
}

export interface DayPlan {
  day: string;
  type: "actividad" | "gimnasio";
  // actividad
  sport?: string;
  intensity?: string;
  duration?: string;
  // gimnasio
  routine_name?: string;
  muscle_focus?: string;
  exercises?: GymExerciseEntry[];
  /** Día creado o editado a mano: el piloto automático no lo sustituye sin permiso. */
  custom?: boolean;
}
