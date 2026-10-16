import { AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { applyScanPlan, buildScanPlanUpdates, canApplyScanToPlan, hasScanInferences } from "./scanApply";

describe("scan plan updates (solo se aplica lo que el usuario aprueba)", () => {
  it("no propone ningún cambio cuando el scan no inferió nada", () => {
    expect(buildScanPlanUpdates({})).toEqual({});
    expect(hasScanInferences({})).toBe(false);
    expect(hasScanInferences({ inferred_specific_goals: [] })).toBe(false);
  });

  it("traduce el enfoque inferido a equipo de entrenamiento", () => {
    expect(buildScanPlanUpdates({ inferred_focus: "gimnasio" })).toEqual({
      primary_focus: "gimnasio",
      equipment_type: "Gimnasio",
    });
    expect(buildScanPlanUpdates({ inferred_focus: "calistenia" })).toEqual({
      primary_focus: "calistenia",
      equipment_type: "Calistenia",
    });
    expect(buildScanPlanUpdates({ inferred_focus: "ambos" })).toEqual({
      primary_focus: "ambos",
      equipment_type: "Mixto",
    });
  });

  it("guarda el objetivo y las metas específicas tal como las vio el usuario", () => {
    expect(
      buildScanPlanUpdates({
        inferred_goal: "lose_fat",
        inferred_intensity: 3,
        inferred_specific_goals: ["ganar fuerza", "marcar abdomen"],
      })
    ).toEqual({
      goal: "lose_fat",
      intensity_level: 3,
      specific_goal: "ganar fuerza, marcar abdomen",
    });
  });

  it("guarda la intensidad como entero entre 1 y 10", () => {
    expect(buildScanPlanUpdates({ inferred_intensity: 7.5 })).toEqual({ intensity_level: 8 });
    expect(buildScanPlanUpdates({ inferred_intensity: 14 })).toEqual({ intensity_level: 10 });
    expect(buildScanPlanUpdates({ inferred_intensity: Number.NaN })).toEqual({});
  });

  it("ignora una intensidad que no sea un número", () => {
    expect(buildScanPlanUpdates({ inferred_goal: "gain_muscle", inferred_intensity: undefined })).toEqual({
      goal: "gain_muscle",
    });
  });
});

describe("quién puede aplicar un scan a su plan", () => {
  const plus = { payment_status: "paid", subscription_tier: "plus", subscription_status: "active" };
  const coach = { payment_status: "paid", subscription_tier: "coach", subscription_status: "active" };

  it("Plus y Coach sí, Free no", () => {
    expect(canApplyScanToPlan(plus, false)).toBe(true);
    expect(canApplyScanToPlan(coach, false)).toBe(true);
    expect(canApplyScanToPlan({ payment_status: "unpaid" }, false)).toBe(false);
    expect(canApplyScanToPlan(null, false)).toBe(false);
  });

  it("un admin siempre puede, para probarlo", () => {
    expect(canApplyScanToPlan(null, true)).toBe(true);
  });
});

type Invoke = () => Promise<{ data: unknown; error: unknown }>;

function fakeClient(opts: {
  onboarding?: Record<string, unknown> | null;
  invoke?: Invoke;
  updatedRows?: number;
  sessionError?: unknown;
  refreshError?: unknown;
}) {
  const writes: { table: string; values: Record<string, unknown> }[] = [];
  const onboarding = opts.onboarding === undefined
    ? { id: "o1", goal: "gain_muscle", primary_focus: "calistenia", equipment_type: "Calistenia", specific_goal: "dominadas" }
    : opts.onboarding;
  const invoke = vi.fn(opts.invoke ?? (async () => ({ data: { success: true }, error: null })));
  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: table === "onboarding" ? onboarding : { plan_status: "plan_ready" }, error: null }),
          }),
        }),
        update(values: Record<string, unknown>) {
          writes.push({ table, values });
          const done = Object.assign(Promise.resolve({ error: null }), {
            select: async () => ({ data: Array.from({ length: opts.updatedRows ?? 1 }, () => ({ id: "o1" })), error: null }),
          });
          return { eq: () => done };
        },
      };
    },
    functions: { invoke },
    auth: {
      getUser: async () => ({ data: { user: null }, error: opts.sessionError ?? null }),
      refreshSession: async () => ({ data: { session: null }, error: opts.refreshError ?? null }),
    },
  };
  return { client: client as unknown as Parameters<typeof applyScanPlan>[0], writes, invoke };
}

const scan = { inferred_goal: "lose_fat", inferred_focus: "gimnasio" };
const restored = { goal: "gain_muscle", primary_focus: "calistenia", equipment_type: "Calistenia" };

describe("aplicar un scan al plan", () => {
  it("no toca nada si el scan no propone cambios", async () => {
    const { client, writes, invoke } = fakeClient({});
    expect(await applyScanPlan(client, "u1", {})).toBe("no_changes");
    expect(writes).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("pide completar el perfil si no hay onboarding", async () => {
    const { client, writes } = fakeClient({ onboarding: null });
    expect(await applyScanPlan(client, "u1", scan)).toBe("needs_profile");
    expect(writes).toEqual([]);
  });

  it("guarda el scan y regenera el plan", async () => {
    const { client, writes, invoke } = fakeClient({});
    expect(await applyScanPlan(client, "u1", scan)).toBe("applied");
    expect(invoke).toHaveBeenCalledWith("generate-plan", { body: { user_id: "u1" } });
    expect(writes).toEqual([
      { table: "onboarding", values: { goal: "lose_fat", primary_focus: "gimnasio", equipment_type: "Gimnasio" } },
      { table: "profiles", values: { plan_status: "plan_pending" } },
    ]);
  });

  it("deshace los cambios si el servidor conserva la rutina (Free)", async () => {
    const { client, writes } = fakeClient({ invoke: async () => ({ data: { success: true, existing: true }, error: null }) });
    expect(await applyScanPlan(client, "u1", scan)).toBe("kept");
    expect(writes.slice(2)).toEqual([
      { table: "onboarding", values: restored },
      { table: "profiles", values: { plan_status: "plan_ready" } },
    ]);
  });

  it("deshace los cambios si la generación falla", async () => {
    const { client, writes } = fakeClient({ invoke: async () => ({ data: null, error: { context: new Response(null, { status: 500 }) } }) });
    expect(await applyScanPlan(client, "u1", scan)).toBe("failed");
    expect(writes.slice(2)).toEqual([
      { table: "onboarding", values: restored },
      { table: "profiles", values: { plan_status: "plan_ready" } },
    ]);
  });

  it("Coach: deja el scan para el entrenador sin deshacer nada", async () => {
    const { client, writes } = fakeClient({ invoke: async () => ({ data: null, error: { context: new Response(null, { status: 403 }) } }) });
    expect(await applyScanPlan(client, "u1", scan)).toBe("sent_to_coach");
    expect(writes).toHaveLength(2);
  });

  it("pide volver a entrar si la sesión ya no existe, sin escribir nada", async () => {
    const gone = new AuthSessionMissingError();
    const { client, writes, invoke } = fakeClient({ sessionError: gone, refreshError: gone });
    expect(await applyScanPlan(client, "u1", scan)).toBe("session_expired");
    expect(writes).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("sin conexión no da la sesión por caducada", async () => {
    const offline = new AuthRetryableFetchError("Failed to fetch", 0);
    const { client, writes } = fakeClient({ sessionError: offline });
    expect(await applyScanPlan(client, "u1", scan)).toBe("failed");
    expect(writes).toEqual([]);
  });

  it("si el servidor rechaza la sesión, deshace los cambios y pide volver a entrar", async () => {
    const { client, writes } = fakeClient({
      invoke: async () => ({ data: null, error: { context: new Response(JSON.stringify({ error: "Auth error: Auth session missing!" }), { status: 500 }) } }),
    });
    expect(await applyScanPlan(client, "u1", scan)).toBe("session_expired");
    expect(writes.slice(2)).toEqual([
      { table: "onboarding", values: restored },
      { table: "profiles", values: { plan_status: "plan_ready" } },
    ]);
  });

  it("falla sin llamar al servidor si no se pudo guardar el onboarding", async () => {
    const { client, invoke } = fakeClient({ updatedRows: 0 });
    expect(await applyScanPlan(client, "u1", scan)).toBe("failed");
    expect(invoke).not.toHaveBeenCalled();
  });
});
