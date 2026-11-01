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
  it("shows real app screenshots and switches them from the visible tabs", () => {
    render(<ProductPreview onPlans={() => {}} />);
    expect(screen.getByRole("img", { name: /Pantalla Hoy/ })).toHaveAttribute("src", "/app-shots/hoy.jpg");
    fireEvent.click(screen.getByRole("tab", { name: "Nutrición" }));
    expect(screen.getByRole("img", { name: /Pantalla Nutrición/ })).toHaveAttribute("src", "/app-shots/nutricion.jpg");
    expect(screen.getByRole("tab", { name: "Nutrición" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Entrenar" }));
    expect(screen.getByRole("img", { name: /Pantalla Entrenar/ })).toHaveAttribute("src", "/app-shots/registro.jpg");
  });

  it("presents macros as free and has no chat tab", () => {
    render(<ProductPreview onPlans={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "Nutrición" }));
    expect(screen.getByText("Tus macros y comidas, con Plus.")).toBeVisible();
    expect(screen.queryByRole("tab", { name: "Chat" })).toBeNull();
  });
});
