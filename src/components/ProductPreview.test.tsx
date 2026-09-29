import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProductPreview from "./ProductPreview";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
afterEach(cleanup);

describe("public product preview", () => {
  it("records, undoes and resets sample exercises", async () => {
    render(<ProductPreview onPlans={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan", exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Completar Sentadilla goblet" }));
    fireEvent.click(screen.getByRole("button", { name: "Completar Remo con mancuerna" }));
    expect(await screen.findByRole("status")).toHaveTextContent("2 de 3");
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Sentadilla goblet" }));
    expect(await screen.findByRole("status")).toHaveTextContent("1 de 3");
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar demo" }));
    expect(await screen.findByRole("status")).toHaveTextContent("0 de 3");
  });

  it("retains the demo session across views and labels illustrative data", async () => {
    render(<ProductPreview onPlans={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan", exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Completar Remo con mancuerna" }));
    fireEvent.click(screen.getByRole("button", { name: "Nutrición", exact: true }));
    await waitFor(() => expect(screen.getByText(/Comidas ilustrativas/)).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Progreso" }));
    await waitFor(() => expect(screen.getByText(/no representan resultados de un cliente/)).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Plan", exact: true }));
    expect(await screen.findByRole("status")).toHaveTextContent("1 de 3");
    expect(screen.getByText(/Demo con datos ficticios/)).toBeVisible();
  });

  it("lets a visitor move to pricing without registering", () => {
    const onPlans = vi.fn();
    render(<ProductPreview onPlans={onPlans} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver qué incluye cada plan/ }));
    expect(onPlans).toHaveBeenCalledOnce();
  });
  it("offers free signup separately from paid plans", () => {
    const onFree = vi.fn();
    const onPlans = vi.fn();
    render(<ProductPreview onPlans={onPlans} onFree={onFree} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta gratis y guardar mi progreso" }));
    expect(onFree).toHaveBeenCalledOnce();
    expect(onPlans).not.toHaveBeenCalled();
  });

});
