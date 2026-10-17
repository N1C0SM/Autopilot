import { generatePlanGuarded } from "@/lib/planShield";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { getConsumerPlan, type BillingProfile } from "@/lib/entitlements";
import {
  libraryMusclesFor, MAX_PRIORITIES, parsePriorityMuscles, scanPriorityMuscles, withoutPriority, withPriority, type MuscleScore,
} from "../../supabase/functions/_shared/scan-focus";

type Client = typeof import("@/integrations/supabase/client").supabase;

/** Lo que el análisis del scan puede proponer. Nunca se aplica solo. */
export type ScanInferences = {
  inferred_goal?: string;
  inferred_focus?: string;
  inferred_intensity?: number;
  inferred_specific_goals?: string[];
  muscle_breakdown?: MuscleScore[];
  protocol?: {
    training_days_per_week?: number;
  };
};

/** Objetivos que puede proponer el scan (los mismos que el configurador y el editor del admin; «skill_based» no lo propone nunca). */
const GOALS = new Set(["lose_weight", "gain_muscle", "recomp", "improve_endurance", "general_health"]);

/** Grupos que el scan ve atrasados, como grupos de la biblioteca de ejercicios («Hombros», «Pecho»…). */
export function scanPriorities(r: ScanInferences): string[] {
  return scanPriorityMuscles(r.muscle_breakdown);
}

/** El objetivo concreto que escribió el usuario, sin la prioridad que añade la app (para mostrarlo). */
export const userSpecificGoal = withoutPriority;

type Current = Partial<Pick<Tables<"onboarding">, "specific_goal" | "goal">> | null | undefined;

/**
 * Traduce el scan a los campos de `onboarding` que de verdad cambian el plan:
 * objetivo, grupos prioritarios e intensidad. No toca el material
 * (`primary_focus`/`equipment_type`): una foto no dice si entrenas en gimnasio,
 * y cambiarlo convertiría un plan de gimnasio en uno de calistenia. No cambia un
 * objetivo de habilidad («skill_based») ni sustituye el texto del usuario: solo
 * le añade, cambia o quita «Prioridad: …». Devuelve `{}` cuando no hay nada que aplicar.
 */
export function buildScanPlanUpdates(r: ScanInferences, current?: Current): TablesUpdate<"onboarding"> {
  const updates = applicableUpdates(r, current);
  if (Object.keys(updates).length === 0) return updates;
  // intensity_level es un entero en la base de datos: 7,5 haría fallar el guardado.
  if (typeof r.inferred_intensity === "number" && Number.isFinite(r.inferred_intensity)) {
    updates.intensity_level = Math.round(Math.min(10, Math.max(1, r.inferred_intensity)));
  }
  // APLICAR DÍAS DE ENTRENAMIENTO del scan
  console.log("[SCAN-APPLY] protocol data:", r.protocol);
  if (r.protocol?.training_days_per_week && Number.isInteger(r.protocol.training_days_per_week)) {
    const days = Math.min(7, Math.max(2, r.protocol.training_days_per_week));
    console.log(`[SCAN-APPLY] Setting availability.days to ${days} from scan protocol`);
    updates.availability = { days };
  } else {
    console.log("[SCAN-APPLY] No training_days_per_week found in protocol, not setting availability");
  }
  return updates;
}

/** Lo que justifica aplicar el scan. La intensidad sola no cuenta: casi nunca cambia el plan. */
function applicableUpdates(r: ScanInferences, current?: Current): TablesUpdate<"onboarding"> {
  const updates: TablesUpdate<"onboarding"> = {};
  const goal = r.inferred_goal;
  if (goal && GOALS.has(goal) && current?.goal !== "skill_based" && goal !== current?.goal) updates.goal = goal;
  if (r.muscle_breakdown?.length) {
    // Un scan solo quita prioridades de los grupos que ha puntuado: uno de frente no quita la de
    // espalda que no ha visto. Si hay más de dos, manda lo que acaba de ver el scan (va primero).
    const existing = parsePriorityMuscles(current?.specific_goal);
    const scored = new Set(r.muscle_breakdown.flatMap((m) => libraryMusclesFor(m.group)));
    const next = [...new Set([...scanPriorities(r), ...existing.filter((m) => !scored.has(m))])].slice(0, MAX_PRIORITIES);
    if (next.length || existing.length) {
      const specificGoal = withPriority(current?.specific_goal, next);
      if (specificGoal !== (current?.specific_goal ?? "")) updates.specific_goal = specificGoal || null;
    }
  }
  return updates;
}

/**
 * ¿Este scan propone algo que se pueda aplicar a este usuario? Con su onboarding (si se conoce)
 * también cuenta quitar una prioridad antigua, y no cuenta lo que ya tiene.
 */
export function hasScanInferences(r: ScanInferences, current?: Current): boolean {
  return Object.keys(applicableUpdates(r, current)).length > 0;
}

/** ¿El scan trae algo con lo que decidir (un objetivo válido o notas por grupo)? */
const scanHasSignal = (r: ScanInferences) =>
  !!r.muscle_breakdown?.length || (!!r.inferred_goal && GOALS.has(r.inferred_goal));

/**
 * Plus y Coach rehacen su plan con un scan; Free conserva su rutina inicial
 * (generate-plan no la regenera). Un admin siempre puede, para probarlo.
 */
export function canApplyScanToPlan(billing: BillingProfile | null | undefined, isAdmin: boolean): boolean {
  return isAdmin || getConsumerPlan(billing) !== "free";
}

export type ScanApplyOutcome =
  /** Plan regenerado con el scan y el entrenamiento ha cambiado. */
  | "applied"
  /** El entrenamiento sale igual, pero los macros de nutrición han cambiado. */
  | "nutrition_only"
  /** Plan regenerado con el scan, pero ya encajaba: entrenamiento y macros salen iguales. */
  | "unchanged"
  /** Coach: lo aprobado queda guardado para que el entrenador ajuste el plan. */
  | "sent_to_coach"
  /** El scan no propone nada que aplicar: no se toca nada. */
  | "no_changes"
  /** Sin onboarding no hay con qué generar el plan. */
  | "needs_profile"
  /** El servidor conservó la rutina (cuenta Free): se deshacen los cambios. */
  | "kept"
  /** La rutina es personalizada y el usuario decidió conservarla. */
  | "custom_kept"
  /** La sesión ya no existe en el servidor (p. ej. se cerró en otro dispositivo): hay que volver a entrar. */
  | "session_expired"
  /** Se cortó la conexión con el servidor: no se puede saber si llegó a regenerarse. */
  | "unknown"
  /** Algo falló: se deshacen los cambios y el plan queda como estaba. */
  | "failed";

const functionStatus = (error: unknown) => (error as { context?: Response } | null)?.context?.status;

/** generate-plan responde 500 con «Auth error: …» cuando la sesión ya no existe. */
async function isAuthFailure(error: unknown) {
  const context = (error as { context?: Response } | null)?.context;
  if (!context || typeof context.clone !== "function") return false;
  const text = await context.clone().text().catch(() => "");
  return /Auth error|Not authenticated|No authorization header/i.test(text);
}

/** Deja en consola el paso que falló y el mensaje del servidor, para poder diagnosticarlo. */
async function logFailure(step: string, error: unknown) {
  let detail: unknown = error;
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.clone === "function") {
    detail = await context.clone().text().catch(() => error);
  }
  console.error(`applyScanPlan failed at ${step}`, detail);
}

/** Huella del plan para comparar antes y después; `undefined` si no se pudo leer. */
const readPlan = async (client: Client, userId: string): Promise<{ workouts: string; macros: string } | undefined> => {
  const [training, nutrition] = await Promise.all([
    client.from("training_plan").select("workouts_json").eq("user_id", userId).maybeSingle(),
    client.from("nutrition_plan").select("macros_json").eq("user_id", userId).maybeSingle(),
  ]);
  if (training.error || nutrition.error) return undefined;
  return {
    workouts: JSON.stringify(training.data?.workouts_json ?? null),
    macros: JSON.stringify(nutrition.data?.macros_json ?? null),
  };
};

export type PlanPrint = Awaited<ReturnType<typeof readPlan>>;

export type ScanApplyResult = {
  outcome: ScanApplyOutcome;
  /** Huella del plan antes del primer intento: un reintento compara contra ella, no contra un plan ya regenerado. */
  baseline?: PlanPrint;
  /** Grupos prioritarios que quedan guardados tras aplicar. */
  priorities: string[];
  /** Objetivo y objetivo concreto tal como quedan en onboarding. */
  saved?: Pick<Tables<"onboarding">, "goal" | "specific_goal">;
};

const compare = (before: PlanPrint, after: PlanPrint): "applied" | "nutrition_only" | "unchanged" => {
  if (!before || !after || before.workouts !== after.workouts) return "applied";
  return before.macros !== after.macros ? "nutrition_only" : "unchanged";
};

/**
 * Aplica lo aprobado del scan al onboarding y regenera el plan. Si el servidor
 * no lo regenera, devuelve el onboarding a como estaba, para que «tu plan no ha
 * cambiado» sea verdad. No marca el plan como pendiente: el Dashboard oculta
 * Progreso mientras un plan está pendiente y el resultado del scan se perdería.
 * `retryOf` es el resultado del intento anterior al pulsar «Reintentar».
 */
export async function applyScanPlan(
  client: Client,
  userId: string,
  r: ScanInferences,
  opts: { retryOf?: ScanApplyResult | null } = {},
): Promise<ScanApplyResult> {
  console.log("[APPLY-SCAN] Starting with scan data:", {
    hasProtocol: !!r.protocol,
    trainingDays: r.protocol?.training_days_per_week,
    hasGoal: !!r.inferred_goal,
    hasBreakdown: !!r.muscle_breakdown?.length
  });
  const result = (outcome: ScanApplyOutcome, extra: Partial<ScanApplyResult> = {}): ScanApplyResult => ({ outcome, priorities: [], ...extra });
  if (!scanHasSignal(r)) return result("no_changes");

  // generate-plan valida la sesión contra el servidor; la base de datos solo mira el token.
  // Si la sesión se cerró en otro sitio, se detecta aquí, antes de escribir nada.
  const { error: sessionError } = await client.auth.getUser();
  if (sessionError) {
    if (isAuthRetryableFetchError(sessionError)) {
      await logFailure("session (network)", sessionError);
      return result("failed", { baseline: opts.retryOf?.baseline });
    }
    const { error: refreshError } = await client.auth.refreshSession();
    if (refreshError) {
      await logFailure("session", sessionError);
      return result(isAuthRetryableFetchError(refreshError) ? "failed" : "session_expired", { baseline: opts.retryOf?.baseline });
    }
  }

  const { data: onboarding, error: onboardingError } = await client
    .from("onboarding").select("*").eq("user_id", userId).maybeSingle();
  if (onboardingError) {
    await logFailure("read onboarding", onboardingError);
    return result("failed", { baseline: opts.retryOf?.baseline });
  }
  if (!onboarding) return result("needs_profile");

  // Sin nada nuevo para este usuario no se regenera, salvo al reintentar (lo del scan ya quedó guardado).
  const current = onboarding as Tables<"onboarding">;
  const proposed = buildScanPlanUpdates(r, current);
  if (Object.keys(proposed).length === 0 && !opts.retryOf) {
    return result("no_changes", { saved: { goal: current.goal, specific_goal: current.specific_goal } });
  }

  // Solo se escribe lo que cambia.
  const updates: TablesUpdate<"onboarding"> = {};
  const previous: TablesUpdate<"onboarding"> = {};
  for (const [key, value] of Object.entries(proposed)) {
    const k = key as keyof Tables<"onboarding">;
    if (current[k] === value) continue;
    (updates as Record<string, unknown>)[key] = value;
    (previous as Record<string, unknown>)[key] = current[k];
  }
  const wrote = Object.keys(updates).length > 0;
  const saved = {
    goal: (updates.goal ?? current.goal) as string | null,
    specific_goal: (updates.specific_goal !== undefined ? updates.specific_goal : current.specific_goal) as string | null,
  };
  const applied = (outcome: ScanApplyOutcome, baseline: PlanPrint) =>
    result(outcome, { baseline, saved, priorities: parsePriorityMuscles(saved.specific_goal) });

  const restore = async () => {
    if (!wrote) return;
    const { error } = await client.from("onboarding").update(previous).eq("user_id", userId);
    if (error) console.error("applyScanPlan restore", error);
  };

  const before = opts.retryOf?.baseline ?? (await readPlan(client, userId));

  if (wrote) {
    const { data: updated, error: updateError } = await client
      .from("onboarding").update(updates).eq("user_id", userId).select("id");
    if (updateError || !updated?.length) {
      await logFailure("update onboarding", updateError ?? "no row updated");
      return result("failed", { baseline: before });
    }
  }

  const guarded = await generatePlanGuarded(client as never, { user_id: userId }, { userId });
  const { data, error } = guarded;
  if (guarded.kept) {
    await restore();
    return result("custom_kept", { baseline: before });
  }
  if (error) {
    // Coach: el plan lo prepara su entrenador; lo aprobado queda guardado para él.
    if (functionStatus(error) === 403) return applied("sent_to_coach", before);
    await logFailure("generate-plan", error);
    // El servidor puede haber escrito el plan antes de fallar (p. ej. en la nutrición): entonces no se deshace.
    const after = await readPlan(client, userId);
    if (before && after) {
      const outcome = compare(before, after);
      if (outcome !== "unchanged") return applied(outcome, before);
    }
    // Conexión cortada o plan ilegible: el servidor puede seguir trabajando con los datos nuevos, así que no se deshace.
    if ((error as { name?: string }).name === "FunctionsFetchError" || !before || !after) return applied("unknown", before);
    await restore();
    return result((await isAuthFailure(error)) ? "session_expired" : "failed", { baseline: before });
  }
  if ((data as { existing?: boolean } | null)?.existing) {
    await restore();
    return result("kept");
  }
  return applied(compare(before, await readPlan(client, userId)), before);
}
