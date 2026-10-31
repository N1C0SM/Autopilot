/**
 * Biblioteca de ejercicios: lógica pura (sin red) compartida por la web y por las
 * pruebas. La app nativa replica las mismas listas y reglas en ExerciseLibraryView.swift.
 */

export const FILTER_GROUPS = [
  "Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Antebrazos", "Abdomen",
  "Cuádriceps", "Isquiotibiales", "Glúteos", "Gemelos", "Cuerpo completo",
] as const;

export const EQUIPMENT = [
  "Peso corporal", "Mancuernas", "Barra", "Máquinas", "Poleas", "Kettlebell",
  "Bandas elásticas", "Anillas", "Barra de dominadas", "Paralelas", "Otros",
] as const;

export const MODALITIES = [
  "Gimnasio", "Calistenia", "Entrenamiento funcional", "Entrenamiento híbrido", "Movilidad",
] as const;

/** Secciones de la ficha, en orden. La app nativa usa los mismos títulos (test de paridad). */
export const DETAIL_SECTIONS = [
  "Cómo se hace", "Músculos", "Errores frecuentes", "Consejos", "Seguridad", "Variantes", "Alternativas",
] as const;

export type LibraryExercise = {
  id: string;
  slug: string | null;
  name: string;
  altNames: string[];
  /** Grupos del filtro: primero los del músculo principal. */
  groups: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  modalities: string[];
  pattern: string | null;
  level: number | null;
  image: string | null;
  video: string | null;
  description: string | null;
  instructions: string[];
  mistakes: string[];
  tips: string[];
  safety: string[];
  source: string;
  license: string | null;
  licenseAuthor: string | null;
  sourceUrl: string | null;
};

export type LibraryFilters = {
  query: string;
  groups: string[];
  equipment: string[];
  modalities: string[];
};

export const EMPTY_FILTERS: LibraryFilters = { query: "", groups: [], equipment: [], modalities: [] };

/** Igual que `public.exercise_name_key` en SQL: minúsculas, sin acentos ni signos. */
export const nameKey = (value: string | null | undefined): string =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Ejercicios que aún no tienen músculos enlazados: su `muscle_group` antiguo da el grupo del filtro. */
const LEGACY_GROUPS: Record<string, string[]> = {
  Pecho: ["Pecho"], Serrato: ["Pecho"],
  Espalda: ["Espalda"], Trapecios: ["Espalda"], Romboides: ["Espalda"], Lumbares: ["Espalda"],
  Hombros: ["Hombros"], Bíceps: ["Bíceps"], Tríceps: ["Tríceps"], Antebrazos: ["Antebrazos"],
  Core: ["Abdomen"], Abdomen: ["Abdomen"],
  Piernas: ["Cuádriceps"], Cuádriceps: ["Cuádriceps"], Aductores: ["Cuádriceps"],
  Isquiotibiales: ["Isquiotibiales"], Glúteos: ["Glúteos"], Abductores: ["Glúteos"], Gemelos: ["Gemelos"],
  "Cuerpo completo": ["Cuerpo completo"], Cardio: ["Cuerpo completo"],
};
export const legacyGroups = (muscleGroup: string | null | undefined): string[] =>
  (muscleGroup && LEGACY_GROUPS[muscleGroup]) || [];

const LEGACY_MODALITIES: Record<string, string[]> = {
  Gimnasio: ["Gimnasio"], Calistenia: ["Calistenia"], Mixto: ["Entrenamiento híbrido"],
};
export const legacyModalities = (exerciseType: string | null | undefined): string[] =>
  (exerciseType && LEGACY_MODALITIES[exerciseType]) || [];

/** Distancia de edición ≤ 1 (una letra cambiada, de más o de menos). */
const withinOneEdit = (a: string, b: string): boolean => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};

/** «sentadila» encuentra «sentadilla»: el principio de la palabra con una errata como mucho (desde 4 letras). */
const fuzzyPrefix = (token: string, word: string): boolean =>
  word.startsWith(token) ||
  (token.length >= 4 && [-1, 0, 1].some((d) => withinOneEdit(token, word.slice(0, token.length + d))));

/** 0 = no coincide; más alto = mejor coincidencia. */
export const matchScore = (exercise: LibraryExercise, query: string): number => {
  const q = nameKey(query);
  if (!q) return 1;
  const tokens = q.split(" ");
  let best = 0;
  for (const label of [exercise.name, ...exercise.altNames]) {
    const key = nameKey(label);
    const words = key.split(" ");
    if (key.startsWith(q)) { best = Math.max(best, 4); continue; }
    const all = tokens.every((t) => words.some((w) => w.startsWith(t)));
    if (all) { best = Math.max(best, 3); continue; }
    if (key.includes(q)) { best = Math.max(best, 2); continue; }
    if (tokens.every((t) => words.some((w) => fuzzyPrefix(t, w)))) best = Math.max(best, 1);
  }
  return best;
};

export const isFullBody = (exercise: LibraryExercise): boolean =>
  exercise.groups.includes("Cuerpo completo") ||
  new Set(exercise.groups).size >= 3;

const matchesFacet = (values: string[], selected: string[]) =>
  selected.length === 0 || selected.some((s) => values.includes(s));

/** Filtros combinables: Y entre facetas, O dentro de cada faceta. Con texto, ordena por relevancia. */
export function filterLibrary(items: LibraryExercise[], filters: LibraryFilters): LibraryExercise[] {
  const groups = filters.groups.filter((g) => g !== "Cuerpo completo");
  const wantsFullBody = filters.groups.includes("Cuerpo completo");
  const scored: { item: LibraryExercise; score: number }[] = [];
  for (const item of items) {
    const groupOk = filters.groups.length === 0
      || (groups.length > 0 && matchesFacet(item.groups, groups))
      || (wantsFullBody && isFullBody(item));
    if (!groupOk) continue;
    if (!matchesFacet(item.equipment, filters.equipment)) continue;
    if (!matchesFacet(item.modalities, filters.modalities)) continue;
    const score = matchScore(item, filters.query);
    if (score > 0) scored.push({ item, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "es"))
    .map((s) => s.item);
}

export const activeFilterCount = (f: LibraryFilters) => f.groups.length + f.equipment.length + f.modalities.length;

/** Parecidos: mismo grupo principal, mismo patrón y equipo compartido, en ese orden de peso. */
export function similarExercises(target: LibraryExercise, items: LibraryExercise[], limit = 6): LibraryExercise[] {
  const mainGroup = target.groups[0];
  return items
    .filter((e) => e.id !== target.id)
    .map((e) => ({
      e,
      score: (mainGroup && e.groups[0] === mainGroup ? 3 : e.groups.some((g) => target.groups.includes(g)) ? 1 : 0)
        + (target.pattern && e.pattern === target.pattern ? 2 : 0)
        + (e.equipment.some((q) => target.equipment.includes(q)) ? 1 : 0),
    }))
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, "es"))
    .slice(0, limit)
    .map((x) => x.e);
}

/** Línea corta bajo el nombre: músculo principal · equipo. */
export const subtitle = (e: LibraryExercise): string =>
  [e.primaryMuscles[0] ?? e.groups[0], e.equipment[0]].filter(Boolean).join(" · ");

/** Texto de atribución obligatorio para fichas de terceros (CC BY-SA). */
/** Solo las licencias que exigen citar al autor en la ficha (CC BY / BY-SA); lo demás se ve como de Autopilot. */
export const attribution = (e: LibraryExercise): string | null => {
  if (e.source === "autopilot" || !/^CC BY/i.test(e.license ?? "")) return null;
  const source = e.source === "wger" ? "wger.de" : e.source;
  return [`Fuente: ${source}`, e.licenseAuthor, e.license].filter(Boolean).join(" · ");
};
