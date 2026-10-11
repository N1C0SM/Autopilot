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
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent("Crea tu rutina.");
    fireEvent.click(within(main).getByRole("link", { name: /Crear mi rutina gratis/ }));
    expect(screen.getByTestId("destination")).toHaveTextContent("/onboarding");
  });

  it("offers direct pages instead of embedding every section on the home", () => {
    open();
    const main = screen.getByRole("main");
    expect(main.querySelectorAll("section")).toHaveLength(2);
    expect(within(main).getByRole("link", { name: "Ver planes y precios" })).toHaveAttribute("href", "/planes");
    expect(within(main).getByRole("link", { name: "Ver la demo" })).toHaveAttribute("href", "/como-funciona#demo");
    expect(main.querySelector("#pricing")).toBeNull();
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
