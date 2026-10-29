import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

const rpc = vi.fn();
vi.mock("@/shared/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
vi.mock("@/shared/lib/native", () => ({ hapticTap: vi.fn(), hapticSelection: vi.fn() }));

import AcquisitionPanel from "@/app/components/admin/AcquisitionPanel";
import { parseAcquisitionFunnel, parseAcquisitionUsers, rangeDates } from "@/shared/lib/acquisitionFunnel";

const row = (channel: string, extra: Record<string, number> = {}) => ({ channel, visits: 0, scans: 0, signups: 0, first_workout: 0, week2_eligible: 0, active_week2: 0, plus: 0, ...extra });
const USERS = {
  total: 1,
  users: [{ user_id: "u1", name: "Ana", email: "ana@example.test", signup_at: "2026-10-28T10:00:00Z", channel: "tiktok", source: "tiktok", medium: "bio", campaign: null, landing_path: "/scan", stage: "scan", first_workout: null, last_workout: null }],
};
/** Responde a cada función RPC con su propio dato. */
const respond = (funnel: unknown, users: unknown = { total: 0, users: [] }) =>
  rpc.mockImplementation((name: string) => Promise.resolve({ data: name === "admin_acquisition_users" ? users : funnel, error: null }));

beforeEach(() => rpc.mockReset());

describe("parseAcquisitionFunnel", () => {
  it("rellena las redes que falten, ordena y suma totales", () => {
    const f = parseAcquisitionFunnel({
      tracking_since: "2026-10-29T10:00:00Z",
      channels: [row("instagram", { visits: 4, signups: 1 }), row("tiktok", { visits: 10, scans: 3, signups: 2, week2_eligible: 2, active_week2: 1, plus: 1 })],
    });
    expect(f.channels.map((c) => c.channel)).toEqual(["tiktok", "instagram", "youtube", "threads", "facebook", "otros", "directo"]);
    expect(f.total).toEqual({ visits: 14, scans: 3, signups: 3, firstWorkout: 0, week2Eligible: 2, activeWeek2: 1, plus: 1 });
  });

  it("rangeDates devuelve un rango inclusivo en días locales", () => {
    expect(rangeDates("7", new Date(2026, 9, 29, 12))).toEqual({ from: "2026-10-23", to: "2026-10-29" });
  });
});

describe("AcquisitionPanel", () => {
  it("muestra el embudo por red con datos de la función de agregado", async () => {
    respond({ tracking_since: "2026-10-29T10:00:00Z", channels: [row("tiktok", { visits: 10, scans: 3, signups: 2, week2_eligible: 2, active_week2: 1, plus: 1 })] });
    render(<AcquisitionPanel />);
    const summary = await screen.findByRole("region", { name: "Resumen" });
    expect(within(summary).getByText("Visitantes nuevos").nextSibling?.textContent).toBe("10");
    expect(within(summary).getByText("Activos 2ª semana").nextSibling?.textContent).toBe("50%");
    expect(screen.getAllByText("TikTok").length).toBeGreaterThan(0);
    expect(rpc).toHaveBeenCalledWith("admin_acquisition_funnel", expect.objectContaining({ _from: expect.any(String), _to: expect.any(String) }));
  });

  it("no inventa visitas ni scans antes de que empiece la medición", async () => {
    respond({ tracking_since: null, channels: [row("directo", { signups: 4 })] });
    render(<AcquisitionPanel />);
    const summary = await screen.findByRole("region", { name: "Resumen" });
    expect(within(summary).getByText("Visitantes nuevos").nextSibling?.textContent).toBe("—");
    expect(within(summary).getAllByText("Aún sin medir")).toHaveLength(2);
    expect(within(summary).getByText("Cuentas creadas").nextSibling?.textContent).toBe("4");
  });

  it("lista cada cuenta con su red, su entrada y el paso en el que se quedó", async () => {
    respond({ tracking_since: "2026-10-29T10:00:00Z", channels: [row("tiktok", { visits: 10, scans: 4, signups: 1 })] }, USERS);
    render(<AcquisitionPanel />);
    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Hizo el scan")).toBeInTheDocument();
    expect(screen.getByText(/TikTok · bio · entró por \/scan/)).toBeInTheDocument();
    expect(screen.getByText(/40% sigue · se pierde 60%/)).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("admin_acquisition_users", expect.objectContaining({ _channel: null, _stage: null, _offset: 0 }));
  });
});

describe("parseAcquisitionUsers", () => {
  it("normaliza redes y pasos desconocidos sin romper", () => {
    const p = parseAcquisitionUsers({ total: "2", users: [{ user_id: "x", channel: "myspace", stage: "raro", signup_at: "2026-10-01" }] });
    expect(p.total).toBe(2);
    expect(p.users[0]).toMatchObject({ channel: "directo", stage: "cuenta", email: null });
  });
});
