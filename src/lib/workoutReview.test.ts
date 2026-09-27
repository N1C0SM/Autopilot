import { describe, it, expect } from "vitest";
import { buildWorkoutReview } from "./workoutReview";
const exercise = (reps = 8, weight = "60", done = true) => [{ name: "Press", sets: [{ reps, weight, done }] }];
describe("workout review", () => {
  it("counts rep changes only at matching loads and set counts", () => {
    expect(buildWorkoutReview(exercise(10), exercise())[0].observation).toContain("+2 repeticiones");
    expect(buildWorkoutReview(exercise(10, "65"), exercise())[0].observation).toContain("no son comparables");
  });
  it("prioritizes high effort over progression", () => {
    expect(buildWorkoutReview(exercise(10), exercise(), 9)[0].proposal).toContain("recuperación");
  });
  it("does not invent progress for missing history or unfinished sets", () => {
    expect(buildWorkoutReview(exercise(), [])[0].observation).toContain("Primera referencia");
    expect(buildWorkoutReview(exercise(8, "60", false), exercise())).toEqual([]);
  });
  it("rejects missing or invalid weights and accepts decimal commas", () => {
    expect(buildWorkoutReview(exercise(10, ""), exercise(8, ""))[0].observation).toContain("no son comparables");
    expect(buildWorkoutReview(exercise(10, "2,5"), exercise(8, "2.5"))[0].observation).toContain("+2 repeticiones");
  });
});
