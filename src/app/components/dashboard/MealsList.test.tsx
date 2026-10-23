import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MealsList from "@/app/components/dashboard/MealsList";

const mocks = vi.hoisted(() => ({ hapticTap: vi.fn(), isNative: vi.fn().mockReturnValue(false) }));
vi.mock("@/shared/lib/native", () => ({ hapticTap: mocks.hapticTap, isNative: mocks.isNative }));

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("meal check-ins", () => {
  it("does not turn an unweighed meal check-in into consumed calories", () => {
    render(<MealsList meals={[{ name: "Comida", description: "Plato equilibrado" }]} macros={{ protein: 140, carbs: 220, fats: 65 }} />);
    fireEvent.click(screen.getByRole("button", { name: /Comida Plato equilibrado/ }));
    expect(screen.getByText(/Marcar comidas no mide las calorías consumidas/)).toBeVisible();
    expect(screen.getByText("kcal de objetivo diario")).toBeVisible();
  });
  it("flags existing invalid targets while preserving the saved meal", () => {
    render(<MealsList meals={[{ name: "Cena", description: "Guardada" }]} macros={{ protein: 50, carbs: 100, fats: 500 }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("pendientes de revisión");
    expect(screen.getByRole("button", { name: /Cena/ })).toBeVisible();
    expect(screen.queryByText("kcal de objetivo diario")).not.toBeInTheDocument();
  });
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

    expect(screen.getByText("Tus macros aún no están personalizados")).toBeVisible();
    expect(screen.getByText(/Añade tu peso actual para calcularlos/)).toBeVisible();
    expect(screen.getByText(/las comidas de abajo son orientativas/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Añadir peso" }));
    expect(onOpenProfile).toHaveBeenCalledOnce();
    expect(mocks.hapticTap).toHaveBeenCalledOnce();
    expect(screen.queryByText(/kcal/)).not.toBeInTheDocument();
  });
});

describe("day summary", () => {
  const meals = [
    { name: "Desayuno", description: "Avena" },
    { name: "Cena", description: "Pescado" },
  ];

  it("fills the ring with the meals checked today and says how many are left", () => {
    render(<MealsList meals={meals} macros={null} />);

    expect(screen.getByRole("progressbar", { name: "0 de 2 comidas hechas hoy" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("Te quedan 2 comidas")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Desayuno/ }));
    expect(screen.getByRole("progressbar", { name: "1 de 2 comidas hechas hoy" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("Te queda 1 comida")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Cena/ }));
    expect(screen.getByRole("progressbar", { name: "2 de 2 comidas hechas hoy" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Día completo")).toBeVisible();
  });

  it("shows each macro target with its real share of the day's energy", () => {
    render(<MealsList meals={meals} macros={{ protein: 140, carbs: 220, fats: 65 }} />);

    expect(screen.getByText("2025")).toBeVisible();
    expect(screen.getByRole("group", { name: "Proteína: objetivo diario de 140 gramos, 28 % de las calorías" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Carbos: objetivo diario de 220 gramos, 43 % de las calorías" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Grasas: objetivo diario de 65 gramos, 29 % de las calorías" })).toBeVisible();
  });

  it("keeps the plan's calorie target when it is set explicitly", () => {
    render(<MealsList meals={[]} macros={{ protein: 140, carbs: 220, fats: 65, calories: 2000 }} />);

    expect(screen.getByText("2000")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Sin comidas todavía")).toBeVisible();
  });

  it("does not draw a summary while the plan is still being prepared", () => {
    render(<MealsList meals={[]} macros={null} />);

    expect(screen.getByText("Aún no hay plan de comidas")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
