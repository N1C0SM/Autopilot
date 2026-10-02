import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomeOverview from "./HomeOverview";

afterEach(cleanup);

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const today = DAYS[(new Date().getDay() + 6) % 7];

describe("dashboard home overview", () => {
  it("shows today's session as the primary action and navigates to the workout", () => {
    const onNavigate = vi.fn();
    render(
      <HomeOverview
        dayPlans={[{ day: today, type: "gimnasio", routine_name: "Fuerza cuerpo completo", muscle_focus: "Cuerpo completo", exercises: [{ exercise_id: "squat", name: "Sentadilla", series: 3, reps: 8, weight: "", rest: "90 s" }] }]}
        onNavigate={onNavigate}
        profileName="Nicolás Pérez"
      />,
    );

    expect(screen.getByText("Hola, Nicolás.")).toBeVisible();
    expect(screen.getByText("Fuerza cuerpo completo")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Empezar Fuerza cuerpo completo" }));
    expect(onNavigate).toHaveBeenCalledWith("training");
  });

  it("shows the weekly completion count and keeps paid nutrition reachable", () => {
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

    expect(screen.getByText("2 de 3 sesiones")).toBeVisible();
    expect(screen.getByText("Incluida en Plan Completo")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Nutrición/ }));
    expect(onNavigate).toHaveBeenCalledWith("nutrition");
  });
});
