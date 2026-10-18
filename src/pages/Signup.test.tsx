import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Signup from "./Signup";

const invoke = vi.fn();
const signUp = vi.fn();
const hapticNotify = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ signUp }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    auth: { resend: vi.fn() },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));
vi.mock("@/lib/planCatalog", () => ({ usePlanAvailability: () => ({ coach: false }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/nativeAuth", () => ({ signInWithApple: vi.fn() }));
vi.mock("@/lib/scanAttribution", () => ({ readAnonScanId: () => null }));
vi.mock("@/lib/native", () => ({
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  hapticImpact: vi.fn(),
  hapticNotify: (...args: unknown[]) => hapticNotify(...args),
  isNative: vi.fn().mockReturnValue(false),
}));

const renderSignup = (path = "/signup?free=true") =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Signup />
      </MemoryRouter>
    </HelmetProvider>,
  );

beforeEach(() => {
  invoke.mockReset();
  signUp.mockReset();
  hapticNotify.mockReset();
  sessionStorage.clear();
});

afterEach(cleanup);

describe("signup", () => {
  it("sets the keyboard and autofill for each field", () => {
    renderSignup();

    expect(screen.getByLabelText("Tu nombre")).toHaveAttribute("autocomplete", "given-name");
    const email = screen.getByLabelText("Correo electrónico");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("inputmode", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByRole("button", { name: "Crear cuenta gratis" })).toHaveAttribute("type", "submit");
  });

  it("says under the fields that the email is taken and blocks the submit", async () => {
    invoke.mockResolvedValue({ data: { emailTaken: true } });
    renderSignup();

    const email = screen.getByLabelText("Correo electrónico");
    fireEvent.change(email, { target: { value: "ana@example.test" } });
    fireEvent.blur(email);

    expect(await screen.findByRole("alert")).toHaveTextContent("Este correo ya está registrado.");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Crear cuenta gratis" })).toBeDisabled();
  });

  it("shows a server error under the fields with an error haptic", async () => {
    invoke.mockResolvedValue({ data: { emailTaken: false } });
    signUp.mockResolvedValue({ error: new Error("Password is too weak") });
    renderSignup();

    fireEvent.change(screen.getByLabelText("Tu nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta gratis" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Password is too weak");
    await waitFor(() => expect(hapticNotify).toHaveBeenCalledWith("error"));
  });
});
