import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TrainingPlanForm from "./TrainingPlanForm";
import type { DayPlan } from "@/types/training";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  const query = { select: () => query, order: () => query, then: (callback: (result: unknown) => void) => callback({ data: [] }) }; return query;
} } }));
vi.mock("@/components/ExerciseMedia", () => ({ ExerciseThumb: () => <span>Miniatura</span> }));
vi.mock("@/components/ExercisePreviewSheet", () => ({ ExercisePreviewSheet: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(cleanup);
const initialPlan: DayPlan[] = [{ day: "Lunes", type: "gimnasio", routine_name: "Entreno A", exercises: [{ exercise_id: "saved", name: "Sentadilla guardada", series: 3, reps: 10, rest: "90s", weight: "20 kg" }] }];
function Editor() { const [plans, setPlans] = useState(initialPlan); return <TrainingPlanForm dayPlans={plans} onChange={setPlans} />; }
describe("trainer routine editor", () => {
  it("preserves a saved exercise when the library is unavailable and updates labeled controls", () => {
    render(<Editor />);
    expect(screen.getByRole("option", { name: "Sentadilla guardada" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Series"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Descanso"), { target: { value: "120s" } });
    expect(screen.getByLabelText("Series")).toHaveValue(4);
    expect(screen.getByLabelText("Descanso")).toHaveValue("120s");
  });
  it("deletes an exercise with a visible, directly available action", () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar ejercicio 1: Sentadilla guardada" }));
    expect(screen.queryByLabelText("Series")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lunes.*0 ejercicios/ })).toBeInTheDocument();
  });
  it("exposes collapsible days as keyboard buttons with expanded state", () => {
    render(<Editor />);
    const day = screen.getByRole("button", { name: /Lunes.*Entreno A/ });
    expect(day).toHaveAttribute("aria-expanded", "true");
    day.focus(); expect(day).toHaveFocus(); fireEvent.click(day);
    expect(day).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Series")).not.toBeInTheDocument();
  });
  it("loads two Full Body sessions on the actual selected weekdays", () => {
    const onChange = vi.fn();
    render(<TrainingPlanForm dayPlans={[]} onChange={onChange} userAvailability={{ training_days: [2, 5, 5], days: "2", hours: 1, coach_style: "direct" }} />);
    expect(screen.getByText("📅 Recomendado (2 días disponibles):")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cargar plantilla" }));
    expect(onChange.mock.calls[0][0].map((plan: DayPlan) => plan.day)).toEqual(["Martes", "Viernes"]);
  });
  it("explains a saved plan frequency mismatch without silently changing it", () => {
    const onChange = vi.fn();
    render(<TrainingPlanForm dayPlans={initialPlan} onChange={onChange} userAvailability={{ days: "2", hours: 1, coach_style: "direct" }} />);
    expect(screen.getByText(/El cliente indicó 2 días de entrenamiento por semana y este plan tiene 1/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
