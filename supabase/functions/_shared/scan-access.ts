import { getConsumerPlan } from "./entitlements.ts";
import { getAuthedUser } from "./require-user.ts";

/**
 * Scan completo (análisis detallado, yo futuro, comparativas) solo con Plus o superior,
 * o para admin/entrenador. Visitantes y plan Free reciben el scan básico. Se decide aquí,
 * en el servidor, para que la app no pueda saltárselo.
 */
// Cliente admin de cualquiera de las versiones de supabase-js que usan las funciones.
// deno-lint-ignore no-explicit-any
type AdminClient = { from: (table: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any };

export async function hasFullScan(req: Request, admin: AdminClient): Promise<boolean> {
  const user = await getAuthedUser(req);
  if (!user) return false;
  const [{ data: profile }, { data: isAdmin }, { data: isTrainer }] = await Promise.all([
    admin.from("profiles").select("payment_status, subscription_tier, subscription_status, subscription_end, stripe_payment_id").eq("user_id", user.id).maybeSingle(),
    admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    admin.rpc("has_role", { _user_id: user.id, _role: "trainer" }),
  ]);
  return !!isAdmin || !!isTrainer || getConsumerPlan(profile) !== "free";
}

/** Lo que se queda en el scan básico: nota, resumen, cuello de botella y 2 mejoras. */
export const SCAN_LOCKED_SECTIONS = [
  "Composición corporal (% graso, masa magra, somatotipo)",
  "Puntuación de cada grupo muscular",
  "Postura y proporciones (V, simetría)",
  "Protocolo: series, calorías y ejercicios clave",
  "Tu yo futuro con el plan",
  "Comparativa de antes y después",
];

export function toBasicScan(parsed: Record<string, unknown>): Record<string, unknown> {
  const basic = { ...parsed };
  for (const k of ["body_composition", "muscle_breakdown", "posture", "proportions", "genetic_markers", "protocol",
    "months_with_plan", "months_without_plan", "estimated_months", "inferred_specific_goals"]) delete basic[k];
  if (Array.isArray(basic.improvements)) basic.improvements = (basic.improvements as unknown[]).slice(0, 2);
  // Los insights bloqueados llevan cifras de Plus (kcal, % graso, semanas): al básico solo
  // le llega el título, para que no se puedan leer en la respuesta ni quitando el desenfoque.
  if (Array.isArray(basic.locked_insights)) {
    basic.locked_insights = (basic.locked_insights as unknown[]).map((li) => {
      const o = (li && typeof li === "object" ? li : {}) as Record<string, unknown>;
      return { label: o.label, category: o.category, teaser: "Incluido en tu scan completo con Plus" };
    });
  }
  basic.basic = true;
  basic.locked_sections = SCAN_LOCKED_SECTIONS;
  return basic;
}
