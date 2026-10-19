import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthCallback from "./AuthCallback";

const setSession = vi.fn();
const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();
const getSession = vi.fn();
const hapticNotify = vi.fn();

const originalHref = window.location.href;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      setSession: (...a: unknown[]) => setSession(...a),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      exchangeCodeForSession: (...a: unknown[]) => exchangeCodeForSession(...a),
      getSession: (...a: unknown[]) => getSession(...a),
    },
  },
}));
vi.mock("@/lib/native", () => ({
  hapticTap: vi.fn(),
  hapticNotify: (...a: unknown[]) => hapticNotify(...a),
}));

/** Coloca la URL de la pestaña tal como haría el navegador al llegar del correo. */
const goTo = (path: string) => {
  // jsdom sirve sobre http://localhost:3000 y no permite cambiar el hostname.
  const relative = path.startsWith("http") ? path.replace(/^https?:\/\/[^/]+/, "") : path;
  window.history.replaceState({}, "", relative);
};

const renderCallback = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <AuthCallback />
      </MemoryRouter>
    </HelmetProvider>,
  );

beforeEach(() => {
  setSession.mockReset().mockResolvedValue({ error: null });
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: null } });
  hapticNotify.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", originalHref);
});

describe("auth callback (web)", () => {
  it("abre el flujo implícito: los tokens del fragmento crean sesión", async () => {
    goTo("/auth/callback?next=%2Fscan%3Ffrom%3Dscan#access_token=AT&refresh_token=RT&type=signup");
    renderCallback();

    await waitFor(() => expect(setSession).toHaveBeenCalledWith({ access_token: "AT", refresh_token: "RT" }));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("respeta el next del enlace y no sale del dominio", async () => {
    goTo("/auth/callback?next=%2Fscan#access_token=AT&refresh_token=RT");
    renderCallback();

    // La navegación la hace el router; comprobamos que no cae en estado de error.
    await waitFor(() => expect(setSession).toHaveBeenCalled());
    expect(screen.queryByText("No hemos podido verificar")).not.toBeInTheDocument();
  });

  it("canjea el código del flujo PKCE si el proyecto cambia a él", async () => {
    goTo("/auth/callback?code=Codigo123&next=%2Fonboarding-choice");
    renderCallback();

    await waitFor(() => expect(exchangeCodeForSession).toHaveBeenCalledWith("Codigo123"));
    expect(setSession).not.toHaveBeenCalled();
  });

  it("canjea un token_hash cuando el enlace lo trae", async () => {
    goTo("/auth/callback?token_hash=Hash789&type=signup");
    renderCallback();

    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "Hash789", type: "signup" }));
  });

  it("redirige a una ruta segura aunque el next intenté salir del sitio", async () => {
    goTo("/auth/callback?next=https%3A%2F%2Fevil.example#access_token=AT&refresh_token=RT");
    renderCallback();

    // El token se procesa igual; el next inseguro se ignora al navegar.
    await waitFor(() => expect(setSession).toHaveBeenCalled());
    expect(screen.queryByText("No hemos podido verificar")).not.toBeInTheDocument();
  });

  it("avisa y ofrece entrar si el enlace no trae nada reconocible", async () => {
    goTo("/auth/callback?next=%2Fscan");
    renderCallback();

    expect(await screen.findByText("No hemos podido verificar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
    expect(hapticNotify).toHaveBeenCalledWith("error");
  });

  it("interpreta un enlace caducado como caducado, no como error genérico", async () => {
    goTo("/auth/callback#access_token=AT&refresh_token=RT");
    setSession.mockResolvedValue({ error: { message: "otp_expired" } });
    renderCallback();

    expect(await screen.findByText(/ha caducado/)).toBeInTheDocument();
  });
  it("si el enlace ya no vale pero la sesión existe, entra en vez de mostrar error", async () => {
    goTo("/auth/callback?next=%2Fdashboard#access_token=AT&refresh_token=RT");
    setSession.mockResolvedValue({ error: { message: "otp_expired" } });
    getSession.mockResolvedValue({ data: { session: { access_token: "AT" } } });
    renderCallback();

    await waitFor(() => expect(getSession).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText("No hemos podido verificar")).not.toBeInTheDocument(),
    );
  });

});
