import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Login from "@/app/pages/Login";
import { readSignupEmail, readVerifyContext } from "@/shared/lib/signupVerification";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  hapticNotify: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  signInWithGoogle: vi.fn(),
}));
const { signIn, hapticNotify, getUser, from, rpc, signInWithGoogle } = mocks;

vi.mock("@/shared/contexts/AuthContext", () => ({
  useAuth: () => ({ signIn: mocks.signIn }),
}));

vi.mock("@/shared/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: mocks.getUser, setSession: vi.fn() },
    functions: { invoke: vi.fn() },
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

vi.mock("@/shared/lib/nativeAuth", () => ({
  signInWithApple: vi.fn(),
  signInWithGoogle: (...args: unknown[]) => mocks.signInWithGoogle(...args),
}));

vi.mock("@/shared/lib/native", () => ({
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  hapticImpact: vi.fn(),
  hapticNotify: (...args: unknown[]) => mocks.hapticNotify(...args),
  isNative: vi.fn().mockReturnValue(false),
}));

const renderLogin = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>
    </HelmetProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  signIn.mockReset();
  getUser.mockReset();
  from.mockReset();
  rpc.mockReset();
  hapticNotify.mockReset();
  signInWithGoogle.mockReset().mockResolvedValue({ error: null });
});

afterEach(cleanup);

describe("login", () => {
  it("labels both fields and sets the keyboard and autofill for each", () => {
    renderLogin();

    const user = screen.getByLabelText("Usuario o correo");
    expect(user).toHaveAttribute("autocomplete", "username");
    expect(user).toHaveAttribute("autocapitalize", "none");
    expect(user).toHaveAttribute("enterkeyhint", "next");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toHaveAttribute("type", "submit");
  });

  it("moves to the password on return instead of submitting", () => {
    renderLogin();

    const user = screen.getByLabelText("Usuario o correo");
    fireEvent.change(user, { target: { value: "ana@example.test" } });
    fireEvent.keyDown(user, { key: "Enter" });

    expect(screen.getByLabelText("Contraseña")).toHaveFocus();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows a failed sign-in under the fields with an error haptic, and clears it on edit", async () => {
    signIn.mockResolvedValue({ error: new Error("Invalid login credentials") });
    renderLogin();

    fireEvent.change(screen.getByLabelText("Usuario o correo"), { target: { value: "ana@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "wrong-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Usuario o contraseña incorrectos.");
    expect(signIn).toHaveBeenCalledWith("ana@example.test", "wrong-pass");
    expect(hapticNotify).toHaveBeenCalledWith("error");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "wrong-pass2" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens a requested destination without an extra Auth or profile round trip", async () => {
    signIn.mockResolvedValue({ error: null, user: { id: "athlete" } });
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/login?next=/progreso"]}>
          <Login />
        </MemoryRouter>
      </HelmetProvider>,
    );

    fireEvent.change(screen.getByLabelText("Usuario o correo"), { target: { value: "ana@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ofrece introducir el código cuando el correo no está verificado", async () => {
    signIn.mockResolvedValue({ error: new Error("Email not confirmed") });
    sessionStorage.clear();
    renderLogin();

    fireEvent.change(screen.getByLabelText("Usuario o correo"), { target: { value: "ana@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("introduce el código de verificación");
    fireEvent.click(screen.getByRole("button", { name: "Introducir código de verificación" }));

    expect(readVerifyContext()).toMatchObject({
      email: "ana@example.test",
      next: "/onboarding-choice",
      fromScan: false,
    });
    expect(readSignupEmail()).toBe("ana@example.test");
  });

  it("«Continuar con Google» vuelve al panel, o al destino pedido, y se libera si falla", async () => {
    renderLogin();
    const google = screen.getByRole("button", { name: "Continuar con Google" });
    expect(google).toHaveAttribute("type", "button");
    fireEvent.click(google);
    expect(signInWithGoogle).toHaveBeenCalledWith("/dashboard");
    expect(google).toBeDisabled();

    cleanup();
    signInWithGoogle.mockReset().mockResolvedValue({ error: new Error("popup") });
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/login?next=/progreso"]}>
          <Login />
        </MemoryRouter>
      </HelmetProvider>,
    );
    const retry = screen.getByRole("button", { name: "Continuar con Google" });
    fireEvent.click(retry);
    expect(signInWithGoogle).toHaveBeenCalledWith("/progreso");
    await waitFor(() => expect(retry).toBeEnabled());
    expect(hapticNotify).toHaveBeenCalledWith("error");
  });

});
