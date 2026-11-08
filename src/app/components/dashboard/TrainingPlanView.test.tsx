import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/shared/hooks/useSessionCover", () => ({ useSessionCover: () => null, cachedSessionCover: () => null }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const squat = { exercise_id: "squat", name: "Sentadilla", series: 3, reps: 8, weight: "", rest: "90 s" };
const setToday = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};

describe("routine in order", () => {
  const plans = [
    { day: "Lunes", type: "gimnasio" as const, routine_name: "Piernas", exercises: [squat, { ...squat, exercise_id: "lunge", name: "Zancada" }] },
    { day: "Jueves", type: "gimnasio" as const, routine_name: "Empuje", exercises: [squat] },
    { day: "Sábado", type: "actividad" as const, sport: "Running", intensity: "Media", duration: "45 min" },
  ];

  it("lists only the sessions in order, without weekdays or rest days", () => {
    setToday("2026-10-14T12:00:00"); // miércoles: no cambia nada
    render(<TrainingPlanView dayPlans={plans} onOpenWorkout={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Sesión 1: Piernas, siguiente" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sesión 2: Empuje" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sesión 3: Running" })).toBeVisible();
    expect(screen.queryByText(/lunes|jueves|sábado|miércoles/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/descanso/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Días de la semana" })).not.toBeInTheDocument();
    expect(screen.getByText("0 de 3 esta semana")).toBeVisible();
  });

  it("opens the next pending session and starts it whatever the day", () => {
    const onOpenWorkout = vi.fn();
    render(<TrainingPlanView dayPlans={plans} doneThisWeek={["Lunes"]} onOpenWorkout={onOpenWorkout} />);
    expect(screen.getByRole("button", { name: "Sesión 1: Piernas, hecha esta semana" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Sesión 2: Empuje, siguiente" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("1 de 3 esta semana")).toBeVisible();
    expect(screen.getByText("1 ejercicio · 3 series")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Empezar sesión" }));
    expect(onOpenWorkout).toHaveBeenCalledWith("Jueves");
    // Sin copiar, descargar ni exportar: solo la rutina.
    expect(screen.queryByRole("button", { name: "Copiar plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Descargar plan" })).not.toBeInTheDocument();
  });

  it("shows completed sessions without offering to start them again", () => {
    render(<TrainingPlanView dayPlans={plans} initialDay="Lunes" doneToday={["Lunes"]} onOpenWorkout={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Entrenamiento completado");
    expect(screen.queryByRole("button", { name: "Empezar sesión" })).not.toBeInTheDocument();
  });

  it("offers to resume a saved workout draft", () => {
    const onOpenWorkout = vi.fn();
    render(<TrainingPlanView dayPlans={plans} initialDay="Jueves" resumableDay="Jueves" onOpenWorkout={onOpenWorkout} />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar entreno" }));
    expect(onOpenWorkout).toHaveBeenCalledWith("Jueves");
  });

  it("folds the open session on a second tap and keeps the rest folded", () => {
    render(<TrainingPlanView dayPlans={plans} onOpenWorkout={vi.fn()} />);
    const first = screen.getByRole("button", { name: "Sesión 1: Piernas, siguiente" });
    expect(first).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Empezar sesión" })).not.toBeInTheDocument();
  });

  it("personalizes a session name and icon with the suggestion", async () => {
    const onPersonalize = vi.fn().mockResolvedValue(true);
    render(<TrainingPlanView dayPlans={[{ ...plans[0], session_icon: "🔥", exercises: [{ ...squat, muscle_group: "Cuádriceps" }] }, ...plans.slice(1)]} onOpenWorkout={vi.fn()} onPersonalize={onPersonalize} />);
    fireEvent.click(screen.getByRole("button", { name: /Nombre e icono/ }));
    expect(await screen.findByText("Personalizar sesión")).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: "🦵, sugerido" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onPersonalize).toHaveBeenCalledWith("Lunes", { name: "Piernas", icon: "🦵" }));
  });

  it("opens the session asked for from Hoy and any other on tap", () => {
    const onOpenWorkout = vi.fn();
    const { rerender } = render(<TrainingPlanView dayPlans={plans} initialDay="Sábado" onOpenWorkout={onOpenWorkout} />);
    expect(screen.getByRole("button", { name: "Sesión 3: Running" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("45 min")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Empezar actividad" }));
    expect(onOpenWorkout).toHaveBeenCalledWith("Sábado");

    fireEvent.click(screen.getByRole("button", { name: "Sesión 1: Piernas, siguiente" }));
    expect(screen.getByText("2 ejercicios · 6 series")).toBeVisible();

    rerender(<TrainingPlanView dayPlans={plans} initialDay="Jueves" onOpenWorkout={onOpenWorkout} />);
    expect(screen.getByRole("button", { name: "Sesión 2: Empuje" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Sesión 1: Piernas, siguiente" })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the first session again when the whole week is done", () => {
    render(<TrainingPlanView dayPlans={plans} doneThisWeek={["Lunes", "Jueves", "Sábado"]} onOpenWorkout={vi.fn()} />);
    expect(screen.getByText("3 de 3 esta semana")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sesión 1: Piernas, hecha esta semana" })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows a neutral state when the plan has no sessions at all", () => {
    render(<TrainingPlanView dayPlans={[]} onOpenWorkout={vi.fn()} />);
    expect(screen.getByText("Tu plan aún no tiene sesiones")).toBeVisible();
    expect(screen.queryByText(/esta semana/)).not.toBeInTheDocument();
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
