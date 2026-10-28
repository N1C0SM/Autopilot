/**
 * Scan → plan. The muscle groups a body scan sees lagging become the plan's
 * priority. The app stores them in onboarding.specific_goal as
 * «… · Prioridad: hombros, pecho» once the user approves the scan, and
 * generate-plan reads them back on every regeneration. Shared by the client
 * (src/shared/lib/scanApply.ts) and generate-plan, so both use the same mapping.
 */

/** analyze-physique groups («Deltoides», «Dorsales», «Cadena posterior (glúteo+isquio)»…) → exercise library groups. First match wins. */
const GROUP_RULES: Array<[RegExp, string[]]> = [
  // Rear delts are trained with pulls (face pulls, rows), not presses.
  [/deltoides? posterior/i, ["Espalda"]],
  [/deltoid|hombro/i, ["Hombros"]],
  [/pecho|pectoral/i, ["Pecho"]],
  [/espalda|dorsal/i, ["Espalda"]],
  [/b[ií]ceps/i, ["Bíceps"]],
  [/tr[ií]ceps/i, ["Tríceps"]],
  [/(^|[\s/(])brazos?\b/i, ["Bíceps", "Tríceps"]],
  [/core|abdom/i, ["Core"]],
  [/cu[aá]driceps|pierna/i, ["Piernas"]],
  [/gl[uú]te|isquio|cadena posterior/i, ["Glúteos"]],
  [/gemelo/i, ["Gemelos"]],
];

/** Movement pattern that trains each library group, for the extra priority exercise. */
export const PRIORITY_PATTERN: Record<string, string> = {
  Pecho: "Empuje",
  Hombros: "Empuje",
  "Tríceps": "Empuje",
  Espalda: "Tirón",
  "Bíceps": "Tirón",
  Piernas: "Sentadilla",
  "Glúteos": "Bisagra",
  Core: "Core",
};

/** A score below this means the group is lagging. */
const LAGGING_BELOW = 7;
export const MAX_PRIORITIES = 2;

export function libraryMusclesFor(label: string): string[] {
  for (const [re, muscles] of GROUP_RULES) if (re.test(label)) return muscles;
  return [];
}

export type MuscleScore = { group: string; score: number };

/**
 * The two most lagging groups of a scan (score under 7), as library groups. Only groups
 * generate-plan can actually steer (they have a movement pattern), so the app never promises
 * a priority the plan cannot honour (e.g. calves). Empty when nothing is lagging.
 */
export function scanPriorityMuscles(breakdown: MuscleScore[] | null | undefined): string[] {
  const lagging = (breakdown ?? [])
    .filter((m) => typeof m?.score === "number" && Number.isFinite(m.score) && m.score < LAGGING_BELOW)
    .sort((a, b) => a.score - b.score);
  const out: string[] = [];
  for (const m of lagging) {
    for (const muscle of libraryMusclesFor(m.group)) {
      if (PRIORITY_PATTERN[muscle] && !out.includes(muscle)) out.push(muscle);
    }
    if (out.length >= MAX_PRIORITIES) break;
  }
  return out.slice(0, MAX_PRIORITIES);
}

/** Only the segment the app writes, at the end: «… · Prioridad: hombros, pecho». The user's own text is never matched. */
const PRIORITY_SEGMENT = /(?:^|\s*·\s*)Prioridad: ([a-záéíóúñ]+(?:, [a-záéíóúñ]+)*)\s*$/i;

/** The user's own text, without the app's priority segment. */
export function withoutPriority(specificGoal: string | null | undefined): string {
  return (specificGoal ?? "").replace(PRIORITY_SEGMENT, "").trim();
}

/** The user's own specific goal with the scan priority replaced (never overwrites the user's text). */
export function withPriority(specificGoal: string | null | undefined, muscles: string[]): string {
  const base = withoutPriority(specificGoal);
  const priority = muscles.length ? `Prioridad: ${muscles.map((m) => m.toLowerCase()).join(", ")}` : "";
  return [base, priority].filter(Boolean).join(" · ");
}

/** Library groups the user prioritised, read back from specific_goal («Prioridad: hombros, pecho»). */
export function parsePriorityMuscles(specificGoal: string | null | undefined): string[] {
  const match = PRIORITY_SEGMENT.exec(specificGoal ?? "");
  if (!match) return [];
  const out: string[] = [];
  for (const part of match[1].split(", ")) {
    for (const muscle of libraryMusclesFor(part)) if (!out.includes(muscle)) out.push(muscle);
  }
  return out.slice(0, 3);
}
