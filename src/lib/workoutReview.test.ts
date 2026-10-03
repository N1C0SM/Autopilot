import { describe, it, expect } from "vitest";
import { buildWorkoutReview } from "./workoutReview";
const exercise = (reps = 8, weight = "60", done = true) => [{ name: "Press", sets: [{ reps, weight, done }] }];
describe("workout review", () => {
  it("counts rep changes at matching loads and load jumps in kg", () => {
    expect(buildWorkoutReview(exercise(10), exercise())[0].observation).toContain("+2 repeticiones");
    expect(buildWorkoutReview(exercise(10, "65"), exercise())[0].observation).toContain("+5 kg de carga");
  });
  it("prioritizes high effort over progression", () => {
    expect(buildWorkoutReview(exercise(10), exercise(), 9)[0].proposal).toContain("recuperación");
  });
  it("does not invent progress for missing history or unfinished sets", () => {
    expect(buildWorkoutReview(exercise(), [])[0].observation).toContain("Primera referencia");
    expect(buildWorkoutReview(exercise(8, "60", false), exercise())).toEqual([]);
  });
  it("compares reps for bodyweight sets and accepts decimal commas", () => {
    expect(buildWorkoutReview(exercise(10, ""), exercise(8, ""))[0].observation).toContain("+2 repeticiones");
    expect(buildWorkoutReview(exercise(10, "2,5"), exercise(8, "2.5"))[0].observation).toContain("+2 repeticiones");
  });
});
