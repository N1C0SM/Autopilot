import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExerciseHistoryEntry } from "@/lib/workoutMetrics";
import ExerciseProgressChart from "./ExerciseProgressChart";

const mocks = vi.hoisted(() => ({ hapticSelection: vi.fn(), isNative: vi.fn().mockReturnValue(false) }));
vi.mock("@/lib/native", () => ({ hapticSelection: mocks.hapticSelection, isNative: mocks.isNative }));

type Metric = "volumeKg" | "reps" | "bestEstimated1RmKg";

const entry = (overrides: Partial<ExerciseHistoryEntry> = {}): ExerciseHistoryEntry => ({
  date: "2026-10-01",
  sessionLabel: "1 oct",
  volumeKg: 1000,
  bestEstimated1RmKg: 100,
  completedSets: 4,
  loadedSets: 4,
  reps: 32,
  bestSetLabel: null,
  ...overrides,
});

const Harness = ({ history, onChange }: { history: ExerciseHistoryEntry[]; onChange: (metric: Metric) => void }) => {
  const [metric, setMetric] = useState<Metric>("bestEstimated1RmKg");
  return (
    <ExerciseProgressChart
      exerciseName="Press banca"
      history={history}
      metric={metric}
      onMetricChange={(next) => {
        onChange(next);
        setMetric(next);
      }}
    />
  );
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("exercise progress chart", () => {
  it("switches metric from the segmented control and keeps the tab semantics", () => {
    const onChange = vi.fn();
    render(<Harness history={[entry()]} onChange={onChange} />);

    expect(screen.getByRole("tablist", { name: "Métrica" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "1RM" })).toHaveAttribute("aria-selected", "true");

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Volumen" }), { button: 0 });

    expect(onChange).toHaveBeenCalledWith("volumeKg");
    expect(screen.getByRole("tab", { name: "Volumen" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "1RM" })).toHaveAttribute("aria-selected", "false");
    expect(mocks.hapticSelection).toHaveBeenCalledTimes(1);
  });

  it("shows the starting point until there are two sessions to draw", () => {
    render(<Harness history={[entry()]} onChange={vi.fn()} />);

    expect(screen.getByText(/Punto de partida/)).toBeVisible();
    expect(screen.queryByRole("img", { name: "Gráfica de Press banca" })).not.toBeInTheDocument();
  });

  it("says there is no load to chart instead of drawing placeholder bars", () => {
    render(
      <Harness
        history={[
          entry({ bestEstimated1RmKg: null, loadedSets: 0, volumeKg: 0 }),
          entry({ date: "2026-10-08", sessionLabel: "8 oct", bestEstimated1RmKg: null, loadedSets: 0, volumeKg: 0 }),
        ]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Sin carga registrada")).toBeVisible();
    expect(screen.queryByText(/Punto de partida/)).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Gráfica de Press banca" })).not.toBeInTheDocument();
  });

  it("renders the chart region once there are two sessions", () => {
    render(
      <Harness
        history={[entry(), entry({ date: "2026-10-08", sessionLabel: "8 oct", bestEstimated1RmKg: 105 })]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "Gráfica de Press banca" })).toBeInTheDocument();
    expect(screen.getByText("105")).toBeVisible();
  });
});
