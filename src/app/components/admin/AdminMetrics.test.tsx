import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminMetrics from "@/app/components/admin/AdminMetrics";
import type { Profile } from "@/app/pages/Admin";

const from = vi.hoisted(() => vi.fn());
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/shared/integrations/supabase/client", () => ({ supabase: { from, functions: { invoke } } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("recharts", () => ({
  ResponsiveContainer: () => null,
  AreaChart: () => null,
  Area: () => null,
  XAxis: () => null,
  Tooltip: () => null,
}));

const coach: Profile = {
  user_id: "client-coach", email: "coach-client@example.com", created_at: "2026-01-01",
  plan_status: "plan_ready", payment_status: "paid", subscription_tier: "full",
  subscription_status: "active", subscription_end: "2035-01-01T00:00:00Z",
};

beforeEach(() => {
  from.mockImplementation(() => ({ select: () => ({ gte: async () => ({ data: [], error: null }) }) }));
  invoke.mockResolvedValue({ data: {}, error: null });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("admin metrics loading", () => {
  it("shows an actionable error instead of reporting zero when a query fails", async () => {
    from.mockImplementation(() => ({ select: () => ({ gte: async () => ({ data: null, error: { message: "Unavailable" } }) }) }));
    render(<AdminMetrics users={[coach]} onRefresh={async () => [coach]} />);
    expect(await screen.findByText("No se pudieron cargar las métricas.")).toBeInTheDocument();
    expect(screen.queryByText("0 €")).not.toBeInTheDocument();

    from.mockImplementation(() => ({ select: () => ({ gte: async () => ({ data: [], error: null }) }) }));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByText("Estimación mensual").parentElement).toHaveTextContent("49 €"));
  });

  it("uses refreshed client plans and preserves the last valid values on later failures", async () => {
    const plus = { ...coach, user_id: "client-plus", subscription_tier: "plus" };
    const onRefresh = vi.fn(async () => [coach, plus]);
    render(<AdminMetrics users={[coach]} onRefresh={onRefresh} />);
    await waitFor(() => expect(screen.getByText("Estimación mensual").parentElement).toHaveTextContent("49 €"));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    // Catalog value: Coach 49 € + Plus 14,99 € (src/shared/config/tiers.ts). The old 78 € assumed Plus at 29 €.
    await waitFor(() => expect(screen.getByText("Estimación mensual").parentElement).toHaveTextContent("63,99 €"));
    expect(onRefresh).toHaveBeenCalledOnce();

    from.mockImplementation(() => ({ select: () => ({ gte: async () => ({ data: null, error: { message: "Unavailable" } }) }) }));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("última carga correcta");
    expect(screen.getByText("Estimación mensual").parentElement).toHaveTextContent("63,99 €");
  });
});

describe("admin metrics reset", () => {
  it("does not reset anything until the alert is confirmed", async () => {
    render(<AdminMetrics users={[coach]} onRefresh={async () => [coach]} />);
    const reset = await screen.findByRole("button", { name: "Resetear métricas" });

    fireEvent.click(reset);
    expect(await screen.findByText("¿Resetear todas las métricas?")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByText("¿Resetear todas las métricas?")).not.toBeInTheDocument());
    expect(invoke).not.toHaveBeenCalled();

    fireEvent.click(reset);
    fireEvent.click(await screen.findByRole("button", { name: "Resetear" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith("admin-reset-metrics");
  });
});

describe("admin metrics content", () => {
  it("tells the truth when there is no activity and lists the four activity figures", async () => {
    render(<AdminMetrics users={[coach]} onRefresh={async () => [coach]} />);
    expect(await screen.findByText("Sin actividad")).toBeInTheDocument();
    for (const label of ["Entrenos hoy", "Entrenos 7 días", "Series 7 días", "Récords 7 días"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
