import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomeQuickMenu from "@/app/components/dashboard/HomeQuickMenu";

vi.mock("@/shared/lib/native", () => ({ hapticTap: vi.fn(), hapticSelection: vi.fn(), isNative: () => false }));

afterEach(cleanup);

describe("el «+» de la cabecera de Hoy", () => {
  it("lleva a «Entreno vacío», «Nueva rutina», «Mis rutinas» y «Editar plan», en ese orden", () => {
    const actions = { onEmptyWorkout: vi.fn(), onNewRoutine: vi.fn(), onOpenRoutines: vi.fn(), onEditPlan: vi.fn() };
    render(<HomeQuickMenu {...actions} />);

    const open = () => fireEvent.keyDown(screen.getByRole("button", { name: "Entrenar y rutinas" }), { key: "Enter" });
    open();
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent?.trim())).toEqual([
      "Entreno vacío", "Nueva rutina", "Mis rutinas", "Editar plan",
    ]);
    const steps: [string, () => void][] = [
      ["Entreno vacío", actions.onEmptyWorkout],
      ["Nueva rutina", actions.onNewRoutine],
      ["Mis rutinas", actions.onOpenRoutines],
      ["Editar plan", actions.onEditPlan],
    ];
    for (const [label, handler] of steps) {
      if (!screen.queryByRole("menu")) open();
      fireEvent.click(screen.getByRole("menuitem", { name: label }));
      expect(handler).toHaveBeenCalledOnce();
    }
  });
});
