/**
 * Catálogo base de la biblioteca: los DATOS (MIT) de github.com/hasaneyldrm/exercises-dataset,
 * fijados a un commit. Nunca sus imágenes ni GIF (© Gym visual, sin licencia nuestra): el visual
 * de cada ejercicio es propio de Autopilot. Puro y sin Deno, para usarlo en la función y en los tests.
 */

export const DATASET = {
  repo: "https://github.com/hasaneyldrm/exercises-dataset",
  commit: "7455efae41b330c265e7cd4b78dfa848e7ce5ebd",
  source: "exercises-dataset",
  license: "MIT",
  author: "Hasan Emir Yıldırım",
} as const;
export const DATASET_URL = `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${DATASET.commit}/data/exercises.json`;

export type DatasetRow = {
  id: string;
  name: string;
  body_part?: string | null;
  equipment?: string | null;
  target?: string | null;
  secondary_muscles?: string[] | null;
  instruction_steps?: { es?: string[] | null } | null;
};

export type CatalogDraft = {
  source_ref: string;
  name: string;
  alt_names: string[];
  instructions: string[];
  muscle_group: string | null;
  exercise_type: string;
  primary: string[];
  secondary: string[];
  equipment: string[];
  modalities: string[];
};

/** Igual que `public.exercise_name_key` (SQL) y `nameKey` de la web. */
export const catalogNameKey = (name: string | null | undefined) =>
  (name ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();

/** Variantes que son el mismo ejercicio: «(male)», «v. 2», «(back pov)»… */
const VARIANT = /\((?:male|female|back pov|side pov|version \d+)\)|\bv\. ?\d+\b/gi;
export const cleanName = (name: string) => name.replace(VARIANT, "").replace(/\s+/g, " ").trim();
export const datasetKey = (name: string) => catalogNameKey(cleanName(name).replace(/-/g, " "));
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TARGET: Record<string, string[]> = {
  abs: ["recto-abdominal"], pectorals: ["pectoral"], biceps: ["biceps"], glutes: ["gluteo-mayor"],
  triceps: ["triceps"], "upper back": ["romboides"], lats: ["dorsal"], calves: ["gemelos"],
  quads: ["cuadriceps"], forearms: ["antebrazo"], hamstrings: ["isquiotibiales"], spine: ["erectores"],
  traps: ["trapecio"], adductors: ["aductores"], "serratus anterior": ["serrato"], abductors: ["gluteo-medio"],
  "levator scapulae": ["cuello"], "cardiovascular system": [],
};
const SECONDARY: Record<string, string> = {
  shoulders: "deltoides-anterior", deltoids: "deltoides-anterior", "rear deltoids": "deltoides-posterior",
  hamstrings: "isquiotibiales", forearms: "antebrazo", wrists: "antebrazo", "wrist flexors": "antebrazo",
  "wrist extensors": "antebrazo", "grip muscles": "antebrazo", hands: "antebrazo", triceps: "triceps",
  biceps: "biceps", brachialis: "braquial", quadriceps: "cuadriceps", calves: "gemelos", soleus: "soleo",
  glutes: "gluteo-mayor", core: "recto-abdominal", abdominals: "recto-abdominal", "lower abs": "recto-abdominal",
  obliques: "oblicuos", "hip flexors": "flexores-cadera", chest: "pectoral", "upper chest": "pectoral",
  "lower back": "erectores", rhomboids: "romboides", "upper back": "romboides", trapezius: "trapecio",
  traps: "trapecio", back: "dorsal", lats: "dorsal", "latissimus dorsi": "dorsal",
  "rotator cuff": "manguito-rotador", sternocleidomastoid: "cuello", groin: "aductores", "inner thighs": "aductores",
};
/** Grupo de siempre (columna `muscle_group`) para que lo antiguo siga funcionando. */
const LEGACY_GROUP: Record<string, string> = {
  abs: "Core", pectorals: "Pecho", biceps: "Bíceps", glutes: "Glúteos", delts: "Hombros", triceps: "Tríceps",
  "upper back": "Espalda", lats: "Espalda", calves: "Gemelos", quads: "Piernas", forearms: "Antebrazos",
  "cardiovascular system": "Cardio", hamstrings: "Isquiotibiales", spine: "Lumbares", traps: "Trapecios",
  adductors: "Aductores", "serratus anterior": "Serrato", abductors: "Abductores", "levator scapulae": "Cuello",
};

const deltHead = (name: string) =>
  /rear|reverse fly|face pull|bent.?over.*(raise|fly)/i.test(name) ? "deltoides-posterior"
    : /lateral|side raise|upright row/i.test(name) ? "deltoides-lateral" : "deltoides-anterior";

export function mapMuscles(row: DatasetRow) {
  const target = (row.target ?? "").toLowerCase();
  const primary = target === "delts" ? [deltHead(row.name)] : (TARGET[target] ?? []);
  const secondary = [...new Set((row.secondary_muscles ?? [])
    .map((m) => SECONDARY[m.toLowerCase()])
    .filter((m): m is string => !!m && !primary.includes(m)))];
  return { primary, secondary };
}

const CALISTHENICS = /pull.?up|chin.?up|push.?up|\bdips?\b|lever|planche|muscle.?up|handstand|pistol|l.?sit|dragon flag|human flag|hanging|inverted row|pike/i;

export function mapEquipment(row: DatasetRow): string[] {
  const eq = (row.equipment ?? "").toLowerCase();
  const name = row.name;
  const out = new Set<string>();
  if (eq === "body weight") out.add("Peso corporal");
  else if (eq === "dumbbell") out.add("Mancuernas");
  else if (["barbell", "ez barbell", "olympic barbell", "trap bar"].includes(eq)) out.add("Barra");
  else if (eq === "cable" || (eq === "rope" && /cable/i.test(name))) out.add("Poleas");
  else if (eq === "kettlebell") out.add("Kettlebell");
  else if (eq === "band" || eq === "resistance band") out.add("Bandas elásticas");
  else if (/machine|assisted|ergometer|stationary bike/.test(eq)) out.add("Máquinas");
  else if (eq) out.add("Otros");
  if (["body weight", "weighted", "assisted"].includes(eq)) {
    if (/pull.?up|chin.?up|hanging|muscle.?up|lever/i.test(name)) out.add("Barra de dominadas");
    if (/\bdips?\b|parallel bars/i.test(name)) out.add("Paralelas");
    if (/\brings?\b/i.test(name)) out.add("Anillas");
  }
  return [...out];
}

export function mapModalities(row: DatasetRow): string[] {
  const eq = (row.equipment ?? "").toLowerCase();
  const name = row.name;
  if (/stretch/i.test(name)) return ["Movilidad"];
  if ((row.body_part ?? "").toLowerCase() === "cardio") return ["Entrenamiento funcional"];
  const out = new Set<string>();
  if (/kettlebell|medicine ball|sled|tire|hammer/.test(eq) || (eq === "rope" && !/cable/i.test(name))
    || /burpee|swing|clean|snatch|thruster|farmer|carry|battle/i.test(name)) out.add("Entrenamiento funcional");
  if (["body weight", "weighted"].includes(eq) || (eq === "assisted" && CALISTHENICS.test(name))) out.add("Calistenia");
  else if (eq && !out.size) out.add("Gimnasio");
  return [...out];
}

const legacyType = (modalities: string[]) =>
  modalities.length === 1 && modalities[0] === "Calistenia" ? "Calistenia"
    : modalities.length === 1 && modalities[0] === "Gimnasio" ? "Gimnasio" : "Mixto";

export function toDraft(row: DatasetRow): CatalogDraft {
  const { primary, secondary } = mapMuscles(row);
  const modalities = mapModalities(row);
  const name = sentence(cleanName(row.name));
  return {
    source_ref: row.id,
    name,
    alt_names: [],
    instructions: (row.instruction_steps?.es ?? []).map((s) => s.trim()).filter(Boolean),
    muscle_group: LEGACY_GROUP[(row.target ?? "").toLowerCase()] ?? null,
    exercise_type: legacyType(modalities),
    primary,
    secondary,
    equipment: mapEquipment(row),
    modalities,
  };
}

export type ImportPlan = {
  drafts: CatalogDraft[];
  total: number;
  variants: number;
  alreadyImported: number;
  nameTaken: string[];
};

/**
 * Qué entra: una ficha por ejercicio (las variantes «v. 2», «(male)»… cuentan como uno), nada que ya
 * se importara (por `source_ref`) y nada cuyo nombre ya exista en la biblioteca.
 */
export function planImport(rows: DatasetRow[], existing: { refs: Iterable<string>; names: Iterable<string> }): ImportPlan {
  const refs = new Set(existing.refs);
  const names = new Set([...existing.names].map(catalogNameKey));
  const groups = new Map<string, DatasetRow[]>();
  for (const row of [...rows].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = datasetKey(row.name);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const plan: ImportPlan = { drafts: [], total: rows.length, variants: rows.length - groups.size, alreadyImported: 0, nameTaken: [] };
  for (const group of groups.values()) {
    if (group.some((r) => refs.has(r.id))) { plan.alreadyImported++; continue; }
    const pick = group.find((r) => cleanName(r.name) === r.name) ?? group[0];
    const draft = toDraft(pick);
    const key = catalogNameKey(draft.name);
    if (names.has(key)) { plan.nameTaken.push(draft.name); continue; }
    names.add(key);
    plan.drafts.push(draft);
  }
  return plan;
}

/** Coste aproximado de redactar N fichas con google/gemini-2.5-flash (precios de GET /v1/models). */
export const DRAFT_CREDITS_PER_EXERCISE = 0.0075;
export const draftCredits = (count: number) => Math.ceil(count * DRAFT_CREDITS_PER_EXERCISE * 10) / 10;
