import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ───

interface ExerciseRow {
  id: string; name: string; image_url: string | null;
  muscle_group: string | null; exercise_type: string | null;
  movement_pattern: string | null; level: number | null;
  priority: number | null; stimulus_type: string | null;
  load_level: string | null; fatigue_level: string | null;
  recommended_order: number | null;
  skill_tag: string | null; progression_order: number | null;
}

interface PickedExercise {
  exercise_id: string;
  name: string;
  series: number;
  reps: string;
  weight: string;
  rest: string;
  image_url?: string;
  movement_pattern?: string;
  priority?: number;
  fatigue_level?: string;
}

interface UserConfig {
  userLevel: number;
  goal: string;
  exerciseType: string; // Gimnasio | Calistenia | Mixto
  intensityLevel: number;
  specificGoal: string;
}

interface Rules {
  min_sets_per_session: number;
  max_sets_per_session: number;
  series_p1_min: number; series_p1_max: number;
  series_p2_min: number; series_p2_max: number;
  series_p3_min: number; series_p3_max: number;
  reps_fuerza: string; reps_hipertrofia: string;
  reps_resistencia: string; reps_isometrico: string;
  rest_fuerza: string; rest_hipertrofia: string;
  rest_resistencia: string; rest_isometrico: string;
  max_consecutive_high_fatigue: number;
  max_heavy_hinges: number;
  max_pattern_repeats: number;
  push_pull_max_diff: number;
  max_p2_exercises: number;
  max_p3_exercises: number;
  required_patterns: string[];
  recovery_hours: Record<string, number>;
}

const DEFAULT_RULES: Rules = {
  min_sets_per_session: 12, max_sets_per_session: 20,
  series_p1_min: 3, series_p1_max: 5,
  series_p2_min: 3, series_p2_max: 4,
  series_p3_min: 2, series_p3_max: 3,
  reps_fuerza: "4-8", reps_hipertrofia: "8-15", reps_resistencia: "15-25", reps_isometrico: "20-60s",
  rest_fuerza: "180s", rest_hipertrofia: "90s", rest_resistencia: "45s", rest_isometrico: "60s",
  max_consecutive_high_fatigue: 2, max_heavy_hinges: 1, max_pattern_repeats: 2, push_pull_max_diff: 1,
  max_p2_exercises: 2, max_p3_exercises: 2,
  required_patterns: ["Empuje", "Tirón", "Sentadilla", "Bisagra", "Core"],
  recovery_hours: { Pecho: 48, Espalda: 48, Hombros: 48, Bíceps: 36, Tríceps: 36, Piernas: 72, Glúteos: 48, Core: 24, "Cuerpo completo": 48, Cardio: 24 },
};

// ─── Specific goal → muscle/pattern boosts ───

interface SkillProfile {
  priorityMuscles: string[];
  priorityPatterns: string[];
  extraExercises: number;
  stimulus: string;
  skillTag: string; // matches skill_tag in exercises table
}

function getSkillProfile(specificGoal: string): SkillProfile | null {
  if (!specificGoal) return null;
  const g = specificGoal.toLowerCase();

  if (g.includes("handstand") || g.includes("pino")) {
    return { priorityMuscles: ["Hombros", "Core", "Tríceps"], priorityPatterns: ["Empuje", "Core"], extraExercises: 1, stimulus: "Fuerza", skillTag: "handstand" };
  }
  if (g.includes("muscle up") || g.includes("muscle-up")) {
    return { priorityMuscles: ["Espalda", "Pecho", "Bíceps", "Core"], priorityPatterns: ["Tirón", "Empuje"], extraExercises: 1, stimulus: "Fuerza", skillTag: "muscle_up" };
  }
  if (g.includes("planche")) {
    return { priorityMuscles: ["Hombros", "Pecho", "Core", "Tríceps"], priorityPatterns: ["Empuje", "Core"], extraExercises: 1, stimulus: "Fuerza", skillTag: "planche" };
  }
  if (g.includes("front lever")) {
    return { priorityMuscles: ["Espalda", "Core", "Bíceps"], priorityPatterns: ["Tirón", "Core"], extraExercises: 1, stimulus: "Fuerza", skillTag: "front_lever" };
  }
  if (g.includes("back lever")) {
    return { priorityMuscles: ["Espalda", "Hombros", "Core"], priorityPatterns: ["Tirón", "Core"], extraExercises: 1, stimulus: "Fuerza", skillTag: "back_lever" };
  }
  if (g.includes("human flag") || g.includes("bandera")) {
    return { priorityMuscles: ["Core", "Hombros", "Espalda"], priorityPatterns: ["Core", "Tirón"], extraExercises: 1, stimulus: "Fuerza", skillTag: "human_flag" };
  }
  if (g.includes("pistol squat") || g.includes("sentadilla a una pierna")) {
    return { priorityMuscles: ["Piernas", "Glúteos", "Core"], priorityPatterns: ["Sentadilla", "Core"], extraExercises: 1, stimulus: "Fuerza", skillTag: "pistol_squat" };
  }
  if (g.includes("press banca") || g.includes("bench press")) {
    return { priorityMuscles: ["Pecho", "Tríceps", "Hombros"], priorityPatterns: ["Empuje"], extraExercises: 1, stimulus: "Fuerza", skillTag: "press_banca" };
  }
  if (g.includes("sentadilla") || g.includes("squat")) {
    return { priorityMuscles: ["Piernas", "Glúteos", "Core"], priorityPatterns: ["Sentadilla", "Bisagra"], extraExercises: 1, stimulus: "Fuerza", skillTag: "sentadilla" };
  }
  if (g.includes("peso muerto") || g.includes("deadlift")) {
    return { priorityMuscles: ["Espalda", "Piernas", "Glúteos"], priorityPatterns: ["Bisagra", "Tirón"], extraExercises: 1, stimulus: "Fuerza", skillTag: "peso_muerto" };
  }
  if (g.includes("press militar") || g.includes("overhead press")) {
    return { priorityMuscles: ["Hombros", "Tríceps", "Core"], priorityPatterns: ["Empuje"], extraExercises: 1, stimulus: "Fuerza", skillTag: "press_militar" };
  }
  if (g.includes("dominadas") || g.includes("pull up") || g.includes("pull-up")) {
    return { priorityMuscles: ["Espalda", "Bíceps", "Core"], priorityPatterns: ["Tirón"], extraExercises: 1, stimulus: "Fuerza", skillTag: "dominadas" };
  }
  if (g.includes("l-sit") || g.includes("l sit")) {
    return { priorityMuscles: ["Core", "Hombros", "Tríceps"], priorityPatterns: ["Core", "Empuje"], extraExercises: 1, stimulus: "Fuerza", skillTag: "l_sit" };
  }

  return null;
}

// ─── Rep/series scheme using dynamic rules ───

function getRepScheme(stimulus: string | null, priority: number, rules: Rules): { series: number; reps: string; rest: string } {
  let seriesRange: [number, number];
  switch (priority) {
    case 1: seriesRange = [rules.series_p1_min, rules.series_p1_max]; break;
    case 2: seriesRange = [rules.series_p2_min, rules.series_p2_max]; break;
    case 3: seriesRange = [rules.series_p3_min, rules.series_p3_max]; break;
    default: seriesRange = [rules.series_p2_min, rules.series_p2_max];
  }

  let reps: string;
  let rest: string;
  switch (stimulus) {
    case "Fuerza": reps = rules.reps_fuerza; rest = rules.rest_fuerza; break;
    case "Hipertrofia": reps = rules.reps_hipertrofia; rest = rules.rest_hipertrofia; break;
    case "Resistencia": reps = rules.reps_resistencia; rest = rules.rest_resistencia; break;
    case "Isométrico": reps = rules.reps_isometrico; rest = rules.rest_isometrico; break;
    default: reps = rules.reps_hipertrofia; rest = rules.rest_hipertrofia;
  }

  const series = priority === 1 ? seriesRange[1] : seriesRange[0];
  return { series, reps, rest };
}

// ─── Smart exercise picker ───

function pickExercisesForSession(
  targetMuscles: string[],
  exerciseLib: Record<string, ExerciseRow[]>,
  config: UserConfig,
  rules: Rules,
  skillProfile: SkillProfile | null,
): PickedExercise[] {
  const { userLevel, goal, exerciseType } = config;

  // Boost target muscles with skill-specific muscles
  const boostedMuscles = [...targetMuscles];
  if (skillProfile) {
    for (const m of skillProfile.priorityMuscles) {
      if (!boostedMuscles.includes(m)) boostedMuscles.push(m);
    }
  }

  const allAvailable: ExerciseRow[] = [];
  for (const muscle of boostedMuscles) {
    const muscleExercises = exerciseLib[muscle] || [];
    for (const ex of muscleExercises) {
      // Equipment type filtering: strict enforcement
      if (exerciseType === "Gimnasio" && ex.exercise_type === "Calistenia") continue;
      if (exerciseType === "Calistenia" && ex.exercise_type === "Gimnasio") continue;
      // Mixto allows everything
      if ((ex.level ?? 1) > userLevel + 1) continue;
      allAvailable.push(ex);
    }
  }

  if (allAvailable.length === 0) {
    console.log(`[GENERATE-PLAN] No exercises available for muscles: ${boostedMuscles.join(", ")} (type: ${exerciseType})`);
    return [];
  }

  const picked: PickedExercise[] = [];
  const usedIds = new Set<string>();
  const patternCounts: Record<string, number> = {};
  let totalSets = 0;
  let consecutiveHighFatigue = 0;
  let heavyHingeCount = 0;

  // Adjust max pattern repeats for skill-priority patterns
  const effectiveMaxPatternRepeats = (pattern: string) => {
    if (skillProfile?.priorityPatterns.includes(pattern)) {
      return rules.max_pattern_repeats + 1; // allow one extra for skill focus
    }
    return rules.max_pattern_repeats;
  };

  function findBest(pattern: string, targetPriority: number): ExerciseRow | null {
    const candidates = allAvailable
      .filter(ex =>
        ex.movement_pattern === pattern &&
        (ex.priority ?? 2) === targetPriority &&
        !usedIds.has(ex.id)
      )
      .sort((a, b) => {
        // Prefer skill-priority muscles
        if (skillProfile) {
          const aSkill = skillProfile.priorityMuscles.includes(a.muscle_group || "") ? 0 : 1;
          const bSkill = skillProfile.priorityMuscles.includes(b.muscle_group || "") ? 0 : 1;
          if (aSkill !== bSkill) return aSkill - bSkill;
        }
        const aLevelDiff = Math.abs((a.level ?? 1) - userLevel);
        const bLevelDiff = Math.abs((b.level ?? 1) - userLevel);
        if (aLevelDiff !== bLevelDiff) return aLevelDiff - bLevelDiff;
        return (a.recommended_order ?? 2) - (b.recommended_order ?? 2);
      });
    return candidates[0] || null;
  }

  function tryAdd(ex: ExerciseRow, forceStimulus?: string): boolean {
    const pattern = ex.movement_pattern || "Otro";
    const fatigue = ex.fatigue_level || "Media";
    const priority = ex.priority ?? 2;

    if ((patternCounts[pattern] || 0) >= effectiveMaxPatternRepeats(pattern)) return false;
    if (pattern === "Bisagra" && ex.load_level === "Alta" && heavyHingeCount >= rules.max_heavy_hinges) return false;

    const pushCount = patternCounts["Empuje"] || 0;
    const pullCount = patternCounts["Tirón"] || 0;
    if (pattern === "Empuje" && pushCount > pullCount + rules.push_pull_max_diff) return false;
    if (pattern === "Tirón" && pullCount > pushCount + rules.push_pull_max_diff) return false;

    const stimulus = forceStimulus || getEffectiveStimulus(ex.stimulus_type, goal, skillProfile);
    const scheme = getRepScheme(stimulus, priority, rules);

    if (totalSets + scheme.series > rules.max_sets_per_session) return false;

    if (fatigue === "Alta") {
      if (consecutiveHighFatigue >= rules.max_consecutive_high_fatigue) return false;
      consecutiveHighFatigue++;
    } else {
      consecutiveHighFatigue = 0;
    }

    picked.push({
      exercise_id: ex.id,
      name: ex.name,
      series: scheme.series,
      reps: scheme.reps,
      weight: "",
      rest: scheme.rest,
      image_url: ex.image_url || undefined,
      movement_pattern: pattern,
      priority,
      fatigue_level: fatigue,
    });

    usedIds.add(ex.id);
    patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
    totalSets += scheme.series;
    if (pattern === "Bisagra" && ex.load_level === "Alta") heavyHingeCount++;

    return true;
  }

  // STEP 1: Mandatory base structure
  for (const pattern of rules.required_patterns) {
    const ex = findBest(pattern, 1);
    if (ex) {
      tryAdd(ex);
    } else {
      const fallback = findBest(pattern, 2);
      if (fallback) tryAdd(fallback);
      else console.log(`[GENERATE-PLAN] Missing base exercise for pattern: ${pattern}`);
    }
  }

  // STEP 1.5: Skill-specific extra exercises from priority patterns
  if (skillProfile) {
    for (const pattern of skillProfile.priorityPatterns) {
      if (totalSets >= rules.max_sets_per_session) break;
      const ex = allAvailable
        .filter(e => e.movement_pattern === pattern && !usedIds.has(e.id) && skillProfile.priorityMuscles.includes(e.muscle_group || ""))
        .sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2))[0];
      if (ex) tryAdd(ex, skillProfile.stimulus);
    }
  }

  // STEP 2: Complements
  const maxP2 = rules.max_p2_exercises + (skillProfile?.extraExercises || 0);
  const p2Candidates = allAvailable
    .filter(ex => (ex.priority ?? 2) === 2 && !usedIds.has(ex.id))
    .sort((a, b) => {
      // Prefer skill muscles
      if (skillProfile) {
        const aSkill = skillProfile.priorityMuscles.includes(a.muscle_group || "") ? 0 : 1;
        const bSkill = skillProfile.priorityMuscles.includes(b.muscle_group || "") ? 0 : 1;
        if (aSkill !== bSkill) return aSkill - bSkill;
      }
      return (a.recommended_order ?? 2) - (b.recommended_order ?? 2);
    });

  let p2Added = 0;
  for (const ex of p2Candidates) {
    if (p2Added >= maxP2 || totalSets >= rules.max_sets_per_session) break;
    if (tryAdd(ex)) p2Added++;
  }

  const p3Candidates = allAvailable
    .filter(ex => (ex.priority ?? 2) === 3 && !usedIds.has(ex.id))
    .sort((a, b) => (a.recommended_order ?? 2) - (b.recommended_order ?? 2));

  let p3Added = 0;
  for (const ex of p3Candidates) {
    if (p3Added >= rules.max_p3_exercises || totalSets >= rules.max_sets_per_session) break;
    if (tryAdd(ex)) p3Added++;
  }

  // STEP 3: Fill to minimum volume
  if (totalSets < rules.min_sets_per_session) {
    const remaining = allAvailable
      .filter(ex => !usedIds.has(ex.id))
      .sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
    for (const ex of remaining) {
      if (totalSets >= rules.min_sets_per_session) break;
      tryAdd(ex);
    }
  }

  // STEP 3.5: Garantizar mínimo de ejercicios (al menos 4 por sesión).
  // Si las reglas estrictas dejaron pocos, rellenamos sin restricciones.
  const MIN_EXERCISES = 4;
  if (picked.length < MIN_EXERCISES) {
    const remaining = allAvailable
      .filter(ex => !usedIds.has(ex.id))
      .sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
    for (const ex of remaining) {
      if (picked.length >= MIN_EXERCISES) break;
      const stimulus = getEffectiveStimulus(ex.stimulus_type, goal, skillProfile);
      const scheme = getRepScheme(stimulus, ex.priority ?? 2, rules);
      picked.push({
        exercise_id: ex.id,
        name: ex.name,
        series: scheme.series,
        reps: scheme.reps,
        weight: "",
        rest: scheme.rest,
        image_url: ex.image_url || undefined,
        movement_pattern: ex.movement_pattern || "Otro",
        priority: ex.priority ?? 2,
        fatigue_level: ex.fatigue_level || "Media",
      });
      usedIds.add(ex.id);
    }
  }

  // STEP 3.6: Si AÚN no hay ejercicios (muscle library casi vacía),
  // tomar cualquier cosa de la lib filtrada por equipamiento.
  if (picked.length === 0) {
    console.log(`[GENERATE-PLAN] FALLBACK: no exercises matched. Using any available.`);
    const fallback = Object.values(exerciseLib).flat()
      .filter(ex => {
        if (exerciseType === "Gimnasio" && ex.exercise_type === "Calistenia") return false;
        if (exerciseType === "Calistenia" && ex.exercise_type === "Gimnasio") return false;
        return true;
      })
      .slice(0, MIN_EXERCISES);
    for (const ex of fallback) {
      const scheme = getRepScheme("Hipertrofia", 2, rules);
      picked.push({
        exercise_id: ex.id,
        name: ex.name,
        series: scheme.series,
        reps: scheme.reps,
        weight: "",
        rest: scheme.rest,
        image_url: ex.image_url || undefined,
        movement_pattern: ex.movement_pattern || "Otro",
        priority: 2,
        fatigue_level: ex.fatigue_level || "Media",
      });
    }
  }

  // STEP 4: Sort
  picked.sort((a, b) => {
    const orderA = getOrder(a, allAvailable);
    const orderB = getOrder(b, allAvailable);
    if (orderA !== orderB) return orderA - orderB;
    if ((a.priority ?? 2) !== (b.priority ?? 2)) return (a.priority ?? 2) - (b.priority ?? 2);
    const fatigueOrder: Record<string, number> = { Baja: 1, Media: 2, Alta: 3 };
    return (fatigueOrder[a.fatigue_level || "Media"] || 2) - (fatigueOrder[b.fatigue_level || "Media"] || 2);
  });

  const final = enforceConsecutiveFatigueRule(picked, rules.max_consecutive_high_fatigue);

  console.log(`[GENERATE-PLAN] Session: ${final.length} exercises, ${totalSets} total sets`);
  return final;
}

function getOrder(ex: PickedExercise, lib: ExerciseRow[]): number {
  const found = lib.find(e => e.id === ex.exercise_id);
  return found?.recommended_order ?? 2;
}

function enforceConsecutiveFatigueRule(exercises: PickedExercise[], maxConsecutive: number): PickedExercise[] {
  const result = [...exercises];
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;
    for (let i = maxConsecutive; i < result.length; i++) {
      const allHigh = Array.from({ length: maxConsecutive + 1 }, (_, k) => result[i - k]?.fatigue_level === "Alta").every(Boolean);
      if (allHigh) {
        for (let j = i + 1; j < result.length; j++) {
          if (result[j].fatigue_level !== "Alta") {
            [result[i], result[j]] = [result[j], result[i]];
            changed = true;
            break;
          }
        }
      }
    }
  }
  return result;
}

function getEffectiveStimulus(exerciseStimulus: string | null, goal: string, skillProfile: SkillProfile | null): string {
  if (exerciseStimulus) return exerciseStimulus;
  // If user has a skill goal, bias towards strength for compound movements
  if (skillProfile) return skillProfile.stimulus;
  switch (goal) {
    case "gain_muscle": return "Hipertrofia";
    case "lose_weight": return "Resistencia";
    case "recomp": return "Hipertrofia";
    case "improve_endurance": return "Resistencia";
    case "skill_based": return "Fuerza";
    default: return "Hipertrofia";
  }
}

// ─── Nutrition helpers ───

type DietType = "estandar" | "paleo" | "keto" | "vegana" | "vegetariana" | "mediterranea" | "sin_gluten" | "sin_lactosa";

function detectDiet(prefs: string | null | undefined): DietType {
  if (!prefs) return "estandar";
  const p = prefs.toLowerCase();
  if (p.includes("keto") || p.includes("cetog")) return "keto";
  if (p.includes("paleo")) return "paleo";
  if (p.includes("vegan") && !p.includes("vegetar")) return "vegana";
  if (p.includes("vegetar") || p.includes("ovolac")) return "vegetariana";
  if (p.includes("mediterr")) return "mediterranea";
  if (p.includes("sin gluten") || p.includes("celiac")) return "sin_gluten";
  if (p.includes("sin lactosa") || p.includes("intoler")) return "sin_lactosa";
  return "estandar";
}

// Macros adaptados a goal Y dieta (keto recorta carbs, vegana ajusta proteína, etc.)
function calcMacros(weight: number, goal: string, diet: DietType) {
  // Base por goal (gr/kg)
  let p = 1.8, c = 3.5, f = 1.0;
  switch (goal) {
    case "gain_muscle":      p = 2.2; c = 4.0; f = 1.0; break;
    case "lose_weight":      p = 2.4; c = 2.0; f = 0.8; break;
    case "recomp":           p = 2.2; c = 3.0; f = 0.9; break;
    case "improve_endurance":p = 1.8; c = 4.5; f = 0.9; break;
    case "skill_based":      p = 2.0; c = 3.5; f = 1.0; break;
  }
  // Ajuste por dieta
  switch (diet) {
    case "keto":
      // Muy bajo en carbs, grasa alta, proteína moderada
      c = 0.5; f = Math.max(f * 2.2, 1.8); p = Math.max(p, 2.0); break;
    case "paleo":
      // Sin azúcares ni cereales: menos carbs, más grasas saludables
      c = c * 0.7; f = f * 1.3; break;
    case "vegana":
      // Más proteína vegetal compensada y carbs ligeramente más altos
      p = p * 1.1; c = c * 1.1; break;
    case "mediterranea":
      f = f * 1.15; break;
    default: break;
  }
  return {
    protein: Math.round(weight * p),
    carbs:   Math.round(weight * c),
    fats:    Math.round(weight * f),
  };
}

// Banco de comidas por dieta + goal
function getMeals(goal: string, diet: DietType, allergies?: string | null) {
  const a = (allergies || "").toLowerCase();
  const noNuts = a.includes("frutos secos") || a.includes("nuez") || a.includes("almendr");
  const noEggs = a.includes("huevo");
  const noFish = a.includes("pescado") || a.includes("marisco");

  type Meal = { name: string; description: string };

  const banks: Record<DietType, Meal[]> = {
    estandar: [
      { name: "Desayuno", description: "Avena con plátano, frutos rojos y batido de proteínas" },
      { name: "Media mañana", description: "Yogur griego con nueces y miel" },
      { name: "Almuerzo", description: "Pollo a la plancha con arroz integral y verduras salteadas" },
      { name: "Merienda", description: "Tostada integral con aguacate y huevo duro" },
      { name: "Cena", description: "Salmón al horno con patata y ensalada variada" },
    ],
    paleo: [
      { name: "Desayuno", description: "Tortilla de 3 huevos con espinacas, aguacate y arándanos" },
      { name: "Media mañana", description: "Puñado de almendras y manzana" },
      { name: "Almuerzo", description: "Solomillo de ternera con boniato asado y brócoli salteado" },
      { name: "Merienda", description: "Pechuga de pavo natural con zanahoria y nueces" },
      { name: "Cena", description: "Salmón salvaje al horno con calabacín y espárragos" },
    ],
    keto: [
      { name: "Desayuno", description: "Huevos revueltos con bacon, aguacate y queso curado" },
      { name: "Media mañana", description: "Nueces de macadamia y queso brie" },
      { name: "Almuerzo", description: "Entrecot con mantequilla, espinacas a la crema y aguacate" },
      { name: "Merienda", description: "Yogur griego entero con semillas de chía y mantequilla de almendra" },
      { name: "Cena", description: "Salmón con mantequilla de hierbas y ensalada de aguacate y aceitunas" },
    ],
    vegana: [
      { name: "Desayuno", description: "Porridge de avena con leche de soja, plátano y mantequilla de cacahuete" },
      { name: "Media mañana", description: "Hummus con palitos de zanahoria y tortitas de arroz" },
      { name: "Almuerzo", description: "Bowl de quinoa, garbanzos, aguacate, kale y tahini" },
      { name: "Merienda", description: "Batido de proteína vegetal con plátano, avena y frutos rojos" },
      { name: "Cena", description: "Tofu marinado al wok con verduras y arroz integral" },
    ],
    vegetariana: [
      { name: "Desayuno", description: "Tostadas integrales con huevo poché, aguacate y tomate" },
      { name: "Media mañana", description: "Yogur griego con granola y miel" },
      { name: "Almuerzo", description: "Pasta integral con lentejas, espinacas y queso parmesano" },
      { name: "Merienda", description: "Requesón con frutos rojos y nueces" },
      { name: "Cena", description: "Tortilla de patata con ensalada mixta y pan integral" },
    ],
    mediterranea: [
      { name: "Desayuno", description: "Tostada de pan integral con tomate, AOVE y jamón ibérico" },
      { name: "Media mañana", description: "Yogur natural con nueces y miel" },
      { name: "Almuerzo", description: "Lentejas estofadas con verduras y aceite de oliva" },
      { name: "Merienda", description: "Fruta de temporada y un puñado de almendras" },
      { name: "Cena", description: "Pescado al horno con verduras asadas y ensalada" },
    ],
    sin_gluten: [
      { name: "Desayuno", description: "Tortitas de avena sin gluten con plátano y proteína" },
      { name: "Media mañana", description: "Yogur griego con frutos rojos y semillas" },
      { name: "Almuerzo", description: "Pollo con quinoa, aguacate y verduras al vapor" },
      { name: "Merienda", description: "Hummus con crudités y tortitas de arroz" },
      { name: "Cena", description: "Salmón con boniato y ensalada verde" },
    ],
    sin_lactosa: [
      { name: "Desayuno", description: "Avena con bebida de almendra, plátano y proteína vegetal" },
      { name: "Media mañana", description: "Frutos secos y manzana" },
      { name: "Almuerzo", description: "Pollo a la plancha con arroz integral y verduras salteadas" },
      { name: "Merienda", description: "Tostada integral con aguacate y atún" },
      { name: "Cena", description: "Pescado blanco al horno con patata y ensalada" },
    ],
  };

  let meals: Meal[] = [...banks[diet]];

  // Goal extras
  if (goal === "gain_muscle" || goal === "skill_based") {
    const isVegan = diet === "vegana";
    meals.push({
      name: "Pre-entreno",
      description: isVegan
        ? "Plátano con mantequilla de cacahuete y pan integral"
        : "Plátano con mantequilla de cacahuete y pan integral",
    });
    meals.push({
      name: "Post-entreno",
      description: isVegan
        ? "Batido de proteína vegetal con avena, plátano y bebida de soja"
        : "Batido de proteínas con avena y frutos rojos",
    });
  }
  if (goal === "lose_weight") {
    // Cena más ligera adaptada por dieta
    const lighter: Record<DietType, string> = {
      estandar: "Pechuga de pavo con ensalada verde y vinagreta ligera",
      paleo: "Pollo asado con ensalada de hojas verdes, aguacate y AOVE",
      keto: "Pollo con espinacas salteadas en mantequilla y aguacate",
      vegana: "Tofu salteado con kale, brócoli y semillas de sésamo",
      vegetariana: "Tortilla francesa con espinacas y ensalada verde",
      mediterranea: "Pescado blanco a la plancha con verduras al horno",
      sin_gluten: "Pavo con ensalada verde y aguacate",
      sin_lactosa: "Pavo con ensalada verde y aguacate",
    };
    const cenaIdx = meals.findIndex(m => m.name === "Cena");
    if (cenaIdx >= 0) meals[cenaIdx] = { name: "Cena", description: lighter[diet] };
  }

  // Filtrado por alergias (simple heurística)
  if (noNuts) meals = meals.map(m => ({ ...m, description: m.description.replace(/(nueces|almendras|cacahuete|frutos secos|macadamia)/gi, "semillas") }));
  if (noEggs) meals = meals.map(m => ({ ...m, description: m.description.replace(/(huevo[s]?|tortilla|tortilla francesa)/gi, "tofu revuelto") }));
  if (noFish) meals = meals.map(m => ({ ...m, description: m.description.replace(/(salmón|pescado blanco|atún|marisco)/gi, "pollo") }));

  return meals;
}

// ─── Gym split ───

interface RoutineDay { name: string; muscles: string[]; }

function getGymSplit(daysAvailable: number, skillProfile: SkillProfile | null): RoutineDay[] {
  const baseSplit = (() => {
    if (daysAvailable >= 6) return [
      { name: "Push A", muscles: ["Pecho", "Hombros", "Tríceps"] },
      { name: "Pull A", muscles: ["Espalda", "Bíceps"] },
      { name: "Legs A", muscles: ["Piernas", "Glúteos"] },
      { name: "Push B", muscles: ["Pecho", "Hombros", "Tríceps"] },
      { name: "Pull B", muscles: ["Espalda", "Bíceps"] },
      { name: "Legs B", muscles: ["Piernas", "Glúteos", "Core"] },
    ];
    if (daysAvailable >= 4) return [
      { name: "Upper A", muscles: ["Pecho", "Espalda", "Hombros"] },
      { name: "Lower A", muscles: ["Piernas", "Glúteos", "Core"] },
      { name: "Upper B", muscles: ["Pecho", "Espalda", "Bíceps", "Tríceps"] },
      { name: "Lower B", muscles: ["Piernas", "Glúteos", "Core"] },
    ];
    if (daysAvailable >= 3) return [
      { name: "Full Body A", muscles: ["Pecho", "Espalda", "Piernas"] },
      { name: "Full Body B", muscles: ["Hombros", "Piernas", "Core"] },
      { name: "Full Body C", muscles: ["Espalda", "Pecho", "Glúteos"] },
    ];
    return [
      { name: "Full Body A", muscles: ["Pecho", "Espalda", "Piernas", "Core"] },
      { name: "Full Body B", muscles: ["Hombros", "Piernas", "Glúteos", "Core"] },
    ];
  })();

  // If skill profile, ensure priority muscles appear in the split
  if (skillProfile) {
    for (const day of baseSplit) {
      for (const m of skillProfile.priorityMuscles) {
        if (!day.muscles.includes(m)) {
          // Add skill muscles to days that have related patterns
          const hasRelated = day.muscles.some(dm => 
            (dm === "Pecho" && m === "Tríceps") ||
            (dm === "Espalda" && m === "Bíceps") ||
            (dm === "Hombros" && (m === "Core" || m === "Tríceps")) ||
            (dm === "Piernas" && (m === "Glúteos" || m === "Core"))
          );
          if (hasRelated && !day.muscles.includes(m)) {
            day.muscles.push(m);
          }
        }
      }
    }
  }

  return baseSplit;
}

// ─── Build weekly plan ───

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function buildWeeklyPlan(
  gymSplit: RoutineDay[], sports: string[], daysAvailable: number,
  config: UserConfig,
  exerciseLib: Record<string, ExerciseRow[]>,
  rules: Rules,
  skillProfile: SkillProfile | null,
) {
  const plan: any[] = [];
  const trainedMuscles: Record<string, number> = {};
  let gymDayIdx = 0;
  const sportDays: number[] = [];
  const hasSports = sports.length > 0;
  const gymDays = hasSports ? Math.max(Math.ceil(daysAvailable * 0.6), gymSplit.length) : daysAvailable;
  const sportDayCount = hasSports ? Math.max(1, daysAvailable - gymDays) : 0;

  for (let dayIdx = 0; dayIdx < 7 && plan.length < daysAvailable; dayIdx++) {
    if (gymDayIdx < gymSplit.length && gymDayIdx < gymDays) {
      const routine = gymSplit[gymDayIdx];
      const canTrain = routine.muscles.every((m) => {
        const lastDay = trainedMuscles[m];
        if (lastDay === undefined) return true;
        const recoveryNeeded = rules.recovery_hours[m] || 48;
        return (dayIdx - lastDay) * 24 >= recoveryNeeded;
      });

      if (canTrain) {
        const exercises = pickExercisesForSession(routine.muscles, exerciseLib, config, rules, skillProfile);
        plan.push({
          day: DAYS[dayIdx], type: "gimnasio",
          routine_name: routine.name, muscle_focus: routine.muscles.join(" · "),
          exercises: exercises.map(({ movement_pattern, priority, fatigue_level, ...rest }) => rest),
        });
        for (const m of routine.muscles) trainedMuscles[m] = dayIdx;
        gymDayIdx++;
        continue;
      }
    }

    if (sportDays.length < sportDayCount && hasSports) {
      const sport = sports[sportDays.length % sports.length];
      plan.push({
        day: DAYS[dayIdx], type: "actividad", sport,
        intensity: config.intensityLevel >= 7 ? "Alta" : config.intensityLevel >= 4 ? "Media" : "Baja",
        duration: config.intensityLevel >= 7 ? "60min" : "45min",
      });
      sportDays.push(dayIdx);
      continue;
    }

    if (gymDayIdx < gymSplit.length) {
      const routine = gymSplit[gymDayIdx];
      const exercises = pickExercisesForSession(routine.muscles, exerciseLib, config, rules, skillProfile);
      plan.push({
        day: DAYS[dayIdx], type: "gimnasio",
        routine_name: routine.name, muscle_focus: routine.muscles.join(" · "),
        exercises: exercises.map(({ movement_pattern, priority, fatigue_level, ...rest }) => rest),
      });
      for (const m of routine.muscles) trainedMuscles[m] = dayIdx;
      gymDayIdx++;
    }
  }
  return plan;
}

// ─── Intensity to level ───

function intensityToLevel(intensity: number): number {
  if (intensity >= 8) return 3;
  if (intensity >= 5) return 2;
  return 1;
}

// ─── Serve ───

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    let targetUserId = user.id;
    try { const body = await req.json(); if (body.user_id) targetUserId = body.user_id; } catch { /* no body */ }

    // Fetch rules, onboarding and user_schedule in parallel
    const [onbResult, rulesResult, scheduleResult] = await Promise.all([
      supabase.from("onboarding").select("*").eq("user_id", targetUserId).single(),
      supabase.from("training_rules").select("*").limit(1).single(),
      supabase.from("user_schedule").select("gym_slots").eq("user_id", targetUserId).maybeSingle(),
    ]);

    const onb = onbResult.data;
    if (onbResult.error || !onb) throw new Error("Onboarding data not found");

    // Build rules object — fallback to defaults if no row
    let rules: Rules = DEFAULT_RULES;
    if (rulesResult.data) {
      const r = rulesResult.data;
      rules = {
        min_sets_per_session: r.min_sets_per_session ?? DEFAULT_RULES.min_sets_per_session,
        max_sets_per_session: r.max_sets_per_session ?? DEFAULT_RULES.max_sets_per_session,
        series_p1_min: r.series_p1_min ?? DEFAULT_RULES.series_p1_min,
        series_p1_max: r.series_p1_max ?? DEFAULT_RULES.series_p1_max,
        series_p2_min: r.series_p2_min ?? DEFAULT_RULES.series_p2_min,
        series_p2_max: r.series_p2_max ?? DEFAULT_RULES.series_p2_max,
        series_p3_min: r.series_p3_min ?? DEFAULT_RULES.series_p3_min,
        series_p3_max: r.series_p3_max ?? DEFAULT_RULES.series_p3_max,
        reps_fuerza: r.reps_fuerza ?? DEFAULT_RULES.reps_fuerza,
        reps_hipertrofia: r.reps_hipertrofia ?? DEFAULT_RULES.reps_hipertrofia,
        reps_resistencia: r.reps_resistencia ?? DEFAULT_RULES.reps_resistencia,
        reps_isometrico: r.reps_isometrico ?? DEFAULT_RULES.reps_isometrico,
        rest_fuerza: r.rest_fuerza ?? DEFAULT_RULES.rest_fuerza,
        rest_hipertrofia: r.rest_hipertrofia ?? DEFAULT_RULES.rest_hipertrofia,
        rest_resistencia: r.rest_resistencia ?? DEFAULT_RULES.rest_resistencia,
        rest_isometrico: r.rest_isometrico ?? DEFAULT_RULES.rest_isometrico,
        max_consecutive_high_fatigue: r.max_consecutive_high_fatigue ?? DEFAULT_RULES.max_consecutive_high_fatigue,
        max_heavy_hinges: r.max_heavy_hinges ?? DEFAULT_RULES.max_heavy_hinges,
        max_pattern_repeats: r.max_pattern_repeats ?? DEFAULT_RULES.max_pattern_repeats,
        push_pull_max_diff: r.push_pull_max_diff ?? DEFAULT_RULES.push_pull_max_diff,
        max_p2_exercises: r.max_p2_exercises ?? DEFAULT_RULES.max_p2_exercises,
        max_p3_exercises: r.max_p3_exercises ?? DEFAULT_RULES.max_p3_exercises,
        required_patterns: Array.isArray(r.required_patterns) ? r.required_patterns as string[] : DEFAULT_RULES.required_patterns,
        recovery_hours: typeof r.recovery_hours === "object" && r.recovery_hours !== null ? r.recovery_hours as Record<string, number> : DEFAULT_RULES.recovery_hours,
      };
    }
    console.log(`[GENERATE-PLAN] Rules loaded: min=${rules.min_sets_per_session} max=${rules.max_sets_per_session} patterns=${rules.required_patterns.join(",")}`);

    const weight = onb.weight || 70;
    const goal = onb.goal || "general_health";
    const specificGoal = onb.specific_goal || "";
    const sports = onb.sports ? onb.sports.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
    // Prefer real weekly schedule (gym_slots) over onboarding availability when present
    const gymSlots = Array.isArray(scheduleResult.data?.gym_slots)
      ? (scheduleResult.data!.gym_slots as Array<{ day: number; start: string; duration: number }>)
      : [];
    const scheduleDays = gymSlots.length > 0 ? gymSlots.length : null;
    const daysAvailable = scheduleDays ?? parseInt(
      typeof onb.availability === "object" && onb.availability !== null
        ? (onb.availability as any).days || "4" : "4"
    );
    if (scheduleDays) {
      console.log(`[GENERATE-PLAN] Using user_schedule: ${scheduleDays} gym slots/week`);
    }
    const intensityLevel = onb.intensity_level || 5;
    const userLevel = intensityToLevel(intensityLevel);
    let equipmentType = onb.equipment_type || "Mixto";

    // ── Primary focus override (gimnasio | calistenia | mixto) ──
    const primaryFocus = (onb as any).primary_focus || "mixto";
    if (primaryFocus === "gimnasio") equipmentType = "Gimnasio";
    else if (primaryFocus === "calistenia") equipmentType = "Calistenia";

    // ── Travel mode: override equipment if active ──
    const { data: profileForTravel } = await supabase
      .from("profiles")
      .select("travel_mode_until, travel_equipment")
      .eq("user_id", targetUserId)
      .single();
    const travelActive = profileForTravel?.travel_mode_until
      && new Date(profileForTravel.travel_mode_until) >= new Date(new Date().toDateString());
    if (travelActive) {
      equipmentType = "Calistenia"; // bodyweight-friendly fallback
      console.log(`[GENERATE-PLAN] Travel mode active until ${profileForTravel?.travel_mode_until}, equipment: ${profileForTravel?.travel_equipment}`);
    }

    const skillProfile = getSkillProfile(specificGoal);
    if (skillProfile) {
      console.log(`[GENERATE-PLAN] Skill profile detected: "${specificGoal}" → muscles=${skillProfile.priorityMuscles.join(",")}, patterns=${skillProfile.priorityPatterns.join(",")}`);
    }

    const config: UserConfig = {
      userLevel,
      goal,
      exerciseType: equipmentType,
      intensityLevel,
      specificGoal,
    };

    const { data: allExercises } = await supabase
      .from("exercises")
      .select("id, name, muscle_group, image_url, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level, recommended_order, skill_tag, progression_order");

    const exerciseLib: Record<string, ExerciseRow[]> = {};
    for (const ex of (allExercises || []) as ExerciseRow[]) {
      const g = ex.muscle_group || "Otro";
      if (!exerciseLib[g]) exerciseLib[g] = [];
      exerciseLib[g].push(ex);
    }

    console.log(`[GENERATE-PLAN] Exercise library: ${Object.entries(exerciseLib).map(([k, v]) => `${k}:${v.length}`).join(", ")}`);

    // ─── Find skill progressions ───
    let skillProgressions: ExerciseRow[] = [];
    if (skillProfile) {
      skillProgressions = ((allExercises || []) as ExerciseRow[])
        .filter(ex => ex.skill_tag === skillProfile.skillTag && ex.progression_order !== null)
        .sort((a, b) => (a.progression_order ?? 0) - (b.progression_order ?? 0));
      
      // Filter by user level: include exercises up to userLevel+1 in progression order
      // This gives the user their current progression step + the next one to work towards
      if (skillProgressions.length > 0) {
        const maxProgression = Math.min(userLevel + 1, skillProgressions.length);
        skillProgressions = skillProgressions.slice(0, maxProgression);
        console.log(`[GENERATE-PLAN] Skill progressions for "${skillProfile.skillTag}": ${skillProgressions.map(e => `${e.name}(#${e.progression_order})`).join(" → ")}`);
      }
    }

    console.log(`[GENERATE-PLAN] User: level=${userLevel}, intensity=${intensityLevel}, goal=${goal}, equipment=${equipmentType}, specificGoal="${specificGoal}"`);

    const gymSplit = getGymSplit(Math.min(daysAvailable, 6), skillProfile);
    const weeklyPlan = buildWeeklyPlan(gymSplit, sports, Math.min(daysAvailable, 7), config, exerciseLib, rules, skillProfile);

    // ─── Inject skill progressions into gym days ───
    if (skillProgressions.length > 0 && skillProfile) {
      const progressionExercises = skillProgressions.map(ex => ({
        exercise_id: ex.id,
        name: ex.name,
        series: rules.series_p1_max,
        reps: rules.reps_fuerza,
        weight: "",
        rest: rules.rest_fuerza,
        image_url: ex.image_url || undefined,
        is_progression: true,
      }));

      // Distribute progressions across gym days that train relevant muscles
      let progIdx = 0;
      for (const day of weeklyPlan) {
        if (day.type !== "gimnasio" || !day.exercises) continue;
        const muscles = (day.muscle_focus || "").split(" · ");
        const isRelevant = muscles.some((m: string) => skillProfile.priorityMuscles.includes(m));
        if (isRelevant && progIdx < progressionExercises.length) {
          // Insert progression exercises at the beginning of the session
          day.exercises.unshift(progressionExercises[progIdx]);
          progIdx++;
          if (progIdx >= progressionExercises.length) progIdx = 0; // cycle
        }
      }
      console.log(`[GENERATE-PLAN] Injected ${progressionExercises.length} progression exercises across gym days`);
    }

    for (const day of weeklyPlan) {
      if (day.type === "gimnasio") {
        console.log(`[GENERATE-PLAN] ${day.day} (${day.routine_name}): ${(day.exercises || []).length} exercises`);
      }
    }

    const diet = detectDiet((onb as any).nutrition_preferences);
    const macros = calcMacros(weight, goal, diet);
    const meals = getMeals(goal, diet, (onb as any).allergies);
    console.log(`[GENERATE-PLAN] Nutrition: diet=${diet}, goal=${goal}, macros=${JSON.stringify(macros)}, meals=${meals.length}`);

    await supabase.from("training_plan").upsert({ user_id: targetUserId, workouts_json: weeklyPlan });
    await supabase.from("nutrition_plan").upsert({ user_id: targetUserId, macros_json: macros, meals_json: meals });
    await supabase.from("profiles").update({ plan_status: "plan_ready" }).eq("user_id", targetUserId);

    console.log(`[GENERATE-PLAN] Plan generated for ${targetUserId}: ${weeklyPlan.length} days, skill="${specificGoal}"`);

    // Auto-sync Google Calendar (fire-and-forget) if user has connected
    try {
      const { data: tok } = await supabase
        .from("google_calendar_tokens")
        .select("user_id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (tok) {
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/gcal-sync`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: targetUserId }),
        }).catch((e) => console.log(`[GENERATE-PLAN] gcal-sync trigger failed: ${e}`));
        console.log(`[GENERATE-PLAN] Triggered gcal-sync for ${targetUserId}`);
      }
    } catch (e) {
      console.log(`[GENERATE-PLAN] gcal-sync skipped: ${e}`);
    }

    return new Response(JSON.stringify({
      success: true, training_days: weeklyPlan.length, macros, meals_count: meals.length,
      skill_profile: skillProfile ? { muscles: skillProfile.priorityMuscles, patterns: skillProfile.priorityPatterns } : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[GENERATE-PLAN] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
