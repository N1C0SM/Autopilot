import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PaymentReminders from "./PaymentReminders";
import type { Profile } from "@/pages/Admin";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    functions: { invoke: vi.fn() },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/lib/native", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/native")>()),
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  hapticNotify: vi.fn(),
}));

const user = (id: string, email: string): Profile => ({
  user_id: id,
  email,
  plan_status: "plan_pending",
  payment_status: "unpaid",
  created_at: "2026-01-01T00:00:00Z",
});
const users = [user("u1", "ana@example.com"), user("u2", "luis@example.com")];

afterEach(cleanup);

describe("PaymentReminders", () => {
  it("starts with the send button disabled", () => {
    render(<PaymentReminders users={users} />);
    expect(screen.getByRole("button", { name: "Enviar a 0" })).toBeDisabled();
  });

  it("selects a row once from the checkbox and once from the row", () => {
    render(<PaymentReminders users={users} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar ana@example.com" }));
    expect(screen.getByRole("button", { name: "Enviar a 1" })).toBeEnabled();

    fireEvent.click(screen.getByText("luis@example.com"));
    expect(screen.getByRole("button", { name: "Enviar a 2" })).toBeEnabled();

    fireEvent.click(screen.getByText("ana@example.com"));
    expect(screen.getByRole("button", { name: "Enviar a 1" })).toBeEnabled();
  });

  it("selects everything and clears the selection", () => {
    render(<PaymentReminders users={users} />);

    fireEvent.click(screen.getByRole("button", { name: "Seleccionar todos (2)" }));
    expect(screen.getByRole("button", { name: "Enviar a 2" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar (2)" }));
    expect(screen.getByRole("button", { name: "Enviar a 0" })).toBeDisabled();
  });

  it("keeps the checkbox as the only tab stop of a row", () => {
    render(<PaymentReminders users={users} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.queryAllByRole("button", { name: /^ana@example.com/ })).toHaveLength(0);
  });
});
