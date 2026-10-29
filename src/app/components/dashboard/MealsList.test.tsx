import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MealsList from "@/app/components/dashboard/MealsList";
import { useMealPhoto } from "@/shared/hooks/useSessionCover";

const mocks = vi.hoisted(() => ({
  hapticTap: vi.fn(),
  isNative: vi.fn().mockReturnValue(false),
  invoke: vi.fn(),
}));
vi.mock("@/shared/lib/native", () => ({ hapticTap: mocks.hapticTap, isNative: mocks.isNative }));
// La foto de cada plato la resuelve `session-cover`: se controla aquí para que el test sea
// determinista y para poder dejar una petición «en camino» (que es cuando se colaba la vieja).
vi.mock("@/shared/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  mocks.invoke.mockResolvedValue({ data: { url: null }, error: null });
});
afterEach(cleanup);

describe("meal check-ins", () => {
  it("adds each checked meal's macros and all of them add up to the daily target", () => {
    const meals = [{ name: "Desayuno", description: "Avena" }, { name: "Cena", description: "Pescado" }];
    render(<MealsList meals={meals} macros={{ protein: 140, carbs: 220, fats: 65 }} />);
    expect(screen.getByText(/^de 2\.?025 kcal$/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Desayuno Avena/ }));
    expect(screen.getByRole("group", { name: "Proteína: 70 de 140 gramos" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Cena Pescado/ }));
    expect(screen.getByRole("group", { name: "Proteína: 140 de 140 gramos" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Carbos: 220 de 220 gramos" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Grasas: 65 de 65 gramos" })).toBeVisible();
    expect(screen.getByText(/Es una estimación/)).toBeVisible();
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

  it("without meals, shows each macro target with its real share of the day's energy", () => {
    render(<MealsList meals={[]} macros={{ protein: 140, carbs: 220, fats: 65 }} />);

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

/** Deja cada petición de foto pendiente y devuelve la lista para resolverlas a mano. */
const pendingCovers = () => {
  const pending: Array<(url: string | null) => void> = [];
  mocks.invoke.mockImplementation(() => new Promise((resolve) => {
    pending.push((url) => resolve({ data: { url }, error: null }));
  }));
  return pending;
};

const OLD_DISH = "Plato A";
const OLD_PHOTO = "https://cdn.test/plato-a.jpg";
const NEW_DISH = "Plato B";
const NEW_PHOTO = "https://cdn.test/plato-b.jpg";

/** Cuenta cada valor que devuelve el hook en cada render: así se ve el frame con la foto vieja. */
const PhotoProbe = ({ dish, seen }: { dish: string; seen: Array<string | null> }) => {
  seen.push(useMealPhoto(dish));
  return null;
};

describe("meal photos follow the current dish", () => {
  it("never paints the previous dish's photo while the new one is on its way", async () => {
    const pending = pendingCovers();
    const seen: Array<string | null> = [];
    const { rerender } = render(<PhotoProbe dish={OLD_DISH} seen={seen} />);

    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => { pending[0](OLD_PHOTO); });
    await waitFor(() => expect(seen[seen.length - 1]).toBe(OLD_PHOTO));

    // Se regenera el plan: el primer render con el plato nuevo no puede seguir enseñando el viejo.
    seen.length = 0;
    rerender(<PhotoProbe dish={NEW_DISH} seen={seen} />);
    expect(seen).not.toContain(OLD_PHOTO);
    expect(seen.every((url) => url === null)).toBe(true);

    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => { pending[1](NEW_PHOTO); });
    await waitFor(() => expect(seen[seen.length - 1]).toBe(NEW_PHOTO));
  });

  it("shows the new dish's cached photo straight away instead of the previous one", async () => {
    localStorage.setItem("autopilot.aiCovers.v1", JSON.stringify({ "m:plato b": NEW_PHOTO }));
    const pending = pendingCovers();
    const seen: Array<string | null> = [];
    const { rerender } = render(<PhotoProbe dish={OLD_DISH} seen={seen} />);

    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => { pending[0](OLD_PHOTO); });
    await waitFor(() => expect(seen[seen.length - 1]).toBe(OLD_PHOTO));

    seen.length = 0;
    rerender(<PhotoProbe dish={NEW_DISH} seen={seen} />);
    expect(seen).not.toContain(OLD_PHOTO);
    expect(seen[seen.length - 1]).toBe(NEW_PHOTO);
  });
});

describe("meal rows", () => {
  it("remounts the row when the dish changes so it cannot inherit the old photo", () => {
    localStorage.setItem("autopilot.aiCovers.v1", JSON.stringify({ "m:plato a": OLD_PHOTO, "m:plato b": NEW_PHOTO }));
    const { container, rerender } = render(
      <MealsList meals={[{ name: "Comida", description: OLD_DISH }]} />,
    );
    const before = container.querySelector("button img");
    expect(before).not.toBeNull();

    rerender(<MealsList meals={[{ name: "Comida", description: NEW_DISH }]} />);
    const after = container.querySelector("button img");

    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
  });

  it("shows no photo instead of repeating the same fallback on every meal", async () => {
    localStorage.setItem("autopilot.aiCovers.v1", JSON.stringify({ "m:plato a": OLD_PHOTO }));
    const { container } = render(
      <MealsList meals={[{ name: "Desayuno", description: OLD_DISH }, { name: "Comida", description: NEW_DISH }]} macros={{ protein: 140, carbs: 220, fats: 65 }} />,
    );
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalled());
    const photos = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    // Solo la foto propia del plato A; el B, sin foto. Y ninguna portada encima del resumen.
    expect(photos).toEqual([OLD_PHOTO]);
  });
});
