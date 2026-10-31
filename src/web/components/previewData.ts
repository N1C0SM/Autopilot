import { buildExerciseHistory } from "@/shared/lib/workoutMetrics";
import { fastImage } from "@/shared/lib/fastImage";

// Isolated illustrative data: never a customer's plan or recorded results.
export const previewExercises = [
  { name: "Sentadilla goblet", sets: 3, reps: 9, load: "20 kg", last: "18 kg × 10", image: fastImage("https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/14988835-a004-49d6-95c5-63978dbce978-1791475887313.png", 800) },
  { name: "Remo con mancuerna", sets: 3, reps: 11, load: "16 kg", last: "14 kg × 12", image: fastImage("https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/d5e30e05-0791-4886-84a0-7b2695728225-1791475865184.png", 800) },
  { name: "Press con mancuernas", sets: 3, reps: 9, load: "14 kg", last: "14 kg × 8", image: fastImage("https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/a31c7206-d2a4-4b31-856a-f5dec09b890e-1791475829849.png", 800) },
];

export const previewHistory = buildExerciseHistory([
  ["2026-09-04", "18", 10], ["2026-09-11", "18", 11],
  ["2026-09-18", "20", 9], ["2026-09-25", "20", 10],
].map(([logged_at, weight, reps]) => ({
  exercise_name: "Sentadilla goblet", logged_at: String(logged_at),
  sets_completed: Array.from({ length: 3 }, () => ({ weight, reps, done: true })),
}))) ["Sentadilla goblet"];