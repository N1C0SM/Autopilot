import { AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { applyScanPlan, buildScanPlanUpdates, canApplyScanToPlan, hasScanInferences, scanPriorities, userSpecificGoal } from "@/shared/lib/scanApply";

/** El resultado de aplicar (la mayoría de pruebas solo miran qué pasó). */
const run = async (...args: Parameters<typeof applyScanPlan>) => (await applyScanPlan(...args)).outcome;

const breakdown = [
  { group: "Pecho", score: 6.5 },
  { group: "Deltoides", score: 5 },
  { group: "Brazos", score: 7.5 },
  { group: "Core/abdomen", score: 8 },
];
const balanced = [{ group: "Pecho", score: 8 }, { group: "Deltoides", score: 7.5 }];

describe("lo que aplica un scan al plan", () => {
  it("no propone nada sin objetivo válido ni grupos atrasados; la intensidad sola no cuenta", () => {
    expect(buildScanPlanUpdates({})).toEqual({});
    expect(hasScanInferences({})).toBe(false);
    expect(hasScanInferences({ inferred_goal: "ser_feliz" })).toBe(false);
    expect(hasScanInferences({ muscle_breakdown: balanced })).toBe(false);
    expect(hasScanInferences({ inferred_intensity: 8 })).toBe(false);
    expect(buildScanPlanUpdates({ inferred_intensity: 8 })).toEqual({});
  });

  it("prioriza los dos grupos más atrasados que el generador puede trabajar", () => {
    expect(scanPriorities({ muscle_breakdown: breakdown })).toEqual(["Hombros", "Pecho"]);
    expect(scanPriorities({ muscle_breakdown: [{ group: "Dorsales", score: 4 }, { group: "Cadena posterior (glúteo+isquio)", score: 5 }] }))
      .toEqual(["Espalda", "Glúteos"]);
    expect(scanPriorities({ muscle_breakdown: [{ group: "Gemelos", score: 3 }, { group: "Pecho", score: 5 }] })).toEqual(["Pecho"]);
    expect(scanPriorities({ muscle_breakdown: [{ group: "Deltoides posterior", score: 4 }] })).toEqual(["Espalda"]);
  });

  it("añade la prioridad al objetivo concreto del usuario sin borrarlo", () => {
    expect(buildScanPlanUpdates({ muscle_breakdown: breakdown }, { specific_goal: "Handstand / Pino" }))
      .toEqual({ specific_goal: "Handstand / Pino · Prioridad: hombros, pecho" });
    expect(buildScanPlanUpdates({ muscle_breakdown: breakdown }, { specific_goal: "Pino · Prioridad: piernas" }))
      .toEqual({ specific_goal: "Pino · Prioridad: hombros, pecho" });
    expect(buildScanPlanUpdates({ muscle_breakdown: breakdown }, null)).toEqual({ specific_goal: "Prioridad: hombros, pecho" });
    expect(buildScanPlanUpdates({ muscle_breakdown: breakdown }, { specific_goal: "Mi prioridad: dominadas" }))
      .toEqual({ specific_goal: "Mi prioridad: dominadas · Prioridad: hombros, pecho" });
  });

  it("quita la prioridad de un scan anterior cuando ya no hay grupos atrasados", () => {
    expect(buildScanPlanUpdates({ muscle_breakdown: balanced }, { specific_goal: "Pino · Prioridad: hombros" }))
      .toEqual({ specific_goal: "Pino" });
    expect(buildScanPlanUpdates({ muscle_breakdown: balanced }, { specific_goal: "Prioridad: hombros" }))
      .toEqual({ specific_goal: null });
    expect(buildScanPlanUpdates({ muscle_breakdown: balanced }, { specific_goal: "Pino" })).toEqual({});
  });

  it("un scan parcial no quita prioridades de grupos que no ha visto (si no caben, manda el scan nuevo)", () => {
    const front = [{ group: "Pecho", score: 8 }, { group: "Deltoides", score: 8 }];
    expect(buildScanPlanUpdates({ muscle_breakdown: front }, { specific_goal: "Prioridad: espalda, glúteos" })).toEqual({});
    expect(buildScanPlanUpdates({ muscle_breakdown: [{ group: "Pecho", score: 5 }] }, { specific_goal: "Prioridad: espalda, hombros" }))
      .toEqual({ specific_goal: "Prioridad: pecho, espalda" });
    expect(buildScanPlanUpdates({ muscle_breakdown: front }, { specific_goal: "Prioridad: espalda, hombros" }))
      .toEqual({ specific_goal: "Prioridad: espalda" });
  });

  it("con el onboarding del usuario, el botón sabe si hay algo nuevo (incluido quitar una prioridad)", () => {
    expect(hasScanInferences({ muscle_breakdown: balanced }, { specific_goal: "Pino · Prioridad: hombros" })).toBe(true);
    expect(hasScanInferences({ muscle_breakdown: breakdown }, { specific_goal: "Pino · Prioridad: hombros, pecho" })).toBe(false);
  });

  it("un objetivo igual al actual no cuenta, ni con intensidad", () => {
    expect(hasScanInferences({ inferred_goal: "lose_weight" }, { goal: "lose_weight" })).toBe(false);
    expect(buildScanPlanUpdates({ inferred_goal: "lose_weight", inferred_intensity: 8 }, { goal: "lose_weight" })).toEqual({});
  });

  it("muestra el objetivo del usuario sin la prioridad de la app", () => {
    expect(userSpecificGoal("Pino · Prioridad: hombros, pecho")).toBe("Pino");
    expect(userSpecificGoal("Prioridad: hombros")).toBe("");
  });

  it("no cambia el material ni sustituye el objetivo concreto por el texto del scan", () => {
    expect(buildScanPlanUpdates({ inferred_focus: "calistenia", inferred_specific_goals: ["Reducir grasa abdominal"] })).toEqual({});
  });

  it("solo acepta objetivos que entiende el generador y nunca pisa una habilidad", () => {
    expect(buildScanPlanUpdates({ inferred_goal: "lose_weight" })).toEqual({ goal: "lose_weight" });
    expect(buildScanPlanUpdates({ inferred_goal: "lose_fat" })).toEqual({});
    expect(buildScanPlanUpdates({ inferred_goal: "lose_weight" }, { goal: "skill_based" })).toEqual({});
  });

  it("guarda la intensidad como entero entre 1 y 10 cuando hay algo que aplicar", () => {
    expect(buildScanPlanUpdates({ inferred_goal: "recomp", inferred_intensity: 7.5 })).toEqual({ goal: "recomp", intensity_level: 8 });
    expect(buildScanPlanUpdates({ inferred_goal: "recomp", inferred_intensity: 14 })).toEqual({ goal: "recomp", intensity_level: 10 });
    expect(buildScanPlanUpdates({ inferred_goal: "recomp", inferred_intensity: Number.NaN })).toEqual({ goal: "recomp" });
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
type Plan = { workouts: unknown; macros: unknown } | null;

/**
 * Cliente falso. `plans` son las lecturas sucesivas del plan (training_plan y
 * nutrition_plan): antes de generar, después y, si hace falta, tras un error.
 */
function fakeClient(opts: {
  onboarding?: Record<string, unknown> | null;
  invoke?: Invoke;
  updatedRows?: number;
  sessionError?: unknown;
  refreshError?: unknown;
  plans?: Plan[];
  restoreError?: unknown;
  /** Las lecturas del plan fallan (red, permisos). */
  planError?: unknown;
}) {
  const writes: { table: string; values: Record<string, unknown> }[] = [];
  const onboarding = opts.onboarding === undefined
    ? { id: "o1", goal: "gain_muscle", intensity_level: 7, specific_goal: "Pino", primary_focus: "gimnasio" }
    : opts.onboarding;
  const plans = [...(opts.plans ?? [{ workouts: [{ day: "Lunes" }], macros: { kcal: 2600 } }, { workouts: [{ day: "Lunes", extra: true }], macros: { kcal: 2600 } }])];
  let planRead: Plan = null;
  let reads = 0;
  const invoke = vi.fn(opts.invoke ?? (async () => ({ data: { success: true }, error: null })));
  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (table === "onboarding") return { data: onboarding, error: null };
              // training_plan abre una lectura nueva del plan; nutrition_plan lee la misma.
              if (opts.planError) return { data: null, error: opts.planError };
              if (table === "training_plan") {
                planRead = plans.length > 1 ? plans.shift()! : plans[0];
                reads += 1;
                return { data: planRead ? { workouts_json: planRead.workouts } : null, error: null };
              }
              return { data: planRead ? { macros_json: planRead.macros } : null, error: null };
            },
          }),
        }),
        update(values: Record<string, unknown>) {
          writes.push({ table, values });
          const isRestore = writes.filter((w) => w.table === table).length > 1;
          const done = Object.assign(Promise.resolve({ error: isRestore ? opts.restoreError ?? null : null }), {
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
  return { client: client as unknown as Parameters<typeof applyScanPlan>[0], writes, invoke, reads: () => reads };
}

const scan = { inferred_goal: "lose_weight", muscle_breakdown: breakdown };
const applied = { goal: "lose_weight", specific_goal: "Pino · Prioridad: hombros, pecho" };
const restored = { goal: "gain_muscle", specific_goal: "Pino" };
const httpError = (status: number, body: unknown = null) => ({ name: "FunctionsHttpError", context: new Response(body === null ? null : JSON.stringify(body), { status }) });

describe("aplicar un scan al plan", () => {
  it("no toca nada si el scan no propone cambios", async () => {
    const { client, writes, invoke } = fakeClient({});
    expect(await run(client, "u1", {})).toBe("no_changes");
    expect(writes).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("pide completar el perfil si no hay onboarding", async () => {
    const { client, writes } = fakeClient({ onboarding: null });
    expect(await run(client, "u1", scan)).toBe("needs_profile");
    expect(writes).toEqual([]);
  });

  it("guarda solo lo que cambia, regenera y no marca el plan como pendiente", async () => {
    const { client, writes, invoke } = fakeClient({});
    expect(await run(client, "u1", scan)).toBe("applied");
    expect(invoke).toHaveBeenCalledWith("generate-plan", { body: { user_id: "u1" } });
    expect(writes).toEqual([{ table: "onboarding", values: applied }]);
  });

  it("con el mismo objetivo solo escribe y deshace la prioridad", async () => {
    const { client, writes } = fakeClient({
      onboarding: { id: "o1", goal: "lose_weight", specific_goal: "Pino" },
      invoke: async () => ({ data: { success: true, existing: true }, error: null }),
    });
    expect(await run(client, "u1", scan)).toBe("kept");
    expect(writes).toEqual([
      { table: "onboarding", values: { specific_goal: "Pino · Prioridad: hombros, pecho" } },
      { table: "onboarding", values: { specific_goal: "Pino" } },
    ]);
  });

  it("al reintentar con todo ya guardado, regenera sin escribir", async () => {
    const { client, writes, invoke } = fakeClient({ onboarding: { id: "o1", ...applied, intensity_level: 7 } });
    expect(await run(client, "u1", scan, { retryOf: { outcome: "failed", priorities: [] } })).toBe("applied");
    expect(writes).toEqual([]);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("dice la verdad cuando el plan regenerado sale igual", async () => {
    const same = { workouts: [{ day: "Lunes" }], macros: { kcal: 2600 } };
    const { client } = fakeClient({ plans: [same, same] });
    expect(await run(client, "u1", scan)).toBe("unchanged");
  });

  it("distingue cuando solo cambia la nutrición", async () => {
    const { client } = fakeClient({ plans: [{ workouts: [1], macros: { kcal: 2600 } }, { workouts: [1], macros: { kcal: 2100 } }] });
    expect(await run(client, "u1", scan)).toBe("nutrition_only");
  });

  it("sin plan previo cuenta como plan nuevo", async () => {
    const { client } = fakeClient({ plans: [null, { workouts: [1], macros: null }] });
    expect(await run(client, "u1", scan)).toBe("applied");
  });

  it("deshace los cambios si el servidor conserva la rutina (Free)", async () => {
    const { client, writes } = fakeClient({ invoke: async () => ({ data: { success: true, existing: true }, error: null }) });
    expect(await run(client, "u1", scan)).toBe("kept");
    expect(writes.slice(1)).toEqual([{ table: "onboarding", values: restored }]);
  });

  it("deshace los cambios si la generación falla sin tocar el plan", async () => {
    const same = { workouts: [1], macros: null };
    const { client, writes } = fakeClient({ invoke: async () => ({ data: null, error: httpError(500) }), plans: [same, same] });
    expect(await run(client, "u1", scan)).toBe("failed");
    expect(writes.slice(1)).toEqual([{ table: "onboarding", values: restored }]);
  });

  it("no deshace nada si el servidor llegó a escribir el plan antes de fallar", async () => {
    const { client, writes } = fakeClient({
      invoke: async () => ({ data: null, error: httpError(500) }),
      plans: [{ workouts: [1], macros: null }, { workouts: [2], macros: null }],
    });
    expect(await run(client, "u1", scan)).toBe("applied");
    expect(writes).toEqual([{ table: "onboarding", values: applied }]);
  });

  it("si se corta la conexión, no deshace y avisa de que no se pudo confirmar", async () => {
    const same = { workouts: [1], macros: null };
    const { client, writes } = fakeClient({
      invoke: async () => ({ data: null, error: { name: "FunctionsFetchError", context: new TypeError("Load failed") } }),
      plans: [same, same],
    });
    expect(await run(client, "u1", scan)).toBe("unknown");
    expect(writes).toEqual([{ table: "onboarding", values: applied }]);
  });

  it("tras un fallo al deshacer, reintentar vuelve a regenerar", async () => {
    const same = { workouts: [1], macros: null };
    const first = fakeClient({ invoke: async () => ({ data: null, error: httpError(500) }), plans: [same, same], restoreError: { message: "offline" } });
    expect(await run(first.client, "u1", scan)).toBe("failed");
    expect(first.writes).toEqual([
      { table: "onboarding", values: applied },
      { table: "onboarding", values: restored },
    ]);
    // El deshacer falló: la base de datos se quedó con lo del scan. El reintento no escribe, pero regenera.
    const firstResult = await applyScanPlan(
      fakeClient({ invoke: async () => ({ data: null, error: httpError(500) }), plans: [same, same], restoreError: { message: "offline" } }).client,
      "u1",
      scan,
    );
    const retry = fakeClient({ onboarding: { id: "o1", intensity_level: 7, ...first.writes[0].values }, plans: [{ workouts: [2], macros: null }] });
    expect(await run(retry.client, "u1", scan, { retryOf: firstResult })).toBe("applied");
    expect(retry.writes).toEqual([]);
    expect(retry.invoke).toHaveBeenCalledTimes(1);
  });

  it("sin «Reintentar», un scan ya guardado no vuelve a regenerar", async () => {
    const { client, invoke } = fakeClient({ onboarding: { id: "o1", intensity_level: 7, ...applied } });
    expect(await run(client, "u1", scan)).toBe("no_changes");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("reintentar tras perder la conexión regenera aunque solo cambie la prioridad", async () => {
    const skill = { id: "o1", goal: "skill_based", specific_goal: "Pino" };
    const priorityOnly = { muscle_breakdown: breakdown };
    const p1 = { workouts: [1], macros: null };
    const first = await applyScanPlan(
      fakeClient({ onboarding: skill, invoke: async () => ({ data: null, error: { name: "FunctionsFetchError", context: new TypeError("Load failed") } }), plans: [p1, p1] }).client,
      "u1",
      priorityOnly,
    );
    expect(first.outcome).toBe("unknown");
    expect(first.priorities).toEqual(["Hombros", "Pecho"]);
    // El servidor terminó por su cuenta: el plan ya es el nuevo. El reintento compara con el plan de antes del scan.
    const p2 = { workouts: [2], macros: null };
    const retry = fakeClient({ onboarding: { ...skill, specific_goal: "Pino · Prioridad: hombros, pecho" }, plans: [p2] });
    expect(await run(retry.client, "u1", priorityOnly, { retryOf: first })).toBe("applied");
    expect(retry.invoke).toHaveBeenCalledTimes(1);
    expect(retry.writes).toEqual([]);
  });

  it("si el plan no se puede leer tras un error del servidor, no deshace y avisa", async () => {
    const { client, writes } = fakeClient({ invoke: async () => ({ data: null, error: httpError(500) }), planError: { message: "permission denied" } });
    expect(await run(client, "u1", scan)).toBe("unknown");
    expect(writes).toEqual([{ table: "onboarding", values: applied }]);
  });

  it("los resultados que dejan datos guardados los devuelven; los que deshacen, no", async () => {
    expect((await applyScanPlan(fakeClient({}).client, "u1", scan)).saved).toEqual(applied);
    expect((await applyScanPlan(fakeClient({ invoke: async () => ({ data: null, error: httpError(403) }) }).client, "u1", scan)).saved).toEqual(applied);
    const kept = await applyScanPlan(fakeClient({ invoke: async () => ({ data: { success: true, existing: true }, error: null }) }).client, "u1", scan);
    expect(kept.saved).toBeUndefined();
    const nothing = await applyScanPlan(fakeClient({ onboarding: { id: "o1", ...applied } }).client, "u1", scan);
    expect(nothing).toMatchObject({ outcome: "no_changes", saved: applied });
  });

  it("un reintento fallido conserva el plan de antes del scan para el siguiente", async () => {
    const p1 = { workouts: [1], macros: null };
    const first = await applyScanPlan(
      fakeClient({ invoke: async () => ({ data: null, error: { name: "FunctionsFetchError", context: new TypeError("Load failed") } }), plans: [p1, p1] }).client,
      "u1",
      scan,
    );
    expect(first.outcome).toBe("unknown");
    const second = await applyScanPlan(
      fakeClient({ onboarding: { id: "o1", ...applied }, invoke: async () => ({ data: null, error: httpError(500) }), plans: [p1] }).client,
      "u1",
      scan,
      { retryOf: first },
    );
    expect(second.outcome).toBe("failed");
    expect(second.baseline).toEqual(first.baseline);
  });

  it("devuelve las prioridades que quedan guardadas", async () => {
    const res = await applyScanPlan(fakeClient({ onboarding: { id: "o1", goal: "gain_muscle", specific_goal: "Pino · Prioridad: espalda" } }).client, "u1", {
      muscle_breakdown: [{ group: "Pecho", score: 5 }],
    });
    expect(res.outcome).toBe("applied");
    expect(res.priorities).toEqual(["Pecho", "Espalda"]);
    expect(res.saved?.specific_goal).toBe("Pino · Prioridad: pecho, espalda");
  });

  it("no regenera si para este usuario no hay nada que aplicar", async () => {
    const { client, writes, invoke } = fakeClient({ onboarding: { id: "o1", goal: "skill_based", specific_goal: "Pino" } });
    expect(await run(client, "u1", { inferred_goal: "lose_weight", muscle_breakdown: balanced })).toBe("no_changes");
    expect(writes).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("no deshace si el servidor falló después de cambiar la nutrición", async () => {
    const { client, writes } = fakeClient({
      invoke: async () => ({ data: null, error: httpError(500) }),
      plans: [{ workouts: [1], macros: { kcal: 2600 } }, { workouts: [1], macros: { kcal: 2100 } }],
    });
    expect(await run(client, "u1", scan)).toBe("nutrition_only");
    expect(writes).toEqual([{ table: "onboarding", values: applied }]);
  });

  it("Coach: deja lo aprobado para el entrenador sin deshacer nada ni ocultar su plan", async () => {
    const { client, writes } = fakeClient({ invoke: async () => ({ data: null, error: httpError(403) }) });
    expect(await run(client, "u1", scan)).toBe("sent_to_coach");
    expect(writes).toEqual([{ table: "onboarding", values: applied }]);
  });

  it("pide volver a entrar si la sesión ya no existe, sin escribir nada", async () => {
    const gone = new AuthSessionMissingError();
    const { client, writes, invoke } = fakeClient({ sessionError: gone, refreshError: gone });
    expect(await run(client, "u1", scan)).toBe("session_expired");
    expect(writes).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("sin conexión no da la sesión por caducada", async () => {
    const offline = new AuthRetryableFetchError("Failed to fetch", 0);
    const { client, writes } = fakeClient({ sessionError: offline });
    expect(await run(client, "u1", scan)).toBe("failed");
    expect(writes).toEqual([]);
  });

  it("si el servidor rechaza la sesión, deshace los cambios y pide volver a entrar", async () => {
    const same = { workouts: [1], macros: null };
    const { client, writes } = fakeClient({
      invoke: async () => ({ data: null, error: httpError(500, { error: "Auth error: Auth session missing!" }) }),
      plans: [same, same],
    });
    expect(await run(client, "u1", scan)).toBe("session_expired");
    expect(writes.slice(1)).toEqual([{ table: "onboarding", values: restored }]);
  });

  it("falla sin llamar al servidor si no se pudo guardar el onboarding", async () => {
    const { client, invoke } = fakeClient({ updatedRows: 0 });
    expect(await run(client, "u1", scan)).toBe("failed");
    expect(invoke).not.toHaveBeenCalled();
  });
});
