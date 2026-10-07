import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomeOverview from "./HomeOverview";

const mocks = vi.hoisted(() => ({ hapticTap: vi.fn() }));
vi.mock("@/lib/native", () => ({ hapticTap: mocks.hapticTap }));

afterEach(cleanup);

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
    expect(screen.getByText("Hoy toca Pull B · Espalda y bíceps.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Empezar Pull B · Espalda y bíceps" }));
    expect(onNavigate).toHaveBeenCalledWith("training");
    expect(mocks.hapticTap).toHaveBeenCalledTimes(1);
  });

  it("matches the demo's weekly and nutrition cards while keeping paid nutrition reachable", () => {
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

    expect(screen.getByText("Progreso semanal")).toBeVisible();
    expect(screen.getByText("2 de 3 sesiones")).toBeVisible();
    expect(screen.getByText("Plan de nutrición")).toBeVisible();
    const nutritionCard = screen.getByRole("button", { name: /Nutrición/ });
    expect(nutritionCard).toHaveClass("min-h-24", "p-4", "flex-1", "flex-col");
    expect(nutritionCard.parentElement).toHaveClass("flex", "items-stretch");
    expect(screen.getByRole("button", { name: /Progreso semanal/ })).toHaveClass("min-h-24", "p-4", "flex-1", "flex-col");
    const startButton = screen.getByRole("button", { name: /Empezar Entrenamiento de fuerza/ });
    expect(startButton).toBeVisible();
    expect(startButton).toHaveClass("bg-primary", "text-primary-foreground");
    fireEvent.click(nutritionCard);
    expect(onNavigate).toHaveBeenCalledWith("nutrition");
  });
});
