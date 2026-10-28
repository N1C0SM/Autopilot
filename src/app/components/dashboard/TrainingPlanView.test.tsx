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
// La portada IA es red: aquí se prueba el respaldo de marca y el resto de la pantalla.
vi.mock("@/shared/hooks/useSessionCover", () => ({ useSessionCover: () => null }));
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
    expect(screen.queryByText(/descanso/i)).not.toBeInTheDocument();
  });

  it("never opens a day without a session and falls back to the next one", () => {
    setToday("2026-10-14T12:00:00"); // miércoles, sin sesión
    render(
      <TrainingPlanView
        dayPlans={[{ day: "Lunes", type: "gimnasio", routine_name: "Piernas", exercises: [squat] }]}
        initialDay="Sábado"
        onOpenWorkout={vi.fn()}
      />,
    );
    // Ni el sábado pedido ni el miércoles de hoy: se abre el lunes, la siguiente sesión.
    expect(screen.getByRole("button", { name: "Lunes, Piernas" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Piernas" })).toBeVisible();
    // Los días sin sesión se pueden abrir (para ver que descansas), pero no se abren solos.
    expect(screen.getByRole("button", { name: "Sábado, descanso" })).toBeEnabled();
    expect(screen.queryByText(/día de descanso/i)).not.toBeInTheDocument();
  });

  it("opens a session from the selector and can open a rest day to see it is rest", () => {
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
    // Hoy es miércoles y no entrena: se abre directamente el jueves, la siguiente sesión.
    const thursday = screen.getByRole("button", { name: "Jueves, Running" });
    expect(thursday).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("45 min")).toBeVisible();
    expect(screen.getByRole("button", { name: "Miércoles, descanso, hoy" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Martes, descanso" })).toBeEnabled();
    expect(screen.queryByText(/día de descanso/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir actividad del jueves" }));
    expect(onOpenWorkout).toHaveBeenCalledWith("Jueves");

    // Pulsar el día activo no lo deselecciona ni deja la vista vacía.
    fireEvent.click(thursday);
    expect(thursday).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("45 min")).toBeVisible();

    // Abrir un día de descanso muestra que descansas y ofrece la próxima sesión.
    fireEvent.click(screen.getByRole("button", { name: "Miércoles, descanso, hoy" }));
    expect(screen.getByText("Hoy es día de descanso")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Ver el jueves" }));
    expect(screen.getByRole("button", { name: "Jueves, Running" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("45 min")).toBeVisible();
  });

  it("sums up the session that opens when today has no session", () => {
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
    expect(screen.getByRole("button", { name: "Jueves, Empuje" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Empuje" })).toBeVisible();
    expect(screen.getByText("1 ejercicio · 3 series")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Lunes, Piernas" }));
    expect(screen.getByText("2 ejercicios · 6 series")).toBeVisible();
  });

  it("shows a neutral state when the plan has no sessions at all", () => {
    setToday("2026-10-14T12:00:00"); // miércoles, sin sesión
    render(<TrainingPlanView dayPlans={[]} onOpenWorkout={vi.fn()} />);
    expect(screen.getByText("Tu plan aún no tiene sesiones")).toBeVisible();
    expect(screen.getByRole("button", { name: "Miércoles, descanso, hoy" })).toBeEnabled();
    expect(screen.queryByText(/día de descanso/i)).not.toBeInTheDocument();
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
