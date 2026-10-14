import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResetPassword from "./ResetPassword";

const updateUser = vi.fn();
const hapticNotify = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser: (...args: unknown[]) => updateUser(...args) } },
}));
vi.mock("@/lib/native", () => ({
  hapticTap: vi.fn(),
  hapticNotify: (...args: unknown[]) => hapticNotify(...args),
}));

const renderReset = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/reset-password"]}>
        <ResetPassword />
      </MemoryRouter>
    </HelmetProvider>,
  );

beforeEach(() => {
  updateUser.mockReset();
  hapticNotify.mockReset();
});

afterEach(cleanup);

describe("reset password", () => {
  it("explains a mismatch under the fields without calling the server", () => {
    renderReset();

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "abcdef" } });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "abcdeg" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar contraseña" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Las contraseñas no coinciden.");
    expect(hapticNotify).toHaveBeenCalledWith("error");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("shows the done state once the password is saved", async () => {
    updateUser.mockResolvedValue({ error: null });
    renderReset();

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "abcdef" } });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "abcdef" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar contraseña" }));

    expect(await screen.findByRole("heading", { name: "Contraseña actualizada" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
    expect(hapticNotify).toHaveBeenCalledWith("success");
  });
});
