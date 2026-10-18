import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { remainingRestSeconds, useWorkoutRest } from "./useWorkoutRest";
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("absolute rest deadline", () => {
  it("counts elapsed wall time rather than interval ticks", () => {
    expect(remainingRestSeconds(61000, 1000)).toBe(60);
    expect(remainingRestSeconds(61000, 46000)).toBe(15);
    expect(remainingRestSeconds(61000, 61000)).toBe(0);
  });
  it("catches up after 45 seconds in the background and finishes once after 60", () => {
    vi.useFakeTimers(); vi.setSystemTime(1000);
    const finished = vi.fn();
    const { result } = renderHook(() => useWorkoutRest(finished));
    act(() => result.current.setRestTimer(60));
    act(() => { vi.setSystemTime(46000); document.dispatchEvent(new Event("visibilitychange")); });
    expect(result.current.restTimer).toBe(15);
    act(() => { vi.setSystemTime(61000); window.dispatchEvent(new Event("focus")); });
    expect(result.current.restTimer).toBeNull();
    expect(finished).toHaveBeenCalledOnce();
  });
});