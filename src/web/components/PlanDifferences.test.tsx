import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlanDifferences from "@/web/components/PlanDifferences";

vi.mock("@/shared/lib/planCatalog", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/planCatalog")>("@/shared/lib/planCatalog");
  return {
    ...actual,
    // Misma situación real de la tienda: Plus publicado, Coach oculto.
    usePlanAvailability: () => ({
      plans: actual.fallbackCatalog(),
      coach: false,
      plus: true,
      coachPrice: 49,
      plusPrice: 14.99,
      coachName: "Coach",
      plusName: "Plus",
      paidNames: "Plus",
      campaign: false,
    }),
  };
});

afterEach(cleanup);

/** Celda de un plan dentro de una fila de la tabla de escritorio. */
const cellOf = (rowText: string, planIndex: number) => {
  const row = within(screen.getByRole("table"))
    .getAllByText(rowText)[0]
    .closest("tr") as HTMLTableRowElement;
  return within(row).getAllByRole("cell")[planIndex];
};

describe("plans comparison scan rows", () => {
  it("gives Free the basic scan and reserves the advanced scan for Plus", () => {
    render(<PlanDifferences />);

    const basic = "Scan básico: nota de tu físico, resumen y 2 mejoras";
    const advanced = "Scan avanzado: composición, músculos, postura, protocolo y tu yo futuro";

    // Free: básico sí, avanzado no. Plus: los dos.
    expect(within(cellOf(basic, 1)).getByText("Sí")).toBeTruthy();
    expect(within(cellOf(basic, 2)).getByText("Sí")).toBeTruthy();
    expect(within(cellOf(advanced, 1)).getByText("No")).toBeTruthy();
    expect(within(cellOf(advanced, 2)).getByText("Sí")).toBeTruthy();
  });

  it("names the two scan levels in the section intro and the plan taglines", () => {
    render(<PlanDifferences />);
    const intro = screen.getByText((_, node) =>
      node?.tagName === "P" && (node.textContent || "").startsWith("Empieza gratis con tu rutina"));
    expect(intro.textContent).toContain("scan básico");
    expect(intro.textContent).toContain("scan avanzado");
    expect(screen.getAllByText("Tu rutina, tus macros y un scan básico.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tu scan avanzado y tus comidas.").length).toBeGreaterThan(0);
  });
});
