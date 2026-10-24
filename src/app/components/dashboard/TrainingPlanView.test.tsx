import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import TrainingPlanView from "@/app/components/dashboard/TrainingPlanView";
vi.mock("@/shared/hooks/useExerciseMetadata", () => ({ useExerciseMetadata: () => ({ byId: {}, byName: {} }) }));
vi.mock("@/app/components/ExerciseMedia", () => ({
  ExerciseThumb: ({ image }: { image?: string | null }) =>
    image ? <img data-testid="thumb-image" src={image} alt="" /> : <span data-testid="thumb-placeholder" />,
}));
vi.mock("@/app/components/ExerciseFocus", () => ({
  default: ({ exercise }: { exercise: { name: string; image?: string | null } | null }) =>
    exercise ? (
      <div data-testid="focus">
        {exercise.image ? <img data-testid="focus-image" src={exercise.image} alt="" /> : <span data-testid="focus-placeholder" />}
      </div>
    ) : null,
}));
vi.mock("@/shared/components/AIDisclaimer", () => ({ default: () => null }));
vi.mock("@/app/components/dashboard/CalendarExportDialog", () => ({ default: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</> }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const squat = { exercise_id: "squat", name: "Sentadilla", series: 3, reps: 8, weight: "", rest: "90 s" };
const setToday = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};

describe("weekly plan access", () => {
  it("opens an expanded day's routine directly and labels icon actions", () => {
    const onOpenWorkout = vi.fn();
    render(<TrainingPlanView dayPlans={[{ day: "Lunes", type: "gimnasio", routine_name: "Piernas", exercises: [{ exercise_id: "squat", name: "Sentadilla", series: 3, reps: 8, weight: "", rest: "90 s" }] }]} onOpenWorkout={onOpenWorkout} />);
    const monday = screen.getByRole("button", { name: /Lunes.*Piernas/ });
    if (monday.getAttribute("aria-expanded") === "false") fireEvent.click(monday);
    fireEvent.click(screen.getByRole("button", { name: "Abrir sesión del lunes" }));
    expect(onOpenWorkout).toHaveBeenCalledWith("Lunes");
    expect(screen.getByRole("button", { name: "Copiar plan" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Descargar plan" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Exportar plan al calendario" })).toBeVisible();
  });
  it("opens today's session by default", () => {
    setToday("2026-10-12T12:00:00"); // lunes
    render(<TrainingPlanView dayPlans={[{ day: "Lunes", type: "gimnasio", routine_name: "Piernas", exercises: [squat] }]} onOpenWorkout={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Lunes, Piernas, hoy" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Piernas" })).toBeVisible();
    expect(screen.getByText("Sentadilla")).toBeVisible();
    expect(screen.getByRole("button", { name: "Abrir sesión del lunes" })).toBeVisible();
  });

  it("opens on the day asked for, not on today", () => {
    setToday("2026-10-14T12:00:00"); // miércoles, sin sesión
    render(
      <TrainingPlanView
        dayPlans={[{ day: "Jueves", type: "gimnasio", routine_name: "Empuje", exercises: [squat] }]}
        initialDay="Jueves"
        onOpenWorkout={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Jueves, Empuje" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Empuje" })).toBeVisible();
    expect(screen.queryByText("Hoy es día de descanso")).not.toBeInTheDocument();
  });

  it("falls back to today when the asked day has no session", () => {
    setToday("2026-10-14T12:00:00"); // miércoles, sin sesión
    render(
      <TrainingPlanView
        dayPlans={[{ day: "Lunes", type: "gimnasio", routine_name: "Piernas", exercises: [squat] }]}
        initialDay="Sábado"
        onOpenWorkout={vi.fn()}
      />,
    );
    expect(screen.getByText("Hoy es día de descanso")).toBeVisible();
  });

  it("switches sessions from the day selector and keeps rest days inert", () => {
    setToday("2026-10-14T12:00:00"); // miércoles, sin sesión
    const onOpenWorkout = vi.fn();
    render(
      <TrainingPlanView
        dayPlans={[
          { day: "Lunes", type: "gimnasio", routine_name: "Piernas", exercises: [squat] },
          { day: "Jueves", type: "actividad", sport: "Running", intensity: "Media", duration: "45 min" },
        ]}
        onOpenWorkout={onOpenWorkout}
      />,
    );
    expect(screen.getByRole("button", { name: "Miércoles, descanso, hoy" })).toBeDisabled();
    expect(screen.getByText("Hoy es día de descanso")).toBeVisible();

    const thursday = screen.getByRole("button", { name: "Jueves, Running" });
    fireEvent.click(thursday);
    expect(thursday).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("45 min")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Abrir actividad del jueves" }));
    expect(onOpenWorkout).toHaveBeenCalledWith("Jueves");

    fireEvent.click(thursday);
    expect(screen.getByText("Elige un día")).toBeVisible();
  });

  it("sums up the session and offers the next session from a rest day", () => {
    setToday("2026-10-14T12:00:00"); // miércoles, sin sesión
    render(
      <TrainingPlanView
        dayPlans={[
          { day: "Lunes", type: "gimnasio", routine_name: "Piernas", exercises: [squat, { ...squat, exercise_id: "lunge", name: "Zancada" }] },
          { day: "Jueves", type: "gimnasio", routine_name: "Empuje", exercises: [squat] },
        ]}
        onOpenWorkout={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver el jueves" }));
    expect(screen.getByRole("button", { name: "Jueves, Empuje" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Empuje" })).toBeVisible();
    expect(screen.getByText("1 ejercicio · 3 series")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Lunes, Piernas" }));
    expect(screen.getByText("2 ejercicios · 6 series")).toBeVisible();
  });

  it("re-syncs the expanded day when a new day is asked for", () => {
    setToday("2026-10-14T12:00:00"); // miércoles, sin sesión
    const { rerender } = render(
      <TrainingPlanView
        dayPlans={[
          { day: "Lunes", type: "gimnasio", routine_name: "Piernas", exercises: [squat] },
          { day: "Jueves", type: "gimnasio", routine_name: "Empuje", exercises: [squat] },
        ]}
        initialDay="Lunes"
        onOpenWorkout={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Lunes, Piernas" })).toHaveAttribute("aria-expanded", "true");
    rerender(
      <TrainingPlanView
        dayPlans={[
          { day: "Lunes", type: "gimnasio", routine_name: "Piernas", exercises: [squat] },
          { day: "Jueves", type: "gimnasio", routine_name: "Empuje", exercises: [squat] },
        ]}
        initialDay="Jueves"
        onOpenWorkout={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Jueves, Empuje" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Lunes, Piernas" })).toHaveAttribute("aria-expanded", "false");
  });

  it("falls back to the composed placeholder when an exercise image fails to load", () => {
    setToday("2026-10-12T12:00:00"); // lunes
    render(
      <TrainingPlanView
        dayPlans={[{ day: "Lunes", type: "gimnasio", routine_name: "Piernas", exercises: [{ ...squat, image_url: "https://cdn.test/squat.jpg" }] }]}
        onOpenWorkout={vi.fn()}
      />,
    );
    fireEvent.error(screen.getByTestId("thumb-image"));
    expect(screen.queryByTestId("thumb-image")).toBeNull();
    expect(screen.getByTestId("thumb-placeholder")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Sentadilla"));
    expect(screen.getByTestId("focus")).toBeInTheDocument();
    expect(screen.queryByTestId("focus-image")).toBeNull();
    expect(screen.getByTestId("focus-placeholder")).toBeInTheDocument();
  });
});
