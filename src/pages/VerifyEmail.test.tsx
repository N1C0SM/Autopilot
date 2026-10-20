import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VerifyEmail, { onlyCodeDigits } from "./VerifyEmail";

if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}
import { readSignupEmail, readVerifyContext, saveVerifyContext } from "@/lib/signupVerification";

const verifyOtp = vi.fn();
const resend = vi.fn();
const track = vi.fn();
const hapticNotify = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
      resend: (...args: unknown[]) => resend(...args),
    },
  },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock("@/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));
vi.mock("@/lib/native", () => ({
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  hapticImpact: vi.fn(),
  hapticNotify: (...args: unknown[]) => hapticNotify(...args),
  isNative: vi.fn().mockReturnValue(false),
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
};

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/verify-email"]}>
        <Routes>
          <Route
            path="/verify-email"
            element={
              <>
                <VerifyEmail initialCooldown={0} />
                <LocationProbe />
              </>
            }
          />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

const writeCode = (value: string) => {
  fireEvent.change(screen.getByLabelText("Código de verificación"), {
    target: { value },
  });
};

beforeEach(() => {
  sessionStorage.clear();
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  resend.mockReset().mockResolvedValue({ error: null });
  track.mockReset();
  hapticNotify.mockReset();
  saveVerifyContext({ email: "ana@example.test", next: "/onboarding-choice", fromScan: false });
});

afterEach(cleanup);

describe("verificación por código completo", () => {
  it("muestra el email y el campo de código", () => {
    renderPage();
    expect(screen.getByText("ana@example.test")).toBeInTheDocument();
    expect(screen.getByLabelText("Código de verificación")).toBeInTheDocument();
  });

  it("deja solo los 8 dígitos al pegar con espacios o guiones", () => {
    expect(onlyCodeDigits("4560 5536")).toBe("45605536");
    expect(onlyCodeDigits("4560-5536")).toBe("45605536");
    expect(onlyCodeDigits("Código: 45605536.")).toBe("45605536");
  });

  it("verifica sola al completar los 8 dígitos", async () => {
    renderPage();
    writeCode("12345678");
    await waitFor(() => expect(verifyOtp).toHaveBeenCalledTimes(1));
  });

  it.each(["123456", "12345678"])("verifica %s sin truncar, limpia el contexto y navega al destino", async (token) => {
    renderPage();
    writeCode(token);
    const button = screen.queryByRole("button", { name: "Verificar cuenta" });
    if (button) fireEvent.click(button);

    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith({
        email: "ana@example.test",
        token,
        type: "signup",
      }),
    );
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/onboarding-choice"));
    expect(readVerifyContext()).toBeNull();
    expect(track).toHaveBeenCalledWith("verify_email", { method: "code", from: "form" });
    expect(hapticNotify).toHaveBeenCalledWith("success");
  });

  it("muestra un mensaje en español si el código no vale", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    renderPage();
    writeCode("000000");
    fireEvent.click(screen.getByRole("button", { name: "Verificar cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El código no es válido o ha caducado. Pide uno nuevo.",
    );
    expect(hapticNotify).toHaveBeenCalledWith("error");
    expect(readVerifyContext()).not.toBeNull();
  });

  it.each(["12345", "1234567"])("no envía un código incompleto de %s", (token) => {
    renderPage();
    writeCode(token);
    fireEvent.submit(document.getElementById("verify-form") as HTMLFormElement);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("permite reenviar el código con el enlace de respaldo", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar código" }));

    await waitFor(() =>
      expect(resend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "signup",
          email: "ana@example.test",
        }),
      ),
    );
    expect(resend.mock.calls[0][0].options.emailRedirectTo).toContain("/auth/callback?next=");
  });

  it("sin contexto vuelve al registro", async () => {
    sessionStorage.clear();
    renderPage();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/signup"));
    expect(screen.queryByText("Introduce el código")).not.toBeInTheDocument();
  });

  it("«Corregir mi correo» vuelve al registro y conserva el email", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Corregir mi correo" }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/signup"));
    expect(readSignupEmail()).toBe("ana@example.test");
    expect(readVerifyContext()).toBeNull();
  });
});
