import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPanel from "./SettingsPanel";
const mocks = vi.hoisted(() => ({
  user: { id: "user", email: "test@example.com" },
  tier: "full", paid: "paid", status: "active", end: null as string | null,
  availability: { days: "2", hours: "0.92", training_days: [1, 3], auto_calculated: true, sport_schedules: { running: "18:00" } } as Record<string, unknown>,
  saves: [] as Record<string, unknown>[],
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user, signOut: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const query = { select: () => query, eq: () => query, maybeSingle: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "profiles" ? { subscription_tier: mocks.tier, payment_status: mocks.paid, subscription_status: mocks.status, subscription_end: mocks.end } : table === "onboarding" ? { availability: mocks.availability } : null, error: null }).then(resolve),
      upsert: (row: Record<string, unknown>) => { mocks.saves.push(row); return Promise.resolve({ error: null }); },
    }; return query;
  },
  rpc: () => Promise.resolve({ data: {} }), functions: { invoke: () => Promise.resolve({ data: {} }) },
} }));
beforeEach(() => { mocks.tier = "full"; mocks.paid = "paid"; mocks.status = "active"; mocks.end = null; mocks.saves = []; });
afterEach(cleanup);
const show = () => render(<MemoryRouter><SettingsPanel /></MemoryRouter>);
describe("settings plan labels and availability", () => {
  it.each([["full", "Coach"], ["personal", "Coach"], ["training", "Plus"], ["free", "Free"]])("shows the shared name for stored tier %s", async (tier, name) => {
    mocks.tier = tier; show();
    expect(await screen.findByText(`Plan ${name}`)).toBeVisible();
  });
  it("does not label expired paid access as an active Coach plan", async () => {
    mocks.end = "2000-01-01T00:00:00Z"; show();
    expect(await screen.findByText("Plan Free")).toBeVisible();
    expect(screen.queryByText("Suscripción activa")).not.toBeInTheDocument();
  });
  it("reads current capacity and preserves schedule metadata when saving other profile data", async () => {
    show();
    expect(await screen.findByRole("spinbutton", { name: "Días/semana" })).toHaveValue(2);
    expect(screen.getByRole("spinbutton", { name: "Horas/sesión" })).toHaveValue(0.92);
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    await waitFor(() => expect(mocks.saves).toHaveLength(1));
    expect(mocks.saves[0].availability).toEqual(mocks.availability);
    expect(screen.getByRole("button", { name: "Horarios y disponibilidad" })).toBeVisible();
  });
  it("overlays manual capacity while retaining chosen weekdays and sports", async () => {
    show(); await screen.findByRole("spinbutton", { name: "Días/semana" });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Días/semana" }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    await waitFor(() => expect(mocks.saves).toHaveLength(1));
    expect(mocks.saves[0].availability).toEqual({ ...mocks.availability, days: "3", auto_calculated: false });
  });
});
