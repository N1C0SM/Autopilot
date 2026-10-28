import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChipBar, FieldRow } from "@/app/components/admin/AdminOpsParts";

vi.mock("@/shared/lib/native", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/native")>()),
  hapticSelection: vi.fn(),
  hapticTap: vi.fn(),
}));

const OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "paid", label: "Pagados" },
  { value: "unpaid", label: "Sin pagar" },
] as const;

afterEach(cleanup);

describe("ChipBar", () => {
  it("marks only the selected chip as pressed", () => {
    render(<ChipBar options={OPTIONS} value="paid" onChange={() => {}} aria-label="Filtrar" />);
    expect(screen.getByRole("group", { name: "Filtrar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagados" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Sin pagar" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the chosen value", () => {
    const onChange = vi.fn();
    render(<ChipBar options={OPTIONS} value="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Sin pagar" }));
    expect(onChange).toHaveBeenCalledWith("unpaid");
  });
});

describe("FieldRow", () => {
  it("links the label to its field", () => {
    render(
      <FieldRow label="Nombre" htmlFor="field-name">
        <input id="field-name" />
      </FieldRow>,
    );
    expect(screen.getByLabelText("Nombre")).toBe(document.getElementById("field-name"));
  });

  it("renders children as they are when there is no label", () => {
    render(
      <FieldRow columns>
        <input aria-label="Precio" />
        <input aria-label="Moneda" />
      </FieldRow>,
    );
    expect(screen.getByLabelText("Precio")).toBeInTheDocument();
    expect(screen.getByLabelText("Moneda")).toBeInTheDocument();
  });
});
