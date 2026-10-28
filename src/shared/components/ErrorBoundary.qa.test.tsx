import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import ErrorBoundary from "@/shared/components/ErrorBoundary";

const Boom = () => {
  throw new Error("boom de render");
};

/**
 * Regresión del bucle infinito de recargas: tras un fallo de render reproducible,
 * la app debe recargar como mucho una vez y acabar mostrando la pantalla de error
 * (antes borraba la marca al montar y recargaba para siempre → pantalla en blanco).
 */
describe("ErrorBoundary: sin bucle de recargas", () => {
  const reload = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockReset();
    // jsdom no permite espiar location.reload(): se sustituye location.
    delete window.location;
    // @ts-expect-error jsdom
    window.location = { ...originalLocation, reload };
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    // @ts-expect-error jsdom
    window.location = originalLocation;
  });

  it("recarga una vez y la segunda vez muestra el error (no recarga en bucle)", async () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    // 3 reintentos de 250 ms + recarga a los 400 ms.
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1), { timeout: 6000 });

    // «Recarga»: se vuelve a montar todo (sessionStorage sobrevive) y el fallo se repite.
    cleanup();
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(await screen.findByText("Algo no ha cargado bien", {}, { timeout: 6000 })).toBeInTheDocument();
    // No hay una segunda recarga automática: antes esto era un bucle infinito.
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("autopilot_auto_reload")).not.toBeNull();
  });

  it("pasada la ventana de 60 s sí permite otra recarga automática", async () => {
    sessionStorage.setItem("autopilot_auto_reload", String(Date.now() - 61_000));
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1), { timeout: 6000 });
  });
});
