import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import UserList from "@/app/components/admin/UserList";
import type { Profile } from "@/app/pages/Admin";

vi.mock("@/shared/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/shared/lib/native", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/native")>()),
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  hapticNotify: vi.fn(),
}));

const profile = (id: string, email: string, extra: Partial<Profile> = {}): Profile => ({
  user_id: id,
  email,
  plan_status: "plan_ready",
  payment_status: "paid",
  subscription_tier: "training",
  created_at: "2026-03-10T10:00:00Z",
  ...extra,
});

const users = [
  profile("u1", "ana@example.com", { name: "Ana Pérez" }),
  profile("u2", "jose@example.com", { name: "José Ruiz", payment_status: "unpaid", plan_status: "plan_pending" }),
  profile("t1", "carlos@example.com", { name: "Carlos Méndez" }),
  profile("a1", "root@example.com"),
];

const setup = () => {
  const onSelectUser = vi.fn();
  render(
    <UserList
      users={users}
      adminIds={new Set(["a1"])}
      trainerIds={new Set(["t1"])}
      onSelectUser={onSelectUser}
      onTestAccountCreated={vi.fn()}
    />,
  );
  return { onSelectUser };
};

afterEach(cleanup);

describe("UserList", () => {
  it("groups clients, trainers and admins", () => {
    setup();
    expect(screen.getByText("Clientes (2)")).toBeInTheDocument();
    expect(screen.getByText("Entrenadores (1)")).toBeInTheDocument();
    expect(screen.getByText("Administradores (1)")).toBeInTheDocument();
  });

  it("opens the profile of the tapped row", () => {
    const { onSelectUser } = setup();
    fireEvent.click(screen.getByText("Ana Pérez"));
    expect(onSelectUser).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u1" }));
  });

  it("filters by status with the chip bar", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Sin pagar" }));
    expect(screen.getByRole("button", { name: "Sin pagar" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("José Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Ana Pérez")).not.toBeInTheDocument();
  });

  it("searches ignoring case and accents", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Buscar usuario"), { target: { value: "JOSE" } });
    expect(screen.getByText("José Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Ana Pérez")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Buscar usuario"), { target: { value: "zzzz" } });
    expect(screen.getByText("Sin usuarios")).toBeInTheDocument();
  });

  it("excludes free accounts from the unpaid filter", () => {
    render(<UserList users={[
      profile("free", "gratis@example.com", { name: "Gratis", subscription_tier: "free", payment_status: "unpaid" }),
      profile("plus", "plus@example.com", { name: "Plus", payment_status: "unpaid" }),
    ]} adminIds={new Set()} onSelectUser={vi.fn()} onTestAccountCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Sin pagar" }));
    expect(screen.queryByText("Gratis")).not.toBeInTheDocument();
    expect(screen.getByText("Plus")).toBeInTheDocument();
  });
});
