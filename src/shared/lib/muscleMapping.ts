// Maps exercise data to the exact regions drawn on the muscle map.
// Primary muscle counts 1 per set; synergists count 0.5 per set.

const ALIASES: Record<string, string> = {
  pecho: "Pecho", pectoral: "Pecho", pectorales: "Pecho", chest: "Pecho",
  espalda: "Espalda", dorsal: "Espalda", dorsales: "Espalda", lats: "Espalda", back: "Espalda",
  hombro: "Hombros", hombros: "Hombros", deltoides: "Hombros", deltoide: "Hombros", shoulders: "Hombros",
  biceps: "Bíceps", tricep: "Tríceps", triceps: "Tríceps",
  piernas: "Piernas", pierna: "Piernas", cuadriceps: "Piernas", quads: "Piernas",
  gluteo: "Glúteos", gluteos: "Glúteos", glutes: "Glúteos",
  core: "Core", abdomen: "Core", abdominales: "Core", abs: "Core", oblicuos: "Core",
  isquiotibiales: "Isquiotibiales", isquios: "Isquiotibiales", femorales: "Isquiotibiales", femoral: "Isquiotibiales",
  gemelos: "Gemelos", gemelo: "Gemelos", pantorrillas: "Gemelos", soleo: "Gemelos",
  antebrazos: "Antebrazos", antebrazo: "Antebrazos",
  trapecio: "Trapecios", trapecios: "Trapecios", romboides: "Romboides",
  lumbares: "Lumbares", lumbar: "Lumbares", serrato: "Serrato",
  aductores: "Aductores", abductores: "Abductores", cuello: "Cuello",
};

const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function normalizeMuscle(raw?: string | null): string[] {
  if (!raw) return [];
  const key = strip(raw);
  if (key === "cuerpo completo" || key === "full body") return ["Pecho", "Espalda", "Hombros", "Piernas", "Glúteos", "Core"];
  if (ALIASES[key]) return [ALIASES[key]];
  // compound labels like "Pecho y tríceps" or "Espalda · Bíceps"
  return [...new Set(key.split(/[\s,·/+y-]+/).map((p) => ALIASES[p]).filter(Boolean))];
}

// Biomechanical synergists by exercise name.
const RULES: { test: RegExp; primary?: string[]; synergists: string[] }[] = [
  { test: /press.*(banca|inclinad|declinad|pecho)|bench|flexion|push.?up|fondos.*pecho|aperturas/, primary: ["Pecho"], synergists: ["Tríceps", "Hombros"] },
  { test: /fondos|dips/, primary: ["Tríceps"], synergists: ["Pecho", "Hombros"] },
  { test: /press.*(militar|hombro|arnold)|overhead|pike|handstand|pino/, primary: ["Hombros"], synergists: ["Tríceps", "Trapecios"] },
  { test: /elevacion.*lateral|pajaro|face.?pull/, primary: ["Hombros"], synergists: ["Trapecios"] },
  { test: /dominada|pull.?up|chin|jalon|lat.?pull/, primary: ["Espalda"], synergists: ["Bíceps", "Antebrazos", "Romboides"] },
  { test: /remo|row/, primary: ["Espalda"], synergists: ["Romboides", "Bíceps", "Trapecios"] },
  { test: /peso muerto rumano|rumano|rdl|buenos dias|good morning|curl femoral|leg curl|nordic/, primary: ["Isquiotibiales"], synergists: ["Glúteos", "Lumbares"] },
  { test: /peso muerto|deadlift/, primary: ["Isquiotibiales"], synergists: ["Glúteos", "Lumbares", "Espalda", "Trapecios", "Antebrazos"] },
  { test: /hip.?thrust|puente.*glut|patada.*glut/, primary: ["Glúteos"], synergists: ["Isquiotibiales"] },
  { test: /sentadilla|squat|prensa|zancada|lunge|bulgara|step.?up|pistol/, primary: ["Piernas"], synergists: ["Glúteos", "Aductores", "Core"] },
  { test: /extension.*(cuadriceps|pierna)|leg extension/, primary: ["Piernas"], synergists: [] },
  { test: /gemelo|calf|pantorrilla/, primary: ["Gemelos"], synergists: [] },
  { test: /curl/, primary: ["Bíceps"], synergists: ["Antebrazos"] },
  { test: /extension.*tricep|press frances|skull|patada.*tricep|pushdown/, primary: ["Tríceps"], synergists: [] },
  { test: /encogimiento|shrug/, primary: ["Trapecios"], synergists: [] },
  { test: /plancha|plank|crunch|rueda|ab.?wheel|elevacion.*pierna|hollow|l.?sit|dragon/, primary: ["Core"], synergists: [] },
];

export function musclesForExercise(name: string, muscleGroup?: string | null): { primary: string[]; synergists: string[] } {
  const n = strip(name);
  const rule = RULES.find((r) => r.test.test(n));
  const fromGroup = normalizeMuscle(muscleGroup);
  const primary = fromGroup.length ? fromGroup : rule?.primary || [];
  const synergists = (rule?.synergists || []).filter((m) => !primary.includes(m));
  return { primary, synergists };
}

export function addExerciseLoad(counts: Record<string, number>, name: string, muscleGroup: string | null | undefined, sets: number) {
  const { primary, synergists } = musclesForExercise(name, muscleGroup);
  for (const m of primary) counts[m] = (counts[m] || 0) + sets;
  for (const m of synergists) counts[m] = (counts[m] || 0) + sets * 0.5;
}

// Fun, honest tonnage equivalences (approximate real masses).
const EQUIVALENCES: { kg: number; label: string; emoji: string }[] = [
  { kg: 6000, label: "un elefante africano", emoji: "🐘" },
  { kg: 3000, label: "un hipopótamo", emoji: "🦛" },
  { kg: 2300, label: "un rinoceronte", emoji: "🦏" },
  { kg: 1500, label: "un coche", emoji: "🚗" },
  { kg: 700, label: "un oso polar", emoji: "🐻‍❄️" },
  { kg: 450, label: "un piano de cola", emoji: "🎹" },
  { kg: 200, label: "un león", emoji: "🦁" },
  { kg: 0, label: "una moto", emoji: "🏍️" },
];

export function tonnageEquivalence(kg: number): { text: string; emoji: string } | null {
  if (kg <= 0) return null;
  const big = EQUIVALENCES.find((e) => e.kg > 0 && kg >= e.kg);
  if (big) {
    const times = kg / big.kg;
    const count = times >= 2 ? `${Math.floor(times)} veces ` : "";
    return { text: `Como levantar ${count}${big.label}`, emoji: big.emoji };
  }
  return { text: `Como levantar ${Math.max(1, Math.round(kg / 150))} motos`, emoji: "🏍️" };
}
