import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPanel from "./SettingsPanel";
const mocks = vi.hoisted(() => ({
  user: { id: "user", email: "test@example.com" },
  tier: "full", paid: "paid", status: "active", end: null as string | null, travelUntil: null as string | null,
  ios: false, plan: null as string | null,
  availability: { days: "2", hours: "0.92", training_days: [1, 3], auto_calculated: true, sport_schedules: { running: "18:00" } } as Record<string, unknown>,
  saves: [] as Record<string, unknown>[],
  updates: [] as { table: string; row: Record<string, unknown> }[],
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/platform", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/platform")>()), isIOSNative: () => mocks.ios }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user, signOut: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const query = { select: () => query, eq: () => query, maybeSingle: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "profiles" ? { subscription_tier: mocks.tier, payment_status: mocks.paid, subscription_status: mocks.status, subscription_end: mocks.end, travel_mode_until: mocks.travelUntil, travel_equipment: "gomas" } : table === "onboarding" ? { availability: mocks.availability } : null, error: null }).then(resolve),
      upsert: (row: Record<string, unknown>) => { mocks.saves.push(row); return Promise.resolve({ error: null }); },
      update: (row: Record<string, unknown>) => { mocks.updates.push({ table, row }); return query; },
    }; return query;
  },
  rpc: () => Promise.resolve({ data: {} }),
  functions: { invoke: (name: string) => Promise.resolve({ data: name === "check-subscription" && mocks.plan ? { plan: mocks.plan } : {} }) },
} }));
beforeEach(() => {
  mocks.tier = "full"; mocks.paid = "paid"; mocks.status = "active"; mocks.end = null; mocks.travelUntil = null; mocks.saves = []; mocks.updates = [];
  mocks.ios = false; mocks.plan = null;
  mocks.toast.error.mockClear(); mocks.toast.success.mockClear(); mocks.toast.info.mockClear();
});
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

describe("settings goal and rest controls", () => {
  it("moves the goal with the arrow keys, keeps a single tab stop and saves the chosen goal", async () => {
    show();
    const radios = await screen.findAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: "ArrowDown" });
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(radios[1]).toHaveFocus();
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    await waitFor(() => expect(mocks.saves).toHaveLength(1));
    expect(mocks.saves[0].goal).toBe("gain_muscle");
  });
  it("names the rest presets control for assistive technology", async () => {
    show();
    const presets = await screen.findByRole("tablist", { name: "Descanso entre series" });
    expect(within(presets).getAllByRole("tab").length).toBeGreaterThan(0);
  });
});

describe("settings account deletion", () => {
  it.each([
    ["active", "Tienes una suscripción activa", "Al eliminar la cuenta se cancela la suscripción y pierdes el acceso de inmediato, aunque hayas pagado hasta el final del periodo."],
    ["trialing", "Tienes una prueba activa", "Al eliminar la cuenta cancelas la prueba y pierdes el acceso de inmediato — aunque aún no se te haya cobrado."],
  ])("warns about a %s subscription before deleting the account", async (status, title, body) => {
    mocks.status = status; show();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar cuenta" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(title)).toBeVisible();
    expect(within(dialog).getByText(body)).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Sí, eliminar cuenta" })).toBeEnabled();
  });
  it("shows no subscription warning when a free account is deleted", async () => {
    mocks.tier = "free"; show();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar cuenta" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Esta acción elimina permanentemente tu cuenta/)).toBeVisible();
    expect(within(dialog).queryByText(/Tienes una (suscripción|prueba) activa/)).not.toBeInTheDocument();
  });
});

describe("settings travel mode", () => {
  it("asks for an end date before activating and does not write anything", async () => {
    show();
    fireEvent.click(await screen.findByRole("switch", { name: "Modo viaje" }));
    fireEvent.click(await screen.findByRole("button", { name: "Activar" }));
    expect(mocks.toast.error).toHaveBeenCalledWith("Indica hasta cuándo estarás de viaje");
    expect(mocks.updates).toHaveLength(0);
  });
  it("closes the form without saving when the switch is turned back off", async () => {
    show();
    const toggle = await screen.findByRole("switch", { name: "Modo viaje" });
    fireEvent.click(toggle);
    expect(await screen.findByLabelText("Equipamiento disponible")).toBeVisible();
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.queryByLabelText("Equipamiento disponible")).not.toBeInTheDocument());
    expect(mocks.updates).toHaveLength(0);
  });
  it("turns an active travel mode off from its switch and clears the stored trip", async () => {
    mocks.travelUntil = "2999-01-01"; show();
    const toggle = await screen.findByRole("switch", { name: "Modo viaje" });
    await waitFor(() => expect(toggle).toBeChecked());
    fireEvent.click(toggle);
    await waitFor(() => expect(mocks.updates).toContainEqual({ table: "profiles", row: { travel_mode_until: null, travel_equipment: null } }));
  });
});

describe("settings purchase surfaces", () => {
  const showWithUpgrade = () => render(<MemoryRouter><SettingsPanel onUpgrade={vi.fn()} /></MemoryRouter>);
  it("shows prices, the offer and the billing portal outside iOS", async () => {
    mocks.plan = "monthly"; show();
    expect(await screen.findByText(/^Mensual \(.+€\/mes\)$/)).toBeVisible();
    expect(screen.getByText(/ahorra .+€\/año/)).toBeVisible();
    expect(screen.getByText("Gestionar suscripción")).toBeVisible();
  });
  it("offers the upgrade and the trial to a free account outside iOS", async () => {
    mocks.tier = "free"; showWithUpgrade();
    expect(await screen.findByRole("button", { name: /^Mejorar a/ })).toBeVisible();
    expect(screen.getByText(/7 días de prueba/)).toBeVisible();
  });
  it("keeps the plan name but no price, offer or billing entry on iOS for a paid account", async () => {
    mocks.ios = true; mocks.plan = "monthly";
    const { container } = showWithUpgrade();
    expect(await screen.findByText("Plan Coach")).toBeVisible();
    expect(await screen.findByText("Mensual")).toBeVisible();
    expect(screen.queryByText("Gestionar suscripción")).not.toBeInTheDocument();
    expect(screen.queryByText(/ahorra/)).not.toBeInTheDocument();
    expect(screen.queryByText(/portal de gestión/)).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent("€");
  });
  it("shows no upgrade, trial or price on iOS for a free account", async () => {
    mocks.ios = true; mocks.tier = "free";
    const { container } = showWithUpgrade();
    expect(await screen.findByText("Plan Free")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Mejorar a|Ver /i })).not.toBeInTheDocument();
    expect(screen.queryByText(/7 días de prueba/)).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent("€");
  });
});
