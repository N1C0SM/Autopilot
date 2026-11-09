import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkoutLayout, setWorkoutLayout, WORKOUT_VIEW_EVENT } from "@/shared/lib/workoutPreferences";

describe("workout layout preference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to rows and stores layouts per user", () => {
    expect(getWorkoutLayout("user-a")).toBe("rows");
    setWorkoutLayout("user-a", "columns");

    expect(getWorkoutLayout("user-a")).toBe("columns");
    expect(getWorkoutLayout("user-b")).toBe("rows");
  });

  it("notifies the tracker when the layout changes", () => {
    const listener = vi.fn();
    window.addEventListener(WORKOUT_VIEW_EVENT, listener);

    setWorkoutLayout("user-a", "columns");

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(WORKOUT_VIEW_EVENT, listener);
  });
});
