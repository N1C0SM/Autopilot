import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

const rpc = vi.fn();
vi.mock("@/shared/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
vi.mock("@/shared/lib/native", () => ({ hapticTap: vi.fn(), hapticSelection: vi.fn() }));

import AcquisitionPanel from "@/app/components/admin/AcquisitionPanel";
import { parseAcquisitionFunnel, rangeDates } from "@/shared/lib/acquisitionFunnel";

const row = (channel: string, extra: Record<string, number> = {}) => ({ channel, visits: 0, scans: 0, signups: 0, week2_eligible: 0, active_week2: 0, plus: 0, ...extra });

beforeEach(() => rpc.mockReset());

describe("parseAcquisitionFunnel", () => {
  it("rellena las redes que falten, ordena y suma totales", () => {
    const f = parseAcquisitionFunnel({
      tracking_since: "2026-10-29T10:00:00Z",
      channels: [row("instagram", { visits: 4, signups: 1 }), row("tiktok", { visits: 10, scans: 3, signups: 2, week2_eligible: 2, active_week2: 1, plus: 1 })],
    });
    expect(f.channels.map((c) => c.channel)).toEqual(["tiktok", "instagram", "youtube", "threads", "facebook", "otros", "directo"]);
    expect(f.total).toEqual({ visits: 14, scans: 3, signups: 3, week2Eligible: 2, activeWeek2: 1, plus: 1 });
  });

  it("rangeDates devuelve un rango inclusivo en días locales", () => {
    expect(rangeDates("7", new Date(2026, 9, 29, 12))).toEqual({ from: "2026-10-23", to: "2026-10-29" });
  });
});

describe("AcquisitionPanel", () => {
  it("muestra el embudo por red con datos de la función de agregado", async () => {
    rpc.mockResolvedValue({
      data: { tracking_since: "2026-10-29T10:00:00Z", channels: [row("tiktok", { visits: 10, scans: 3, signups: 2, week2_eligible: 2, active_week2: 1, plus: 1 })] },
      error: null,
    });
    render(<AcquisitionPanel />);
    const summary = await screen.findByRole("region", { name: "Resumen" });
    expect(within(summary).getByText("Visitantes nuevos").nextSibling?.textContent).toBe("10");
    expect(within(summary).getByText("Activos 2ª semana").nextSibling?.textContent).toBe("50%");
    expect(screen.getByText("TikTok")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("admin_acquisition_funnel", expect.objectContaining({ _from: expect.any(String), _to: expect.any(String) }));
  });

  it("no inventa visitas ni scans antes de que empiece la medición", async () => {
    rpc.mockResolvedValue({ data: { tracking_since: null, channels: [row("directo", { signups: 4 })] }, error: null });
    render(<AcquisitionPanel />);
    const summary = await screen.findByRole("region", { name: "Resumen" });
    expect(within(summary).getByText("Visitantes nuevos").nextSibling?.textContent).toBe("—");
    expect(within(summary).getAllByText("Aún sin medir")).toHaveLength(2);
    expect(within(summary).getByText("Cuentas creadas").nextSibling?.textContent).toBe("4");
  });
});
