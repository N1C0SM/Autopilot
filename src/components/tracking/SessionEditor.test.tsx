import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { SessionEditor } from "./SessionEditor";
import { createSession } from "@/lib/tracking/model";
afterEach(cleanup);
describe("typed session fields", () => {
  it("renders seconds for Back Lever and no repetition input", () => {
    const session = createSession("user", {
      day: "Lunes",
      type: "gimnasio",
      exercises: [
        {
          exercise_id: "lever",
          name: "Back Lever",
          tracking_kind: "isometric",
          variant: "tuck",
          series: 1,
          reps: 0,
          target_seconds: 20,
          weight: "",
          rest: "60",
        },
      ],
    });
    render(<SessionEditor session={session} history={[]} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Hoy · Segundos")).toBeVisible();
    expect(screen.queryByLabelText("Hoy · Repeticiones")).toBeNull();
    expect(screen.getByText(/Sin historial comparable/)).toBeVisible();
  });
  it("shows actual previous, target and today separately", () => {
    const plan = {
      day: "Lunes",
      type: "gimnasio" as const,
      exercises: [
        {
          exercise_id: "press",
          name: "Press",
          series: 1,
          reps: 8,
          weight: "40",
          rest: "60",
        },
      ],
    };
    const prev = createSession("user", plan),
      current = createSession("user", plan);
    prev.status = "completed";
    prev.payload.startedAt = "2026-09-01T10:00:00Z";
    prev.payload.exercises[0].sets[0].done = true;
    prev.payload.exercises[0].sets[0].actual = {
      reps: 7,
      kg: 40,
      seconds: null,
      distance: null,
      rpe: null,
    };
    render(
      <SessionEditor session={current} history={[prev]} onChange={vi.fn()} />,
    );
    expect(
      screen.getByText(/Anterior: 7 reps.*Objetivo: 8 reps/),
    ).toBeVisible();
    expect(screen.getByLabelText("Hoy · Repeticiones")).toHaveValue(null);
  });
});
