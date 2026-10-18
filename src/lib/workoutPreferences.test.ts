import { beforeEach, describe, expect, it } from "vitest";
import { getWorkoutView, setWorkoutView } from "./workoutPreferences";
beforeEach(() => localStorage.clear());
describe("workout view selection", () => {
  it("defaults to a vertical list and preserves the original focus view as a user preference", () => {
    expect(getWorkoutView("alice")).toBe("list");
    setWorkoutView("alice", "focus");
    expect(getWorkoutView("alice")).toBe("focus");
    expect(getWorkoutView("bob")).toBe("list");
    setWorkoutView("alice", "list");
    expect(getWorkoutView("alice")).toBe("list");
  });
});