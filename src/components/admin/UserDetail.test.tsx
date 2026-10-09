import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserDetail from "./UserDetail";
import type { Profile } from "@/pages/Admin";
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), error: vi.fn(), macros: { protein: 130, carbs: 250, fats: 75 } as Record<string, number> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => { const query = {
    select: () => query, eq: () => query,
    maybeSingle: () => Promise.resolve({ data: table === "nutrition_plan" ? { macros_json: mocks.macros, meals_json: [] } : table === "training_plan" ? { workouts_json: [{ day: "Lunes", type: "gimnasio", routine_name: "Sesión guardada", exercises: [] }] } : null, error: null }),
    upsert: (...args: unknown[]) => { mocks.upsert(table, ...args); return Promise.resolve({ error: null }); }, update: () => ({ eq: () => Promise.resolve({ error: null }) }),
  }; return query; },
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; }, removeChannel: vi.fn(),
} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error } }));
vi.mock("@/components/Chat", () => ({ default: ({ conversationUserId, audience }: { conversationUserId: string; audience: string }) => <div>Chat {audience}: {conversationUserId}</div> }));
vi.mock("./TrainingPlanForm", () => ({ default: () => <div>Editor de entrenamiento</div> }));
vi.mock("./UserProgressPanel", () => ({ default: () => null }));
vi.mock("./UserGoalPanel", () => ({ default: () => null }));
vi.mock("./TransformCyclePanel", () => ({ default: () => null }));
vi.mock("./OnboardingEditor", () => ({ default: () => null }));
vi.mock("@/components/dashboard/CalendarView", () => ({ default: () => <div>Calendario del cliente</div> }));
vi.mock("@/lib/impersonate", () => ({ impersonateUser: vi.fn() }));
const coach: Profile = { user_id: "assigned-client", email: "cliente@example.com", payment_status: "paid", plan_status: "plan_ready", subscription_tier: "full", subscription_status: "active", created_at: "2026-10-01" };
const props = { onBack: vi.fn(), onUpdate: vi.fn(), restricted: true };
beforeEach(() => { vi.clearAllMocks(); mocks.macros = { protein: 130, carbs: 250, fats: 75 }; }); afterEach(cleanup);
describe("assigned client detail", () => {
  it("opens a useful Plan summary and gives an entitled Coach client a direct chat", async () => {
    render(<UserDetail profile={coach} {...props} />);
    expect(await screen.findByText("Resumen del plan")).toBeVisible();
    expect(screen.getByText(/Sesión guardada/)).toBeVisible();
    expect(screen.getByRole("tab", { name: "Plan" })).toHaveAttribute("aria-selected", "true");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Chat" }), { button: 0 });
    expect(await screen.findByText("Chat client: assigned-client")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Volver a clientes" })).toHaveLength(1);
  });
  it("uses shared capabilities for Plus nutrition and hides human chat", async () => {
    render(<UserDetail profile={{ ...coach, subscription_tier: "training" }} {...props} />);
    await screen.findByText("Resumen del plan");
    expect(screen.getByRole("tab", { name: "Nutrición" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Chat" })).not.toBeInTheDocument();
  });
  it("shows useful saved sessions and explains legacy missing access context", async () => {
    const { subscription_tier, subscription_status, ...legacyProfile } = coach;
    render(<UserDetail profile={legacyProfile} {...props} />);
    expect(await screen.findByText(/La información de acceso del cliente está pendiente/)).toBeVisible();
    expect(screen.getByText(/Sesión guardada/)).toBeVisible();
    expect(screen.queryByRole("tab", { name: "Chat" })).not.toBeInTheDocument();
  });
  it("rejects invalid loaded macros before writing either plan", async () => {
    mocks.macros = { protein: 130, carbs: 250, fats: 500 };
    render(<UserDetail profile={coach} {...props} />);
    await screen.findByText("Resumen del plan"); fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(mocks.error).toHaveBeenCalled(); expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("skips nutrition writes when nutritionPlan is unavailable", async () => {
    mocks.macros = { protein: 130, carbs: 250, fats: 500 };
    render(<UserDetail profile={{ ...coach, subscription_end: "2020-01-01" }} {...props} />);
    await screen.findByText("Resumen del plan"); fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith("training_plan", expect.anything(), expect.anything()));
    expect(mocks.upsert.mock.calls.some(([table]) => table === "nutrition_plan")).toBe(false);
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it("preserves decimal targets and allows deliberately empty nutrition targets", async () => {
    mocks.macros = { protein: 130.5, carbs: 250.5, fats: 75.5 };
    const { unmount } = render(<UserDetail profile={coach} {...props} />);
    await screen.findByText("Resumen del plan"); fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith("nutrition_plan", expect.objectContaining({ macros_json: { protein: 130.5, carbs: 250.5, fats: 75.5 } }), { onConflict: "user_id" }));
    unmount(); mocks.upsert.mockClear(); mocks.macros = {};
    render(<UserDetail profile={coach} {...props} />);
    await screen.findByText("Resumen del plan"); fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith("nutrition_plan", expect.objectContaining({ macros_json: {} }), { onConflict: "user_id" }));
  });
});
