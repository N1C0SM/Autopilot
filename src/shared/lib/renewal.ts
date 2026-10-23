// Lógica de ciclo del plan Transformación 12 semanas.
// Se mantiene fuera de la UI para poder reutilizarla (panel cliente, admin, futuros clientes nativos).

export const CYCLE_WEEKS = 12;

export type RenewalDecision = "renovar" | "completo" | "pausar";

export const RENEWAL_LABELS: Record<RenewalDecision, string> = {
  renovar: "Renovar Transformación (299€ / 12 semanas)",
  completo: "Pasar a Completo (49€/mes)",
  pausar: "Pausar / cancelar",
};

/** Semana del ciclo (1 = primera semana). Devuelve null si no hay fecha de inicio. */
export function currentCycleWeek(cycleStart?: string | null, now: Date = new Date()): number | null {
  if (!cycleStart) return null;
  const start = new Date(`${cycleStart}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const days = Math.floor((now.getTime() - start.getTime()) / 86400000);
  if (days < 0) return null;
  return Math.floor(days / 7) + 1;
}

/** Fecha en la que termina el ciclo de 12 semanas. */
export function cycleEndDate(cycleStart?: string | null): Date | null {
  if (!cycleStart) return null;
  const start = new Date(`${cycleStart}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + CYCLE_WEEKS * 7 * 86400000);
}

export function formatDateES(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export function isTransformTier(tier?: string | null): boolean {
  return tier === "transform";
}
