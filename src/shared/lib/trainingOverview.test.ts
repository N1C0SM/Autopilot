import { describe, expect, it } from "vitest";
import { buildTrainingOverview, type ExerciseHistoryEntry } from "@/shared/lib/workoutMetrics";

const entry = (date: string, volumeKg: number): ExerciseHistoryEntry => ({
  date, sessionLabel: date, volumeKg, bestEstimated1RmKg: null, completedSets: 3, loadedSets: 3, reps: 24, bestSetLabel: null,
});

describe("buildTrainingOverview", () => {
  // Jueves 23 oct 2026: la semana empieza el lunes 19.
  const now = new Date(2026, 9, 23, 12);

  it("adds volume and counts one session per training day, by week", () => {
    const overview = buildTrainingOverview({
      Press: [entry("2026-10-19", 400), entry("2026-10-20", 300)],
      Remo: [entry("2026-10-19", 100), entry("2026-10-12", 250)],
    }, 4, now);
    expect(overview.weeks.map((w) => w.weekStart)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]);
    expect(overview.weeks[3]).toEqual({ weekStart: "2026-10-19", volumeKg: 800, sessions: 2 });
    expect(overview.weeks[2]).toEqual({ weekStart: "2026-10-12", volumeKg: 250, sessions: 1 });
    expect(overview.totalSessions).toBe(3);
    expect(overview.last4WeeksVolumeKg).toBe(1050);
    expect(overview.streakWeeks).toBe(2);
  });

  it("keeps the streak alive when this week has no session yet", () => {
    const overview = buildTrainingOverview({ Press: [entry("2026-10-14", 100), entry("2026-10-07", 100)] }, 8, now);
    expect(overview.streakWeeks).toBe(2);
  });

  it("is empty without history", () => {
    const overview = buildTrainingOverview({}, 8, now);
    expect(overview.weeks).toHaveLength(8);
    expect(overview.totalSessions).toBe(0);
    expect(overview.streakWeeks).toBe(0);
  });
});
