export type OnboardingStepKey =
  | "about"
  | "focus_goal"
  | "specific_goal"
  | "sports_schedule"
  | "level"
  | "health"
  | "training_style"
  | "summary";

export const OPTIONAL_ONBOARDING_STEPS: OnboardingStepKey[] = [
  "about",
  "specific_goal",
  "sports_schedule",
  "level",
  "health",
];

export function getOnboardingSteps(goal: string): OnboardingStepKey[] {
  return [
    "focus_goal",
    "about",
    ...(goal === "skill_based" ? ["specific_goal" as const] : []),
    "sports_schedule",
    "level",
    "health",
    "training_style",
    "summary",
  ];
}

export function getAboutStepError(data: {
  age: string;
  height: string;
  weight: string;
}): string | null {
  if (data.age) {
    const age = Number(data.age);
    if (!Number.isInteger(age) || age < 16 || age > 100) return "La edad debe estar entre 16 y 100 años.";
  }
  if (data.height) {
    const height = Number(data.height);
    if (!Number.isFinite(height) || height < 100 || height > 250) return "La altura debe estar entre 100 y 250 cm.";
  }
  if (data.weight) {
    const weight = Number(data.weight);
    if (!Number.isFinite(weight) || weight < 30 || weight > 350) return "El peso debe estar entre 30 y 350 kg.";
  }
  return null;
}

export function canSkipOnboardingStep(step: OnboardingStepKey): boolean {
  return OPTIONAL_ONBOARDING_STEPS.includes(step);
}
