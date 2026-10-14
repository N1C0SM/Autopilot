import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PRsList from "./PRsList";

const mocks = vi.hoisted(() => ({ limit: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: mocks.limit }) }) }),
    }),
  },
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("personal records", () => {
  it("keeps the best estimated 1RM per exercise and shows weight, reps and 1RM", async () => {
    mocks.limit.mockResolvedValue({
      data: [
        { id: "a", exercise_name: "Press banca", weight: 80, reps: 5, estimated_1rm: 93, achieved_at: "2026-10-01T10:00:00Z" },
        { id: "b", exercise_name: "Press banca", weight: 70, reps: 5, estimated_1rm: 82, achieved_at: "2026-09-01T10:00:00Z" },
        { id: "c", exercise_name: "Sentadilla", weight: 100, reps: 3, estimated_1rm: 110, achieved_at: "2026-10-02T10:00:00Z" },
      ],
      error: null,
    });
    render(<PRsList userId="user" />);

    expect(await screen.findByText("Press banca")).toBeVisible();
    expect(screen.getByText("80 kg × 5")).toBeVisible();
    expect(screen.getByText(/1RM ~93 kg/)).toBeVisible();
    expect(screen.queryByText("70 kg × 5")).not.toBeInTheDocument();
    expect(screen.getByText("Sentadilla")).toBeVisible();
  });

  it("leads with the best estimated 1RM", async () => {
    mocks.limit.mockResolvedValue({
      data: [
        { id: "a", exercise_name: "Press banca", weight: 80, reps: 5, estimated_1rm: 93, achieved_at: "2026-10-01T10:00:00Z" },
        { id: "c", exercise_name: "Sentadilla", weight: 100, reps: 3, estimated_1rm: 110, achieved_at: "2026-10-02T10:00:00Z" },
      ],
      error: null,
    });
    render(<PRsList userId="user" />);

    const hero = await screen.findByRole("region", { name: "Tu mejor marca" });
    expect(hero).toHaveTextContent("110");
    expect(hero).toHaveTextContent("1RM estimado en Sentadilla");
  });

  it("shows the empty state when there are no records", async () => {
    mocks.limit.mockResolvedValue({ data: [], error: null });
    render(<PRsList userId="user" />);

    expect(await screen.findByText("Sin récords aún")).toBeVisible();
  });
});
