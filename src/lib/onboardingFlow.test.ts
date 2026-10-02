import { describe, expect, it } from "vitest";
import { canSkipOnboardingStep, getAboutStepError, getOnboardingSteps } from "./onboardingFlow";

describe("onboarding first-day flow", () => {
  it("starts with the user's training focus and adds a skill question only when needed", () => {
    expect(getOnboardingSteps("gain_muscle").slice(0, 3)).toEqual(["focus_goal", "about", "sports_schedule"]);
    expect(getOnboardingSteps("skill_based").slice(0, 3)).toEqual(["focus_goal", "about", "specific_goal"]);
  });

  it("lets users skip optional questions but not the goal or final confirmation", () => {
    expect(canSkipOnboardingStep("about")).toBe(true);
    expect(canSkipOnboardingStep("health")).toBe(true);
    expect(canSkipOnboardingStep("focus_goal")).toBe(false);
    expect(canSkipOnboardingStep("summary")).toBe(false);
  });

  it("validates only optional profile values the user chose to enter", () => {
    const empty = { age: "", height: "", weight: "" };
    expect(getAboutStepError(empty)).toBeNull();
    expect(getAboutStepError({ ...empty, age: "15" })).toContain("edad");
    expect(getAboutStepError({ ...empty, height: "300" })).toContain("altura");
    expect(getAboutStepError({ ...empty, weight: "20" })).toContain("peso");
  });
});
