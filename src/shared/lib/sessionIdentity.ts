import type { DayPlan } from "@/shared/types/training";

/**
 * Nombre e icono de cada sesión. El nombre es `routine_name` (el mismo que edita el editor
 * de rutina) y el icono, `session_icon`: un emoji elegido por el usuario o, si no hay, la
 * foto de la sesión. La sugerencia sale de los músculos de sus ejercicios (sin IA ni red),
 * con el mismo vocabulario que las portadas de `session-cover`.
 * Es `SessionIdentity` en la app nativa (`native/Autopilot/Core/Training.swift`).
 */
export const SESSION_EMOJIS = ["💪", "🏋️", "🦵", "🔥", "⚡", "🎯", "🧱", "🦍", "🏃", "🚴", "🏊", "🧘", "🥊", "⛰️", "🏆", "⭐"];

const GROUPS: [string, string][] = [
  ["full body", "full"], ["cuerpo completo", "full"], ["pecho", "chest"], ["espalda", "back"], ["dorsal", "back"], ["hombro", "shoulders"],
  ["cuadriceps", "legs"], ["cuádriceps", "legs"], ["femoral", "legs"], ["isquio", "legs"], ["pierna", "legs"], ["gemelo", "legs"],
  ["gluteo", "glutes"], ["glúteo", "glutes"], ["biceps", "arms"], ["bíceps", "arms"], ["triceps", "arms"], ["tríceps", "arms"],
  ["brazo", "arms"], ["antebrazo", "arms"], ["core", "core"], ["abdom", "core"], ["lumbar", "core"],
];
const ORDER = ["chest", "back", "shoulders", "legs", "glutes", "arms", "core"];
const LABEL: Record<string, string> = {
  chest: "Pecho", back: "Espalda", shoulders: "Hombros", legs: "Piernas", glutes: "Glúteos", arms: "Brazos", core: "Core",
};

/** Grupos musculares de la sesión, en orden fijo; «full» si son cuatro o más (o lo dice el foco). */
export function sessionGroups(plan: DayPlan): string[] {
  const found = new Set<string>();
  const sources = [plan.muscle_focus, ...(plan.exercises ?? []).map((exercise) => exercise.muscle_group)];
  for (const source of sources) {
    const text = String(source ?? "").toLowerCase();
    for (const [key, group] of GROUPS) if (text.includes(key)) found.add(group);
  }
  if (found.has("full")) return ["full"];
  const list = ORDER.filter((group) => found.has(group));
  return list.length >= 4 ? ["full"] : list;
}

const within = (groups: string[], allowed: string[]) => groups.every((group) => allowed.includes(group));

/** Nombre sugerido: Empuje, Tirón, Pierna, Torso, Cuerpo completo o los dos grupos principales. */
export function suggestSessionName(plan: DayPlan): string {
  if (plan.type !== "gimnasio") return plan.sport?.trim() || "Actividad";
  const groups = sessionGroups(plan);
  if (groups.length === 0) return "Entreno";
  if (groups[0] === "full") return "Cuerpo completo";
  if (groups.includes("chest") && within(groups, ["chest", "shoulders", "arms"])) return groups.length > 1 ? "Empuje" : "Pecho";
  if (groups.includes("back") && within(groups, ["back", "arms"])) return groups.length > 1 ? "Tirón" : "Espalda";
  if ((groups.includes("legs") || groups.includes("glutes")) && within(groups, ["legs", "glutes", "core"])) return "Pierna";
  if (groups.includes("chest") && groups.includes("back") && within(groups, ["chest", "back", "shoulders", "arms"])) return "Torso";
  const names = groups.slice(0, 2).map((group) => LABEL[group]);
  return names.length === 2 ? `${names[0]} y ${names[1].toLowerCase()}` : names[0];
}

const SPORTS: [string, string][] = [
  ["corr", "🏃"], ["run", "🏃"], ["bici", "🚴"], ["cicl", "🚴"], ["spin", "🚴"], ["nata", "🏊"], ["swim", "🏊"],
  ["yoga", "🧘"], ["pilates", "🧘"], ["movil", "🧘"], ["box", "🥊"], ["artes", "🥊"], ["hike", "⛰️"], ["sender", "⛰️"], ["montañ", "⛰️"],
];

/** Icono sugerido para la sesión, a juego con su nombre sugerido. */
export function suggestSessionIcon(plan: DayPlan): string {
  if (plan.type !== "gimnasio") {
    const sport = String(plan.sport ?? "").toLowerCase();
    return SPORTS.find(([key]) => sport.includes(key))?.[1] ?? "🔥";
  }
  const name = suggestSessionName(plan);
  if (name === "Cuerpo completo") return "⚡";
  if (name === "Pierna" || name === "Piernas" || name === "Glúteos") return "🦵";
  if (name === "Core") return "🎯";
  if (name === "Tirón" || name === "Espalda") return "🦍";
  if (name === "Empuje" || name === "Pecho" || name === "Hombros") return "🏋️";
  return "💪";
}

/** Solo un emoji de la lista (u otro emoji corto); cualquier otro texto se ignora. */
export function cleanSessionIcon(icon?: string | null): string | null {
  const value = icon?.trim() ?? "";
  if (!value || value.length > 8 || /[\p{L}\p{N}]/u.test(value.replace(/️/g, ""))) return null;
  return value;
}

/** Plan con el nombre y el icono de una sesión cambiados; el resto, intacto. */
export function withSessionIdentity(plans: readonly DayPlan[], day: string, identity: { name: string; icon: string | null }): DayPlan[] {
  return plans.map((plan) => {
    if (plan.day !== day) return plan;
    const next: DayPlan = { ...plan };
    if (plan.type === "gimnasio") next.routine_name = identity.name.trim();
    const icon = cleanSessionIcon(identity.icon);
    if (icon) next.session_icon = icon;
    else delete next.session_icon;
    return next;
  });
}
