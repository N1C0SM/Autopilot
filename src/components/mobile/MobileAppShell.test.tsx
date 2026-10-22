import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MobileAppShell from "./MobileAppShell";
import type { MobileTab } from "./MobileTabBar";

const PUSHED: MobileTab[] = ["settings", "resources"];

const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
};

afterEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

const shell = (active: MobileTab, onChange = vi.fn()) => (
  <MobileAppShell title="Hoy" active={active} onChange={onChange} pushedTabs={PUSHED}>
    <div>contenido</div>
  </MobileAppShell>
);

describe("MobileAppShell", () => {
  it("anima la entrada de una pantalla empujada", () => {
    const { rerender } = render(shell("home"));
    expect(screen.getByRole("main")).not.toHaveClass("mobile-screen-push");

    rerender(shell("settings"));
    expect(screen.getByRole("main")).toHaveClass("mobile-screen-push");
  });

  it("vuelve con el gesto de borde desde Ajustes", () => {
    const onChange = vi.fn();
    const { rerender } = render(shell("home", onChange));
    rerender(shell("settings", onChange));

    const main = screen.getByRole("main");
    fireEvent.touchStart(main, { touches: [{ clientX: 5, clientY: 400 }] });
    fireEvent.touchEnd(main, { changedTouches: [{ clientX: 140, clientY: 405 }] });

    expect(onChange).toHaveBeenCalledWith("home");
  });

  it("no vuelve con el gesto si no está en una pantalla empujada", () => {
    const onChange = vi.fn();
    render(shell("home", onChange));

    const main = screen.getByRole("main");
    fireEvent.touchStart(main, { touches: [{ clientX: 5, clientY: 400 }] });
    fireEvent.touchEnd(main, { changedTouches: [{ clientX: 140, clientY: 405 }] });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignora un gesto de borde que se mueve en vertical", () => {
    const onChange = vi.fn();
    const { rerender } = render(shell("home", onChange));
    rerender(shell("settings", onChange));

    const main = screen.getByRole("main");
    fireEvent.touchStart(main, { touches: [{ clientX: 5, clientY: 200 }] });
    fireEvent.touchEnd(main, { changedTouches: [{ clientX: 90, clientY: 420 }] });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("avisa de que no hay conexión y permite reintentar", () => {
    setOnline(false);
    const onRefresh = vi.fn(async () => {});
    render(
      <MobileAppShell
        title="Hoy"
        active="home"
        onChange={vi.fn()}
        pushedTabs={PUSHED}
        onRefresh={onRefresh}
      >
        <div>contenido</div>
      </MobileAppShell>,
    );

    expect(screen.getByText("Sin conexión")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("oculta el aviso y refresca al recuperar la conexión", () => {
    setOnline(false);
    const onRefresh = vi.fn(async () => {});
    render(
      <MobileAppShell
        title="Hoy"
        active="home"
        onChange={vi.fn()}
        pushedTabs={PUSHED}
        onRefresh={onRefresh}
      >
        <div>contenido</div>
      </MobileAppShell>,
    );

    expect(screen.getByText("Sin conexión")).toBeInTheDocument();

    act(() => setOnline(true));

    expect(screen.queryByText("Sin conexión")).not.toBeInTheDocument();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
