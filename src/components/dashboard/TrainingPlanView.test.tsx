import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import TrainingPlanView from "./TrainingPlanView";
vi.mock("@/hooks/useExerciseMetadata", () => ({ useExerciseMetadata: () => ({ byId: {}, byName: {} }) }));
vi.mock("@/components/ExerciseMedia", () => ({ ExerciseThumb: () => null }));
vi.mock("@/components/ExerciseFocus", () => ({ default: () => null }));
vi.mock("@/components/AIDisclaimer", () => ({ default: () => null }));
vi.mock("./CalendarExportDialog", () => ({ default: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</> }));
afterEach(cleanup);
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
});
