import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MealsList from "./MealsList";

const mocks = vi.hoisted(() => ({ hapticTap: vi.fn() }));
vi.mock("@/lib/native", () => ({ hapticTap: mocks.hapticTap }));

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("meal check-ins", () => {
  it("gives lightweight feedback when a meal is checked and persists the check-in", () => {
    render(<MealsList meals={[{ name: "Desayuno", description: "Avena y yogur" }]} />);
    const meal = screen.getByRole("button", { name: /Desayuno/ });

    expect(meal).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(meal);

    expect(meal).toHaveAttribute("aria-pressed", "true");
    expect(mocks.hapticTap).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(`meals_done_${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`))
      .toBe(JSON.stringify(["Desayuno"]));
  });

  it("explains missing personalized targets and opens profile without inventing macros", () => {
    const onOpenProfile = vi.fn();
    render(
      <MealsList
        meals={[{ name: "Comida", description: "Plato equilibrado" }]}
        macros={null}
        onOpenProfile={onOpenProfile}
      />,
    );

    expect(screen.getByText("Aún no hay objetivos de macros personalizados")).toBeVisible();
    expect(screen.getByText(/coméntaselo a tu entrenador/)).toBeVisible();
    expect(screen.getByText(/Las comidas de abajo son orientativas/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar peso en Perfil" }));
    expect(onOpenProfile).toHaveBeenCalledOnce();
    expect(screen.queryByText(/kcal/)).not.toBeInTheDocument();
  });
});
