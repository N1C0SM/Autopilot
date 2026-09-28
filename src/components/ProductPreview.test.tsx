import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProductPreview from "./ProductPreview";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
afterEach(cleanup);

describe("public product preview", () => {
  it("records, undoes and resets sample exercises", () => {
    render(<ProductPreview onPlans={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Completar Sentadilla goblet" }));
    fireEvent.click(screen.getByRole("button", { name: "Completar Remo con mancuerna" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 de 3 completados");
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Sentadilla goblet" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 de 3 completados");
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar demo" }));
    expect(screen.getByRole("status")).toHaveTextContent("0 de 3 completados");
  });

  it("retains the demo session across views and labels illustrative data", () => {
    render(<ProductPreview onPlans={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Completar Remo con mancuerna" }));
    fireEvent.click(screen.getByRole("button", { name: "Nutrición" }));
    expect(screen.getByText(/Comidas ilustrativas/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Progreso" }));
    expect(screen.getByText(/no representan resultados de un cliente/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Entrenamiento" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 de 3 completados");
    expect(screen.getByText(/Demo con datos ficticios/)).toBeVisible();
  });

  it("lets a visitor move to pricing without registering", () => {
    const onPlans = vi.fn();
    render(<ProductPreview onPlans={onPlans} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver qué incluye cada plan/ }));
    expect(onPlans).toHaveBeenCalledOnce();
  });
});
