import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./Index";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
function Destination() {
  const location = useLocation();
  return <p data-testid="destination">{location.pathname}{location.search}{location.hash}</p>;
}
function open(path = "/") {
  return render(<HelmetProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/" element={<Index />} /><Route path="*" element={<Destination />} />
  </Routes></MemoryRouter></HelmetProvider>);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("short public home", () => {
  it("takes the clear primary action to the routine configurator", () => {
    open();
    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent("Tu entrenamiento.");
    fireEvent.click(within(main).getAllByRole("link", { name: /Crear mi rutina gratis/ })[0]);
    expect(screen.getByTestId("destination")).toHaveTextContent("/onboarding");
  });

  it("shows demo, real prices and the four key questions on the home", async () => {
    open();
    const main = screen.getByRole("main");
    expect(within(main).getByRole("link", { name: "Probar la demo" })).toHaveAttribute("href", "#demo");
    expect(main.querySelector("#demo")).not.toBeNull();
    expect(await within(main).findByText("€29")).toBeInTheDocument();
    expect(within(main).getByText("€49")).toBeInTheDocument();
    expect(within(main).getByRole("link", { name: "Ver la comparativa completa" })).toHaveAttribute("href", "/planes");
    expect(within(main).getAllByRole("button", { name: /\?$/ }).length).toBeGreaterThanOrEqual(4);
  });

  it("opens mobile navigation and reaches the questions page", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const menu = screen.getByRole("navigation", { name: "Menú móvil" });
    fireEvent.click(within(menu).getByRole("link", { name: "Dudas" }));
    expect(screen.getByTestId("destination")).toHaveTextContent("/preguntas-frecuentes");
  });

  it.each([
    ["/#pricing", "/planes"], ["/?utm_source=example#ver-app", "/como-funciona?utm_source=example#demo"],
    ["/#equipo", "/equipo"], ["/#como-funciona", "/como-funciona"],
  ])("preserves old section links: %s", (from, expected) => {
    open(from);
    expect(screen.getByTestId("destination").textContent).toBe(expected);
  });
});
