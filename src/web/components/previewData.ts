import { buildExerciseHistory } from "@/shared/lib/workoutMetrics";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";

// Isolated illustrative data: never a customer's plan or recorded results.
export const previewExercises = [
  { name: "Sentadilla goblet", sets: 3, reps: 9, load: "20 kg", last: "18 kg × 10", get image() { return BRAND_PHOTOS.home; } },
  { name: "Remo con mancuerna", sets: 3, reps: 11, load: "16 kg", last: "14 kg × 12", get image() { return BRAND_PHOTOS.dumbbells; } },
  { name: "Press con mancuernas", sets: 3, reps: 9, load: "14 kg", last: "14 kg × 8", get image() { return BRAND_PHOTOS.gym; } },
];

export const previewHistory = buildExerciseHistory([
  ["2026-09-04", "18", 10], ["2026-09-11", "18", 11],
  ["2026-09-18", "20", 9], ["2026-09-25", "20", 10],
].map(([logged_at, weight, reps]) => ({
  exercise_name: "Sentadilla goblet", logged_at: String(logged_at),
  sets_completed: Array.from({ length: 3 }, () => ({ weight, reps, done: true })),
}))) ["Sentadilla goblet"];