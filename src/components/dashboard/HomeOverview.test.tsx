import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomeOverview from "./HomeOverview";

const mocks = vi.hoisted(() => ({ hapticTap: vi.fn(), ios: false }));
vi.mock("@/lib/native", () => ({ hapticTap: mocks.hapticTap }));
vi.mock("@/lib/platform", () => ({ isIOSNative: () => mocks.ios }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ios = false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const today = DAYS[(new Date().getDay() + 6) % 7];

describe("dashboard home overview", () => {
  it("shows today's session as the primary action and navigates to the workout", () => {
    const onNavigate = vi.fn();
    render(
      <HomeOverview
        dayPlans={[{ day: today, type: "gimnasio", routine_name: "Pull B", muscle_focus: "Espalda · Bíceps", exercises: [{ exercise_id: "squat", name: "Sentadilla", series: 3, reps: 8, weight: "", rest: "90 s" }] }]}
        onNavigate={onNavigate}
        profileName="Nicolás Pérez"
      />,
    );

    expect(screen.getByText("Hola, Nicolás.")).toBeVisible();
    expect(screen.getByText("A entrenar.")).toBeVisible();
    const greeting = screen.getByRole("heading", { level: 2 });
    expect(greeting).toHaveTextContent("Hola, Nicolás.");
    expect(greeting).toHaveTextContent("A entrenar.");
    // El saludo es corto: la sesión se nombra solo en su tarjeta.
    expect(screen.queryByText(/Hoy toca/)).not.toBeInTheDocument();
    const startButton = screen.getByRole("button", { name: "Empezar Pull B · Espalda y bíceps" });
    expect(within(startButton).getByText("Pull B · Espalda y bíceps")).toBeVisible();
    expect(within(startButton).getByText("1 ejercicio")).toBeVisible();
    expect(within(startButton).getByText("Empezar")).toBeVisible();
    fireEvent.click(startButton);
    expect(onNavigate).toHaveBeenCalledWith("training");
    expect(mocks.hapticTap).toHaveBeenCalledTimes(1);
  });

  it("shows the weekly progress and nutrition cards while keeping paid nutrition reachable", () => {
    const onNavigate = vi.fn();
    render(
      <HomeOverview
        dayPlans={[
          { day: today, type: "gimnasio", exercises: [] },
          { day: DAYS[(DAYS.indexOf(today) + 1) % 7], type: "gimnasio", exercises: [] },
          { day: DAYS[(DAYS.indexOf(today) + 2) % 7], type: "actividad", sport: "Correr", duration: "30 min" },
        ]}
        onNavigate={onNavigate}
        completedThisWeek={2}
        nutrition={false}
        coaching={false}
      />,
    );

    expect(screen.getByText("Progreso")).toBeVisible();
    expect(screen.getByText("2 de 3 sesiones")).toBeVisible();
    expect(screen.getByText("Plan de nutrición")).toBeVisible();
    const nutritionCard = screen.getByRole("button", { name: /Nutrición/ });
    const progressCard = screen.getByRole("button", { name: /Progreso/ });
    expect(nutritionCard).toBeVisible();
    expect(progressCard).toBeVisible();
    // Las dos tarjetas secundarias van juntas, después de la acción principal.
    expect(nutritionCard.parentElement).toBe(progressCard.parentElement);
    const startButton = screen.getByRole("button", { name: /Empezar Entrenamiento de fuerza/ });
    expect(startButton).toBeVisible();
    expect(within(startButton).getByText("Empezar")).toBeVisible();
    expect(screen.getAllByRole("button")[0]).toBe(startButton);
    fireEvent.click(nutritionCard);
    expect(onNavigate).toHaveBeenLastCalledWith("nutrition");
    fireEvent.click(progressCard);
    expect(onNavigate).toHaveBeenLastCalledWith("progress");
    expect(mocks.hapticTap).toHaveBeenCalledTimes(2);
  });

  it("opens the routine week on a rest Sunday", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T12:00:00"));
    const onNavigate = vi.fn();
    const onStartWorkout = vi.fn();
    render(<HomeOverview dayPlans={[{ day: "Lunes", type: "gimnasio", exercises: [] }]} onNavigate={onNavigate} onStartWorkout={onStartWorkout} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver rutina semanal" }));
    expect(onNavigate).toHaveBeenCalledWith("training");
    expect(onStartWorkout).not.toHaveBeenCalled();
  });

  it("uses the direct start action only for today's planned session", () => {
    const onNavigate = vi.fn();
    const onStartWorkout = vi.fn();
    render(<HomeOverview dayPlans={[{ day: today, type: "gimnasio", exercises: [] }]} onNavigate={onNavigate} onStartWorkout={onStartWorkout} />);
    fireEvent.click(screen.getByRole("button", { name: /Empezar Entrenamiento/ }));
    expect(onStartWorkout).toHaveBeenCalledOnce();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("sums up today's session with its series and an approximate length", () => {
    render(
      <HomeOverview
        dayPlans={[{
          day: today,
          type: "gimnasio",
          routine_name: "Pull B",
          exercises: [
            { exercise_id: "row", name: "Remo", series: 4, reps: 8, weight: "", rest: "2 min" },
            { exercise_id: "curl", name: "Curl", series: 3, reps: 12, weight: "", rest: "90 s" },
          ],
        }]}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Empezar Pull B" })).toHaveTextContent("2 ejercicios · 7 series · unos 20 min");
  });

  it("tells the next session on a rest day", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T12:00:00"));
    render(<HomeOverview dayPlans={[{ day: "Viernes", type: "gimnasio", routine_name: "Pull B", exercises: [] }]} onNavigate={vi.fn()} />);

    expect(screen.getByText("Día de recuperación")).toBeVisible();
    expect(screen.getByText("Tu próxima sesión es el viernes: Pull B.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Empezar/ })).not.toBeInTheDocument();
  });

  it("marks today as done and opens progress once the session is logged", () => {
    const onNavigate = vi.fn();
    render(<HomeOverview dayPlans={[{ day: today, type: "gimnasio", exercises: [] }]} onNavigate={onNavigate} completedToday />);

    expect(screen.getByText("Entrenamiento completado")).toBeVisible();
    expect(screen.getByRole("list", { name: "Tu semana" })).toHaveTextContent(`${today}, hoy: completado`);
    fireEvent.click(screen.getByRole("button", { name: "Ver progreso de la sesión" }));
    expect(onNavigate).toHaveBeenCalledWith("progress");
    expect(mocks.hapticTap).toHaveBeenCalledTimes(1);
  });

  it("never mentions the paid plan on iOS", () => {
    const props = { dayPlans: [{ day: today, type: "gimnasio" as const, exercises: [] }], onNavigate: vi.fn(), nutrition: false, coaching: false };
    render(<HomeOverview {...props} />);
    expect(screen.getByText(/Incluido en Plus/)).toBeVisible();
    cleanup();

    mocks.ios = true;
    render(<HomeOverview {...props} />);
    expect(screen.getByText("Plan de nutrición")).toBeVisible();
    expect(screen.queryByText(/Incluido en Plus/)).not.toBeInTheDocument();
  });
});
