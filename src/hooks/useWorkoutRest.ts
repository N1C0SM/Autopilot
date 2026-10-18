import { useCallback, useEffect, useState } from "react";

export function remainingRestSeconds(deadline: number | null, now = Date.now()): number | null {
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** Intervals only repaint; the clock's authority is the absolute deadline. */
export function useWorkoutRest(onFinished: () => void) {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const setRestTimer = useCallback((seconds: number | null) => {
    setDeadline(seconds === null ? null : Date.now() + seconds * 1000);
    setRemaining(seconds);
  }, []);
  const restoreRest = useCallback((target: number | null) => {
    setDeadline(target);
    setRemaining(remainingRestSeconds(target));
  }, []);
  useEffect(() => {
    if (deadline === null) { setRemaining(null); return; }
    let finished = false;
    const tick = () => {
      const value = remainingRestSeconds(deadline);
      if (value === 0) {
        if (finished) return;
        finished = true;
        setDeadline(null);
        setRemaining(null);
        onFinished();
      } else setRemaining(value);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pageshow", tick);
      window.removeEventListener("focus", tick);
    };
  }, [deadline, onFinished]);
  return { restTimer: remaining, setRestTimer, restDeadline: deadline, restoreRest };
}