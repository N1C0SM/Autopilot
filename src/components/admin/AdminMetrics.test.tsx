import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminMetrics from "./AdminMetrics";
import type { Profile } from "@/pages/Admin";

const from = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
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
    await waitFor(() => expect(screen.getByText("Estimación mensual").parentElement).toHaveTextContent("78 €"));
    expect(onRefresh).toHaveBeenCalledOnce();

    from.mockImplementation(() => ({ select: () => ({ gte: async () => ({ data: null, error: { message: "Unavailable" } }) }) }));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("última carga correcta");
    expect(screen.getByText("Estimación mensual").parentElement).toHaveTextContent("78 €");
  });
});
