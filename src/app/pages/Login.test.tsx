import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Login from "@/app/pages/Login";
import { readSignupEmail, readVerifyContext } from "@/shared/lib/signupVerification";

const signIn = vi.fn();
const hapticNotify = vi.fn();

vi.mock("@/shared/contexts/AuthContext", () => ({
  useAuth: () => ({ signIn }),
}));

vi.mock("@/shared/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn(), setSession: vi.fn() },
    functions: { invoke: vi.fn() },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/shared/lib/nativeAuth", () => ({ signInWithApple: vi.fn() }));

vi.mock("@/shared/lib/native", () => ({
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  hapticImpact: vi.fn(),
  hapticNotify: (...args: unknown[]) => hapticNotify(...args),
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
  hapticNotify.mockReset();
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

});
