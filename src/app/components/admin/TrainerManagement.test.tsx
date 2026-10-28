import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TrainerManagement from "@/app/components/admin/TrainerManagement";
import type { Profile } from "@/app/pages/Admin";

const mocks = vi.hoisted(() => ({ deleted: [] as string[] }));

vi.mock("@/shared/integrations/supabase/client", () => {
  const query = (table: string) => {
    let isDelete = false;
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.delete = () => { isDelete = true; return q; };
    q.eq = () => q;
    q.maybeSingle = () => Promise.resolve({ data: null, error: null });
    q.then = (resolve: (value: unknown) => unknown) => {
      if (isDelete) mocks.deleted.push(table);
      return Promise.resolve({ data: [], error: null }).then(resolve);
    };
    return q;
  };
  return { supabase: { from: (table: string) => query(table) } };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/shared/lib/native", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/native")>()),
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  hapticImpact: vi.fn(),
  hapticNotify: vi.fn(),
}));
vi.mock("@/app/components/Chat", () => ({ default: () => <div>Chat</div> }));
vi.mock("@/app/components/admin/TrainerCertificates", () => ({ default: () => <div>Certificados</div> }));

const trainer: Profile = {
  user_id: "trainer-1",
  email: "carlos@example.com",
  name: "Carlos Méndez",
  plan_status: "plan_ready",
  payment_status: "paid",
  created_at: "2026-01-01T00:00:00Z",
};

const setup = (props: Partial<React.ComponentProps<typeof TrainerManagement>> = {}) => {
  const onRolesChange = vi.fn();
  render(
    <TrainerManagement
      allUsers={[trainer]}
      trainerIds={new Set([trainer.user_id])}
      adminIds={new Set()}
      onRolesChange={onRolesChange}
      {...props}
    />,
  );
  return { onRolesChange };
};

const openTrainer = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Carlos Méndez/ }));
  return screen.findByRole("button", { name: "Quitar rol de entrenador" });
};

beforeEach(() => { mocks.deleted.length = 0; });
afterEach(cleanup);

describe("TrainerManagement", () => {
  it("does not remove the trainer role until the alert is confirmed", async () => {
    const { onRolesChange } = setup();
    fireEvent.click(await openTrainer());

    expect(await screen.findByText("¿Quitar el rol de entrenador?")).toBeInTheDocument();
    expect(mocks.deleted).toEqual([]);
    expect(onRolesChange).not.toHaveBeenCalled();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Quitar rol" })); });
    await waitFor(() => expect(onRolesChange).toHaveBeenCalled());
    expect(mocks.deleted).toEqual(["trainer_assignments", "trainer_profiles", "user_roles"]);
  });

  it("keeps the role when the alert is cancelled", async () => {
    const { onRolesChange } = setup();
    fireEvent.click(await openTrainer());

    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByText("¿Quitar el rol de entrenador?")).not.toBeInTheDocument());
    expect(mocks.deleted).toEqual([]);
    expect(onRolesChange).not.toHaveBeenCalled();
  });

  it("hands the open trainer to the host bar and returns to the list on back", async () => {
    const onDetailChange = vi.fn();
    setup({ onDetailChange });

    await openTrainer();
    const lastDetail = () => onDetailChange.mock.calls[onDetailChange.mock.calls.length - 1]?.[0];
    const detail = lastDetail();
    expect(detail).toMatchObject({ title: "Carlos Méndez" });

    await act(async () => { detail.onBack(); });
    expect(await screen.findByText("Promover usuario")).toBeInTheDocument();
    expect(lastDetail()).toBeNull();
  });
});
