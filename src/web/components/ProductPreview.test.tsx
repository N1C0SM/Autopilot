import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import ProductPreview from "@/web/components/ProductPreview";

vi.mock("@/shared/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/app/components/dashboard/ExerciseProgressChart", () => ({
  default: ({ exerciseName, metric, onMetricChange }: {
    exerciseName: string;
    metric: string;
    onMetricChange: (value: "volumeKg" | "bestEstimated1RmKg") => void;
  }) => createElement(
    "div",
    { role: "img", "aria-label": `Gráfica de ${metric === "volumeKg" ? "volumen" : "fuerza estimada"} para ${exerciseName}` },
    createElement("button", { onClick: () => onMetricChange("bestEstimated1RmKg") }, "Fuerza estimada"),
  ),
}));

vi.mock("@/shared/lib/planCatalog", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/planCatalog")>("@/shared/lib/planCatalog");
  return {
    ...actual,
    usePlanAvailability: () => ({
      plans: actual.fallbackCatalog(),
      coach: true,
      plus: true,
      coachPrice: 49,
      plusPrice: 29,
      coachName: "Coach",
      plusName: "Plus",
      paidNames: "Plus y Coach",
    }),
  };
});
afterEach(cleanup);

describe("public product preview", () => {
  it("renders read-only screens from sample data and switches them from the visible tabs", () => {
    render(<ProductPreview onPlans={() => {}} />);
    expect(screen.getByRole("heading", { name: /Hola, Nicolás/ })).toBeVisible();
    expect(screen.getByText("Muestra interactiva · datos de ejemplo")).toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Nutrición" }));
    expect(screen.getByRole("heading", { name: "Tus objetivos diarios" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Nutrición" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "Entrenar" }));
    expect(screen.getByRole("heading", { name: "Entrenar" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "Secciones de la demo" })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Progreso" }));
    expect(screen.getByRole("heading", { name: "Progreso" })).toBeVisible();
    expect(screen.getByText("Datos de ejemplo")).toBeVisible();
  });

  it("presents macros as free and has no chat tab", () => {
    render(<ProductPreview onPlans={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "Nutrición" }));
    expect(screen.getByText("Tus macros y comidas, con Plus.")).toBeVisible();
    expect(screen.queryByRole("tab", { name: "Chat" })).toBeNull();
  });
});
