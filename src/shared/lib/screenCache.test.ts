import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearScreenCache, readScreen, SCREEN_CACHE_TTL, writeScreen } from "./screenCache";

const USER = "user-1";

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("screenCache", () => {
  it("devuelve lo guardado para ese usuario", () => {
    writeScreen(USER, "dashboard", { name: "Nico" });
    expect(readScreen<{ name: string }>(USER, "dashboard")).toEqual({ name: "Nico" });
  });

  it("no mezcla dos cuentas en el mismo navegador", () => {
    writeScreen(USER, "dashboard", { name: "Nico" });
    writeScreen("user-2", "dashboard", { name: "Otra" });
    expect(readScreen<{ name: string }>(USER, "dashboard")).toEqual({ name: "Nico" });
    expect(readScreen<{ name: string }>("user-2", "dashboard")).toEqual({ name: "Otra" });
  });

  it("ignora una copia caducada", () => {
    vi.useFakeTimers();
    writeScreen(USER, "dashboard", { name: "Nico" });
    vi.advanceTimersByTime(SCREEN_CACHE_TTL + 1000);
    expect(readScreen(USER, "dashboard")).toBeNull();
    vi.useRealTimers();
  });

  it("descarta datos corruptos sin romper la pantalla", () => {
    localStorage.setItem(`autopilot:screen:${USER}:dashboard`, "{no es json");
    expect(readScreen(USER, "dashboard")).toBeNull();
  });

  it("al cerrar sesión borra solo lo de esa cuenta", () => {
    writeScreen(USER, "dashboard", { name: "Nico" });
    writeScreen("user-2", "dashboard", { name: "Otra" });
    clearScreenCache(USER);
    expect(readScreen(USER, "dashboard")).toBeNull();
    expect(readScreen("user-2", "dashboard")).toEqual({ name: "Otra" });
  });
});
