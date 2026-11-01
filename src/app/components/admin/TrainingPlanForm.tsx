import { useState, useEffect, useId, forwardRef } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { toast } from "sonner";
import { Trash2, Dumbbell, ChevronDown, Sparkles, CalendarDays, TriangleAlert, SlidersHorizontal } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { hapticTap, hapticSelection } from "@/shared/lib/native";
import type { Exercise, DayPlan, GymExerciseEntry } from "@/shared/types/training";
import { DAYS, INTENSITIES } from "@/shared/types/training";
import { getAvailabilityDayCount } from "@/shared/lib/availability";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { ExercisePreviewSheet, type ExercisePreviewData } from "@/app/components/ExercisePreviewSheet";

interface Props {
  dayPlans: DayPlan[];
  onChange: (plans: DayPlan[]) => void;
  userSports?: string | null;
  equipmentType?: string;
  specificGoal?: string;
  intensityLevel?: number;
  userGoal?: string;
  userInjuries?: string;
  userAge?: number;
  userAvailability?: Record<string, unknown> | null;
}

// ─── Injury → muscle group mapping ───
const INJURY_MUSCLE_MAP: Record<string, string[]> = {
  hombro: ["Hombros"],
  shoulder: ["Hombros"],
  espalda: ["Espalda"],
  back: ["Espalda"],
  rodilla: ["Piernas", "Glúteos"],
  knee: ["Piernas", "Glúteos"],
  muñeca: ["Pecho", "Tríceps", "Hombros"],
  wrist: ["Pecho", "Tríceps", "Hombros"],
  codo: ["Bíceps", "Tríceps"],
  elbow: ["Bíceps", "Tríceps"],
  cadera: ["Piernas", "Glúteos"],
  hip: ["Piernas", "Glúteos"],
  lumbar: ["Espalda", "Core"],
  lower_back: ["Espalda", "Core"],
  cervical: ["Hombros", "Espalda"],
  tobillo: ["Piernas"],
  ankle: ["Piernas"],
};

const getInjuredMuscles = (injuries?: string): Set<string> => {
  if (!injuries) return new Set();
  const lower = injuries.toLowerCase();
  const injured = new Set<string>();
  for (const [keyword, muscles] of Object.entries(INJURY_MUSCLE_MAP)) {
    if (lower.includes(keyword)) {
      muscles.forEach(m => injured.add(m));
    }
  }
  return injured;
};

// ─── Availability → recommended template ───
const getRecommendedStructure = (availability?: Record<string, unknown> | null): string | null => {
  if (!availability) return null;
  const activeDays = getAvailabilityDayCount(availability);
  if (!activeDays) return null;
  if (activeDays <= 2) return "fullbody";
  if (activeDays === 3) return "fullbody";
  if (activeDays === 4) return "upper_lower";
  if (activeDays >= 5) return "ppl";
  return null;
};

// ─── Level-based auto-adjustment ───
// Maps intensity_level (1-10) to training parameters
const getTrainingParams = (intensity: number, goal?: string) => {
  // Determine user tier: 1-3 = beginner, 4-6 = intermediate, 7-10 = advanced
  const tier = intensity <= 3 ? "beginner" : intensity <= 6 ? "intermediate" : "advanced";

  const baseParams = {
    beginner: { series: 2, reps: 12, rest: "90s", skillSeries: 3, skillReps: 5, skillRest: "120s" },
    intermediate: { series: 3, reps: 10, rest: "75s", skillSeries: 4, skillReps: 6, skillRest: "90s" },
    advanced: { series: 4, reps: 8, rest: "60s", skillSeries: 5, skillReps: 8, skillRest: "90s" },
  };

  const params = { ...baseParams[tier] };

  // Goal-based adjustments
  if (goal === "lose_weight") {
    params.reps = Math.min(params.reps + 3, 20);
    params.rest = tier === "advanced" ? "45s" : "60s";
  } else if (goal === "gain_muscle") {
    params.series = Math.min(params.series + 1, 5);
    params.reps = Math.max(params.reps - 1, 6);
    params.rest = "90s";
  } else if (goal === "improve_endurance") {
    params.reps = Math.min(params.reps + 5, 25);
    params.rest = "30s";
    params.series = Math.max(params.series - 1, 2);
  }

  return params;
};

const emptyGymExercise = (): GymExerciseEntry => ({
  exercise_id: "", name: "", series: 3, reps: 10, weight: "", rest: "60s",
});

// ─── Training Templates ───
const STRUCTURE_TEMPLATES: Record<string, { label: string; days: DayPlan[] }> = {
  ppl: {
    label: "PPL (Push/Pull/Legs)",
    days: [
      { day: "Lunes", type: "gimnasio", routine_name: "Push A", muscle_focus: "Pecho · Hombros · Tríceps", exercises: [] },
      { day: "Martes", type: "gimnasio", routine_name: "Pull A", muscle_focus: "Espalda · Bíceps", exercises: [] },
      { day: "Miércoles", type: "gimnasio", routine_name: "Legs A", muscle_focus: "Piernas · Glúteos", exercises: [] },
      { day: "Jueves", type: "gimnasio", routine_name: "Push B", muscle_focus: "Pecho · Hombros · Tríceps", exercises: [] },
      { day: "Viernes", type: "gimnasio", routine_name: "Pull B", muscle_focus: "Espalda · Bíceps", exercises: [] },
      { day: "Sábado", type: "gimnasio", routine_name: "Legs B", muscle_focus: "Piernas · Glúteos · Core", exercises: [] },
    ],
  },
  upper_lower: {
    label: "Upper/Lower (4 días)",
    days: [
      { day: "Lunes", type: "gimnasio", routine_name: "Upper A", muscle_focus: "Pecho · Espalda · Hombros", exercises: [] },
      { day: "Martes", type: "gimnasio", routine_name: "Lower A", muscle_focus: "Piernas · Glúteos · Core", exercises: [] },
      { day: "Jueves", type: "gimnasio", routine_name: "Upper B", muscle_focus: "Pecho · Espalda · Bíceps · Tríceps", exercises: [] },
      { day: "Viernes", type: "gimnasio", routine_name: "Lower B", muscle_focus: "Piernas · Glúteos · Core", exercises: [] },
    ],
  },
  fullbody: {
    label: "Full Body (3 días)",
    days: [
      { day: "Lunes", type: "gimnasio", routine_name: "Full Body A", muscle_focus: "Cuerpo completo", exercises: [] },
      { day: "Miércoles", type: "gimnasio", routine_name: "Full Body B", muscle_focus: "Cuerpo completo", exercises: [] },
      { day: "Viernes", type: "gimnasio", routine_name: "Full Body C", muscle_focus: "Cuerpo completo", exercises: [] },
    ],
  },
  torso_pierna: {
    label: "Torso/Pierna (4 días)",
    days: [
      { day: "Lunes", type: "gimnasio", routine_name: "Torso A", muscle_focus: "Pecho · Espalda · Hombros", exercises: [] },
      { day: "Martes", type: "gimnasio", routine_name: "Pierna A", muscle_focus: "Piernas · Glúteos", exercises: [] },
      { day: "Jueves", type: "gimnasio", routine_name: "Torso B", muscle_focus: "Pecho · Espalda · Bíceps · Tríceps", exercises: [] },
      { day: "Viernes", type: "gimnasio", routine_name: "Pierna B", muscle_focus: "Piernas · Glúteos · Core", exercises: [] },
    ],
  },
};

// ─── Goal-Specific Skill Templates ───
interface SkillTemplate {
  label: string;
  skillTag: string;
  supportMuscles: string[];
  days: { name: string; focus: string; muscles: string[] }[];
}

const SKILL_TEMPLATES: Record<string, SkillTemplate> = {
  handstand: {
    label: "Pino / Handstand",
    skillTag: "handstand",
    supportMuscles: ["Hombros", "Core", "Tríceps"],
    days: [
      { name: "Skill + Empuje", focus: "Progresión de pino + Hombros · Tríceps", muscles: ["Hombros", "Tríceps"] },
      { name: "Core + Estabilidad", focus: "Core · Equilibrio · Hombros", muscles: ["Core", "Hombros"] },
      { name: "Pull + Compensación", focus: "Espalda · Bíceps · Movilidad", muscles: ["Espalda", "Bíceps"] },
      { name: "Skill + Full", focus: "Progresión de pino + Cuerpo completo", muscles: ["Hombros", "Piernas", "Core"] },
    ],
  },
  muscle_up: {
    label: "Muscle Up",
    skillTag: "muscle_up",
    supportMuscles: ["Espalda", "Pecho", "Bíceps", "Tríceps"],
    days: [
      { name: "Pull Pesado", focus: "Progresión muscle up + Espalda · Bíceps", muscles: ["Espalda", "Bíceps"] },
      { name: "Push + Transición", focus: "Pecho · Tríceps · Fondos", muscles: ["Pecho", "Tríceps"] },
      { name: "Piernas + Core", focus: "Piernas · Glúteos · Core", muscles: ["Piernas", "Core"] },
      { name: "Pull Explosivo", focus: "Progresión muscle up + Espalda", muscles: ["Espalda", "Pecho"] },
    ],
  },
  planche: {
    label: "Planche",
    skillTag: "planche",
    supportMuscles: ["Hombros", "Pecho", "Core", "Tríceps"],
    days: [
      { name: "Skill + Push", focus: "Progresión planche + Hombros · Pecho", muscles: ["Hombros", "Pecho"] },
      { name: "Core + Recto abdominal", focus: "Core intenso · Hollow · Protracción", muscles: ["Core", "Hombros"] },
      { name: "Pull + Compensación", focus: "Espalda · Bíceps", muscles: ["Espalda", "Bíceps"] },
      { name: "Skill + Pierna", focus: "Progresión planche + Piernas", muscles: ["Hombros", "Piernas"] },
    ],
  },
  front_lever: {
    label: "Front Lever",
    skillTag: "front_lever",
    supportMuscles: ["Espalda", "Core", "Bíceps"],
    days: [
      { name: "Skill + Pull", focus: "Progresión front lever + Espalda", muscles: ["Espalda", "Bíceps"] },
      { name: "Core + Retracción", focus: "Core · Hollow · Espalda", muscles: ["Core", "Espalda"] },
      { name: "Push + Compensación", focus: "Pecho · Hombros · Tríceps", muscles: ["Pecho", "Hombros"] },
      { name: "Skill + Pierna", focus: "Progresión front lever + Piernas", muscles: ["Espalda", "Piernas"] },
    ],
  },
  back_lever: {
    label: "Back Lever",
    skillTag: "back_lever",
    supportMuscles: ["Espalda", "Hombros", "Bíceps"],
    days: [
      { name: "Skill + Pull", focus: "Progresión back lever + Espalda", muscles: ["Espalda", "Hombros"] },
      { name: "Push + Hombros", focus: "Pecho · Hombros · Tríceps", muscles: ["Pecho", "Hombros"] },
      { name: "Core + Movilidad", focus: "Core · Movilidad de hombro", muscles: ["Core", "Hombros"] },
      { name: "Pull + Pierna", focus: "Espalda · Piernas", muscles: ["Espalda", "Piernas"] },
    ],
  },
  human_flag: {
    label: "Bandera Humana",
    skillTag: "human_flag",
    supportMuscles: ["Hombros", "Core", "Espalda"],
    days: [
      { name: "Skill + Lateral", focus: "Progresión bandera + Oblicuos · Hombros", muscles: ["Hombros", "Core"] },
      { name: "Push + Pull", focus: "Espalda · Pecho · Hombros", muscles: ["Espalda", "Pecho"] },
      { name: "Core + Pierna", focus: "Core intenso · Piernas", muscles: ["Core", "Piernas"] },
    ],
  },
  pistol_squat: {
    label: "Pistol Squat",
    skillTag: "pistol_squat",
    supportMuscles: ["Piernas", "Glúteos", "Core"],
    days: [
      { name: "Skill + Pierna", focus: "Progresión pistol + Piernas · Glúteos", muscles: ["Piernas", "Glúteos"] },
      { name: "Upper Push", focus: "Pecho · Hombros · Tríceps", muscles: ["Pecho", "Hombros"] },
      { name: "Upper Pull", focus: "Espalda · Bíceps · Core", muscles: ["Espalda", "Core"] },
      { name: "Skill + Movilidad", focus: "Progresión pistol + Movilidad · Core", muscles: ["Piernas", "Core"] },
    ],
  },
  l_sit: {
    label: "L-Sit",
    skillTag: "l_sit",
    supportMuscles: ["Core", "Hombros", "Tríceps"],
    days: [
      { name: "Skill + Core", focus: "Progresión L-sit + Core · Compresión", muscles: ["Core", "Hombros"] },
      { name: "Push", focus: "Pecho · Hombros · Tríceps", muscles: ["Pecho", "Tríceps"] },
      { name: "Pull + Pierna", focus: "Espalda · Bíceps · Piernas", muscles: ["Espalda", "Piernas"] },
    ],
  },
};

const TrainingPlanForm = forwardRef<HTMLDivElement, Props>(({ dayPlans, onChange, userSports, equipmentType = "Mixto", specificGoal, intensityLevel = 5, userGoal, userInjuries, userAge, userAvailability }, ref) => {
  const formId = useId();
  const [preview, setPreview] = useState<ExercisePreviewData | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const injuredMuscles = getInjuredMuscles(userInjuries);
  const recommendedStructure = getRecommendedStructure(userAvailability);
  const activeDays = getAvailabilityDayCount(userAvailability);
  const trainingDays = new Set(dayPlans.filter((plan) => plan.type === "gimnasio").map((plan) => plan.day)).size;
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([0]));

  // Auto-calculated training params based on user profile
  const params = getTrainingParams(intensityLevel, userGoal);

  // Determine equipment filter
  const eqFilter = equipmentType === "Calistenia" ? "Calistenia" : equipmentType === "Gimnasio" ? "Gimnasio" : null;

  useEffect(() => {
    supabase.from("exercises")
      .select("id, name, muscle_group, image_url, video_url, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level, recommended_order, skill_tag, progression_order")
      .order("muscle_group").order("recommended_order").order("name")
      .then(({ data }) => { if (data) setExercises(data as Exercise[]); });
  }, []);

  // Filtered exercises based on equipment preference
  const filteredExercises = eqFilter
    ? exercises.filter(e => e.exercise_type === eqFilter || e.exercise_type === "Mixto" || !e.exercise_type)
    : exercises;

  const sportOptions = userSports
    ? userSports.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const toggleExpand = (i: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  // Helper: pick exercises from library for given muscles (excluding injured)
  const pickExercisesForMuscles = (muscleFocus: string, count = 4): GymExerciseEntry[] => {
    const muscles = muscleFocus.split("·").map(m => m.trim()).filter(Boolean);
    const safeMuscles = muscles.filter(m => !injuredMuscles.has(m));
    if (safeMuscles.length === 0) return [];
    const result: GymExerciseEntry[] = [];
    for (const muscle of safeMuscles) {
      const available = filteredExercises.filter(e => e.muscle_group === muscle);
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const perMuscle = Math.max(1, Math.floor(count / safeMuscles.length));
      for (const ex of shuffled.slice(0, perMuscle)) {
        result.push({
          exercise_id: ex.id, name: ex.name,
          series: params.series, reps: params.reps,
          weight: "", rest: params.rest, image_url: ex.image_url || undefined,
          muscle_group: ex.muscle_group,
          exercise_type: ex.exercise_type,
          video_url: ex.video_url || undefined,
        });
      }
    }
    return result;
  };

  const loadTemplate = (key: string) => {
    const tpl = STRUCTURE_TEMPLATES[key];
    if (!tpl) return;
    const templateDays = key === "fullbody" && activeDays && activeDays < 3 ? tpl.days.slice(0, activeDays) : tpl.days;
    const selectedWeekdays = Array.isArray(userAvailability?.training_days)
      ? [...new Set(userAvailability.training_days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))]
      : [];
    const days = templateDays.map((d, index) => ({
      ...d,
      ...(selectedWeekdays.length === templateDays.length ? { day: DAYS[(selectedWeekdays[index] + 6) % 7] } : {}),
      exercises: d.muscle_focus ? pickExercisesForMuscles(d.muscle_focus) : [],
    }));
    onChange(days);
    setExpandedDays(new Set([0]));
    toast.success(`Plantilla "${tpl.label}" cargada con ejercicios`);
  };

  const loadSkillTemplate = (key: string) => {
    const tpl = SKILL_TEMPLATES[key];
    if (!tpl) return;

    // Get skill progression exercises (skill exercises bypass equipment filter)
    const skillExercises = exercises
      .filter(e => e.skill_tag === tpl.skillTag)
      .sort((a, b) => (a.progression_order || 0) - (b.progression_order || 0));

    const days: DayPlan[] = tpl.days.map((d, i) => {
      const dayName = DAYS[i] || DAYS[0];
      const gymExercises: GymExerciseEntry[] = [];

      // Add skill progression exercises first (on skill days)
      if (d.focus.toLowerCase().includes("progresión")) {
        // Filter by user level: only include exercises at or below their level
        const levelCap = intensityLevel <= 3 ? 1 : intensityLevel <= 6 ? 2 : 3;
        const levelFiltered = skillExercises.filter(se => !se.level || se.level <= levelCap);
        // If too few, include all
        const toUse = levelFiltered.length >= 2 ? levelFiltered : skillExercises;
        for (const se of toUse) {
          gymExercises.push({
            exercise_id: se.id,
            name: se.name,
            series: params.skillSeries,
            reps: params.skillReps,
            weight: "",
            rest: params.skillRest,
            image_url: se.image_url || undefined,
            muscle_group: se.muscle_group,
            exercise_type: se.exercise_type,
            video_url: se.video_url || undefined,
          });
        }
      }

      // Fill with support exercises from the specified muscles (respecting equipment filter + injuries)
      for (const muscle of d.muscles.filter(m => !injuredMuscles.has(m))) {
        const available = filteredExercises
          .filter(e => e.muscle_group === muscle && !gymExercises.find(g => g.exercise_id === e.id))
          .sort(() => Math.random() - 0.5);
        const take = Math.max(1, Math.floor(3 / d.muscles.length));
        for (const ex of available.slice(0, take)) {
          gymExercises.push({
            exercise_id: ex.id,
            name: ex.name,
            series: params.series,
            reps: params.reps,
            weight: "",
            rest: params.rest,
            image_url: ex.image_url || undefined,
            muscle_group: ex.muscle_group,
            exercise_type: ex.exercise_type,
            video_url: ex.video_url || undefined,
          });
        }
      }

      return {
        day: dayName,
        type: "gimnasio" as const,
        routine_name: d.name,
        muscle_focus: d.focus,
        exercises: gymExercises,
      };
    });

    onChange(days);
    setExpandedDays(new Set([0]));
    toast.success(`Plantilla "${tpl.label}" cargada con ${skillExercises.length} ejercicios de progresión`);
  };

  const exportRoutine = () => {
    let text = "RUTINA DE ENTRENAMIENTO\n" + "=".repeat(40) + "\n\n";
    for (const plan of dayPlans) {
      text += `📅 ${plan.day} — ${plan.type === "gimnasio" ? plan.routine_name || "Gimnasio" : plan.sport || "Actividad"}\n`;
      if (plan.muscle_focus) text += `   Músculos: ${plan.muscle_focus}\n`;
      if (plan.type === "gimnasio" && plan.exercises?.length) {
        for (const ex of plan.exercises) {
          text += `   • ${ex.name} — ${ex.series}x${ex.reps} ${ex.weight ? `@ ${ex.weight}` : ""} (descanso: ${ex.rest})\n`;
        }
      }
      if (plan.type === "actividad") {
        text += `   Intensidad: ${plan.intensity || "Media"} · Duración: ${plan.duration || "—"}\n`;
      }
      text += "\n";
    }
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rutina.txt"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Rutina exportada");
  };

  const addDay = () => {
    const usedDays = dayPlans.map((d) => d.day);
    const nextDay = DAYS.find((d) => !usedDays.includes(d)) || DAYS[0];
    const newIdx = dayPlans.length;
    onChange([...dayPlans, { day: nextDay, type: "gimnasio", routine_name: "", muscle_focus: "", exercises: [emptyGymExercise()] }]);
    setExpandedDays((prev) => new Set(prev).add(newIdx));
  };

  const duplicateDay = (i: number) => {
    const src = dayPlans[i];
    const usedDays = dayPlans.map((d) => d.day);
    const nextDay = DAYS.find((d) => !usedDays.includes(d)) || DAYS[0];
    const copy = { ...JSON.parse(JSON.stringify(src)), day: nextDay };
    const newIdx = dayPlans.length;
    onChange([...dayPlans, copy]);
    setExpandedDays((prev) => new Set(prev).add(newIdx));
    toast.success(`Día duplicado como ${nextDay}`);
  };

  const removeDay = (i: number) => onChange(dayPlans.filter((_, idx) => idx !== i));

  const updateDay = (i: number, updates: Partial<DayPlan>) => {
    onChange(dayPlans.map((d, idx) => idx === i ? { ...d, ...updates } : d));
  };

  const addGymExercise = (dayIdx: number) => {
    const plan = dayPlans[dayIdx];
    updateDay(dayIdx, { exercises: [...(plan.exercises || []), emptyGymExercise()] });
  };

  const updateGymExercise = (dayIdx: number, exIdx: number, updates: Partial<GymExerciseEntry>) => {
    const plan = dayPlans[dayIdx];
    const exs = [...(plan.exercises || [])];
    exs[exIdx] = { ...exs[exIdx], ...updates };
    updateDay(dayIdx, { exercises: exs });
  };

  const removeGymExercise = (dayIdx: number, exIdx: number) => {
    const plan = dayPlans[dayIdx];
    updateDay(dayIdx, { exercises: (plan.exercises || []).filter((_, i) => i !== exIdx) });
  };

  const selectExerciseFromLibrary = (dayIdx: number, exIdx: number, exerciseId: string) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (ex) {
      updateGymExercise(dayIdx, exIdx, {
        exercise_id: ex.id,
        name: ex.name,
        image_url: ex.image_url || undefined,
        muscle_group: ex.muscle_group,
        exercise_type: ex.exercise_type,
        video_url: ex.video_url || undefined,
      });
    }
  };

  const groupedExercises = filteredExercises.reduce<Record<string, Exercise[]>>((acc, ex) => {
    const g = ex.muscle_group || "Otro";
    if (!acc[g]) acc[g] = [];
    acc[g].push(ex);
    return acc;
  }, {});

  // Determine which skill template matches the user's specific goal
  const recommendedSkill = specificGoal
    ? Object.keys(SKILL_TEMPLATES).find(k => SKILL_TEMPLATES[k].skillTag === specificGoal)
    : null;

  const eqLabel = eqFilter ? `(${eqFilter})` : "(Mixto)";
  const tierLabel = intensityLevel <= 3 ? "Principiante" : intensityLevel <= 6 ? "Intermedio" : "Avanzado";

  const FIELD = "field w-full";
  const LABEL = "mb-1.5 block type-footnote text-muted-foreground";

  return (
    <div ref={ref} className="min-w-0 space-y-6">
      <SectionHeader
        size="lg"
        title="Rutina"
        hint={<span className="tabular-nums">{dayPlans.length} de 7 días · {eqFilter ?? "Mixto"}</span>}
        action={
          <div className="-mr-3 flex items-center">
            {dayPlans.length > 0 && (
              <Button variant="plain" size="sm" className="px-3" onClick={() => { void hapticTap(); exportRoutine(); }}>
                Exportar
              </Button>
            )}
            <Button variant="plain" size="sm" className="px-3" onClick={() => { void hapticTap(); addDay(); }} disabled={dayPlans.length >= 7}>
              Añadir día
            </Button>
          </div>
        }
      />

      <div className="space-y-5">
        {recommendedSkill && dayPlans.length === 0 && (
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-6 w-6 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="type-headline">Recomendado para este usuario</p>
              <p className="type-subhead text-muted-foreground">{SKILL_TEMPLATES[recommendedSkill].label}</p>
              <Button variant="plain" size="sm" className="-ml-3 min-h-11" onClick={() => { void hapticTap(); loadSkillTemplate(recommendedSkill); }}>
                Cargar plantilla
              </Button>
            </div>
          </div>
        )}

        {recommendedStructure && dayPlans.length === 0 && !recommendedSkill && (
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-6 w-6 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="type-headline">Recomendado ({activeDays} días disponibles):</p>
              <p className="type-subhead text-muted-foreground">{recommendedStructure === "fullbody" && activeDays && activeDays < 3 ? `Full Body (${activeDays} días)` : STRUCTURE_TEMPLATES[recommendedStructure]?.label}</p>
              <Button variant="plain" size="sm" className="-ml-3 min-h-11" onClick={() => { void hapticTap(); loadTemplate(recommendedStructure); }}>
                Cargar plantilla
              </Button>
            </div>
          </div>
        )}

        {activeDays != null && activeDays > 0 && trainingDays > 0 && trainingDays !== activeDays && (
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="type-headline">La frecuencia no coincide</p>
              <p className="type-subhead text-muted-foreground">
                El cliente indicó {activeDays} días de entrenamiento por semana y este plan tiene {trainingDays}.
                Revisa la distribución con el cliente antes de guardar.
              </p>
            </div>
          </div>
        )}

        {injuredMuscles.size > 0 && (
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-6 w-6 shrink-0 text-destructive" strokeWidth={1.75} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="type-headline">Lesiones detectadas</p>
              <p className="type-subhead text-muted-foreground">{userInjuries}</p>
              <p className="type-footnote text-muted-foreground">
                Grupos excluidos automáticamente: <span className="text-destructive">{Array.from(injuredMuscles).join(", ")}</span>
              </p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <SlidersHorizontal className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="type-headline">Ajuste automático</p>
            <p className="type-subhead text-muted-foreground tabular-nums">
              Nivel {tierLabel} (intensidad {intensityLevel}/10) · {params.series} series · {params.reps} reps · descanso {params.rest}
            </p>
            {(userGoal || activeDays || (userAge && userAge > 45)) && (
              <p className="type-footnote text-muted-foreground">
                {[userGoal && `Objetivo: ${userGoal}`, activeDays && `Días disponibles: ${activeDays}`, userAge && userAge > 45 && "Más de 45 años: considerar volumen reducido"].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <section>
        <h3 className="type-group-header px-1 pb-2">Plantillas de estructura {eqLabel}</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STRUCTURE_TEMPLATES).map(([key, tpl]) => (
            <button
              key={key}
              type="button"
              className="min-h-11 max-w-full rounded-full bg-secondary px-4 type-subhead transition-transform duration-150 active:scale-[0.97] active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => { void hapticTap(); loadTemplate(key); }}
            >
              {tpl.label}
            </button>
          ))}
          {recommendedSkill && (
            <button
              type="button"
              className="min-h-11 max-w-full rounded-full bg-primary/15 px-4 type-subhead font-semibold text-primary transition-transform duration-150 active:scale-[0.97] active:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => { void hapticTap(); loadSkillTemplate(recommendedSkill); }}
            >
              {SKILL_TEMPLATES[recommendedSkill].label}
            </button>
          )}
        </div>
        {recommendedSkill && <p className="px-1 pt-1.5 type-footnote text-muted-foreground">La plantilla en dorado responde al objetivo del usuario.</p>}
      </section>

      {dayPlans.length === 0 && (
        <EmptyState icon={Dumbbell} title="Sin días todavía" description="Carga una plantilla o pulsa «Añadir día» para empezar." />
      )}

      {dayPlans.length > 0 && (
        <div className="overflow-hidden rounded-media bg-card">
          {dayPlans.map((plan, dayIdx) => {
            const isExpanded = expandedDays.has(dayIdx);
            const summary = plan.type === "gimnasio"
              ? `${plan.routine_name || "Sin nombre"} · ${plan.muscle_focus || ""} · ${(plan.exercises || []).length} ejercicios`
              : `${plan.sport || "Sin actividad"} · ${plan.intensity} · ${plan.duration || "—"}`;

            return (
              <div key={dayIdx} className={cn(dayIdx > 0 && "sep-t")}>
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-150 active:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  onClick={() => { void hapticSelection(); toggleExpand(dayIdx); }}
                  aria-expanded={isExpanded}
                  aria-controls={`${formId}-day-${dayIdx}`}
                >
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-secondary type-footnote font-semibold", plan.type === "gimnasio" ? "text-foreground" : "text-muted-foreground")} aria-hidden="true">
                    {plan.day.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="type-headline">{plan.day}</div>
                    <div className="truncate type-footnote text-muted-foreground">{summary}</div>
                  </div>
                  <span className="shrink-0 type-footnote text-muted-foreground">
                    {plan.type === "gimnasio" ? "Gimnasio" : "Actividad"}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 ease-ios", isExpanded && "rotate-180")} strokeWidth={2.5} aria-hidden="true" />
                </button>

                {isExpanded && (
                  <div id={`${formId}-day-${dayIdx}`} className="min-w-0 space-y-4 px-4 pb-4 pt-2">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-0 flex-1 basis-28 sm:flex-none sm:w-36">
                        <Label htmlFor={`${formId}-${dayIdx}-day`} className={LABEL}>Día</Label>
                        <select id={`${formId}-${dayIdx}-day`} className={FIELD} value={plan.day} onChange={(e) => updateDay(dayIdx, { day: e.target.value })}>
                          {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="min-w-0 flex-1 basis-28 sm:flex-none sm:w-36">
                        <Label htmlFor={`${formId}-${dayIdx}-type`} className={LABEL}>Tipo</Label>
                        <select id={`${formId}-${dayIdx}-type`} className={FIELD} value={plan.type} onChange={(e) => updateDay(dayIdx, {
                          type: e.target.value as "actividad" | "gimnasio",
                          ...(e.target.value === "gimnasio" ? { routine_name: "", muscle_focus: "", exercises: [emptyGymExercise()] } : { sport: "", intensity: "Media", duration: "" }),
                        })}>
                          <option value="gimnasio">Gimnasio</option>
                          <option value="actividad">Actividad</option>
                        </select>
                      </div>
                      <div className="hidden sm:block sm:flex-1" />
                      <Button variant="plain" size="sm" disabled={dayPlans.length >= 7} onClick={() => { void hapticTap(); duplicateDay(dayIdx); }} className="min-h-11">
                        Duplicar
                      </Button>
                      <Button variant="plain" size="sm" onClick={() => { void hapticTap(); removeDay(dayIdx); }} className="min-h-11 text-destructive">
                        Eliminar
                      </Button>
                    </div>

                    {plan.type === "actividad" && (
                      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <Label htmlFor={`${formId}-${dayIdx}-sport`} className={LABEL}>Actividad</Label>
                          {sportOptions.length > 0 ? (
                            <select id={`${formId}-${dayIdx}-sport`} className={FIELD} value={plan.sport || ""} onChange={(e) => updateDay(dayIdx, { sport: e.target.value })}>
                              <option value="">Seleccionar…</option>
                              {sportOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                              <option value="__custom">Otra…</option>
                            </select>
                          ) : (
                            <Input id={`${formId}-${dayIdx}-sport`} enterKeyHint="next" value={plan.sport || ""} onChange={(e) => updateDay(dayIdx, { sport: e.target.value })} placeholder="Escalada, running…" />
                          )}
                        </div>
                        <div>
                          <Label htmlFor={`${formId}-${dayIdx}-intensity`} className={LABEL}>Intensidad</Label>
                          <select id={`${formId}-${dayIdx}-intensity`} className={FIELD} value={plan.intensity || "Media"} onChange={(e) => updateDay(dayIdx, { intensity: e.target.value })}>
                            {INTENSITIES.map((i) => <option key={i} value={i}>{i}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor={`${formId}-${dayIdx}-duration`} className={LABEL}>Duración</Label>
                          <Input id={`${formId}-${dayIdx}-duration`} enterKeyHint="done" value={plan.duration || ""} onChange={(e) => updateDay(dayIdx, { duration: e.target.value })} placeholder="45min" />
                        </div>
                      </div>
                    )}

                    {plan.type === "gimnasio" && (
                      <div className="space-y-4">
                        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor={`${formId}-${dayIdx}-routine`} className={LABEL}>Nombre de la rutina</Label>
                            <Input id={`${formId}-${dayIdx}-routine`} enterKeyHint="next" value={plan.routine_name || ""} onChange={(e) => updateDay(dayIdx, { routine_name: e.target.value })} placeholder="Push A, piernas…" />
                          </div>
                          <div>
                            <Label htmlFor={`${formId}-${dayIdx}-muscles`} className={LABEL}>Músculos principales</Label>
                            <Input id={`${formId}-${dayIdx}-muscles`} enterKeyHint="next" value={plan.muscle_focus || ""} onChange={(e) => updateDay(dayIdx, { muscle_focus: e.target.value })} placeholder="Pecho · Tríceps" />
                          </div>
                        </div>

                        <div>
                          {(plan.exercises || []).map((ex, exIdx) => {
                            const exerciseId = `${formId}-exercise-${dayIdx}-${exIdx}`;
                            return (
                              <div key={exIdx} className="min-w-0 space-y-3 py-4 sep-t">
                                <div className="flex min-w-0 items-end gap-2">
                                  <button type="button" onClick={() => { void hapticTap(); setPreview({ name: ex.name, image: ex.image_url, video: ex.video_url }); }} aria-label={`Ver técnica de ${ex.name || "este ejercicio"}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-media transition-opacity active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                    <ExerciseThumb image={ex.image_url} video={ex.video_url} name={ex.name} size="xs" />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <Label htmlFor={exerciseId} className={LABEL}>Ejercicio</Label>
                                    <select id={exerciseId} className={FIELD} value={ex.exercise_id} onChange={(event) => selectExerciseFromLibrary(dayIdx, exIdx, event.target.value)}>
                                      <option value="">Seleccionar…</option>
                                      {ex.exercise_id && !exercises.some((exercise) => exercise.id === ex.exercise_id) && <option value={ex.exercise_id}>{ex.name || "Ejercicio guardado"}</option>}
                                      {Object.entries(groupedExercises).map(([group, exs]) => <optgroup key={group} label={group}>{exs.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</optgroup>)}
                                    </select>
                                  </div>
                                  <button type="button" onClick={() => { void hapticTap(); removeGymExercise(dayIdx, exIdx); }} aria-label={`Eliminar ejercicio ${exIdx + 1}${ex.name ? `: ${ex.name}` : ""}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-destructive transition-[background-color,transform] duration-150 active:scale-[0.97] active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"><Trash2 className="h-5 w-5" aria-hidden="true" /></button>
                                </div>
                                {ex.name && <p className="break-words type-footnote text-muted-foreground">{ex.name}</p>}
                                <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
                                  <div className="min-w-0"><Label htmlFor={`${exerciseId}-series`} className={LABEL}>Series</Label><Input id={`${exerciseId}-series`} type="number" inputMode="numeric" pattern="[0-9]*" enterKeyHint="next" min={1} className="tabular-nums" value={ex.series} onChange={(event) => updateGymExercise(dayIdx, exIdx, { series: parseInt(event.target.value) || 0 })} /></div>
                                  <div className="min-w-0"><Label htmlFor={`${exerciseId}-reps`} className={LABEL}>Repeticiones</Label><Input id={`${exerciseId}-reps`} type="number" inputMode="numeric" pattern="[0-9]*" enterKeyHint="next" min={1} className="tabular-nums" value={ex.reps} onChange={(event) => updateGymExercise(dayIdx, exIdx, { reps: parseInt(event.target.value) || 0 })} /></div>
                                  <div className="min-w-0"><Label htmlFor={`${exerciseId}-weight`} className={LABEL}>Peso</Label><Input id={`${exerciseId}-weight`} enterKeyHint="next" value={ex.weight} onChange={(event) => updateGymExercise(dayIdx, exIdx, { weight: event.target.value })} placeholder="kg o corporal" /></div>
                                  <div className="min-w-0"><Label htmlFor={`${exerciseId}-rest`} className={LABEL}>Descanso</Label><Input id={`${exerciseId}-rest`} enterKeyHint="done" value={ex.rest} onChange={(event) => updateGymExercise(dayIdx, exIdx, { rest: event.target.value })} placeholder="60s" /></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <Button variant="tinted" size="sm" onClick={() => { void hapticTap(); addGymExercise(dayIdx); }} className="min-h-11">
                          Añadir ejercicio
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ExercisePreviewSheet exercise={preview} onClose={() => setPreview(null)} />
    </div>
  );
});
TrainingPlanForm.displayName = "TrainingPlanForm";

export default TrainingPlanForm;
