import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { DayPlan } from "@/types/training";
import WorkoutTracker from "./WorkoutTracker";

const mocks = vi.hoisted(() => ({ writes: [] as { table: string; rows: unknown }[], completedDays: [] as string[], saveFails: false, toastError: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const filters: Record<string, string> = {};
    const query = {
      select: () => query,
      eq: (key: string, value: string) => { filters[key] = value; return query; },
      lt: () => query, order: () => query, limit: () => query, maybeSingle: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "day_completions" ? mocks.completedDays.includes(filters.day_label) ? { id: "done", rpe: 7 } : null : [], error: null }).then(resolve),
      upsert: (rows: unknown) => { mocks.writes.push({ table, rows }); return Promise.resolve({ error: mocks.saveFails ? new Error("offline") : null }); },
    };
    return query;
  },
} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.toastError } }));
vi.mock("@/lib/native", () => ({ hapticTap: vi.fn() }));
vi.mock("@/hooks/useExerciseMetadata", () => ({ useExerciseMetadata: () => ({ byId: {}, byName: {} }) }));
vi.mock("@/components/ExerciseMedia", () => ({ ExerciseThumb: () => null }));
vi.mock("@/components/ExerciseFocus", () => ({ default: () => null }));
vi.mock("./WorkoutStoryShare", () => ({ WorkoutStoryShare: () => null }));
vi.mock("./WorkoutStudyCards", () => ({ WorkoutStudyCards: ({ intro, onFinish }: { intro: ReactNode; onFinish?: () => void }) => <>{intro}<p>Resumen guardado</p>{onFinish && <button onClick={onFinish}>Cerrar resumen</button>}</> }));
vi.mock("./ExerciseSwap", () => ({ ExerciseSwap: () => null }));
vi.mock("./RPEDialog", () => ({ default: () => null }));
const plan = (day: string, name: string): DayPlan => ({ day, type: "gimnasio", routine_name: name, exercises: [{ exercise_id: name, name, series: 1, reps: 8, weight: "20", rest: "60 s" }] });
const week = "Elige el día de la semana";
beforeEach(() => {
  vi.clearAllMocks(); mocks.writes = []; mocks.completedDays = []; mocks.saveFails = false;
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-04T12:00:00"));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("routine week navigation and saved session dates", () => {
  it("opens any routine from a rest Sunday without writing previewed sets", async () => {
    render(<WorkoutTracker userId="user" dayPlans={[plan("Lunes", "Sentadilla")]} />);
    await waitFor(() => expect(screen.getByText("Día de descanso")).toBeVisible());
    expect(screen.getAllByRole("tab")).toHaveLength(7);
    fireEvent.click(screen.getByRole("tab", { name: "Lunes" }));
    expect(await screen.findByRole("button", { name: "Empezar entrenamiento" })).toBeVisible();
    expect(screen.getByText(/Se registra hoy/)).toHaveTextContent("4 de octubre");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 850)); });
    expect(mocks.writes).toHaveLength(0);
  });
  it("saves a Friday routine on the actual Sunday and prevents switching during the session", async () => {
    render(<WorkoutTracker userId="user" dayPlans={[plan("Viernes", "Press banca")]} />);
    fireEvent.click(screen.getByRole("tab", { name: "Viernes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Empezar entrenamiento" }));
    expect(screen.queryByRole("tablist", { name: week })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Peso de la serie 1 de Press banca" }), { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    await waitFor(() => expect(screen.getByRole("tablist", { name: week })).toBeVisible());
    expect(mocks.writes).toEqual([{ table: "workout_logs", rows: [expect.objectContaining({ day_label: "Viernes", logged_at: "2026-10-04", exercise_name: "Press banca", sets_completed: [expect.objectContaining({ weight: "35" })] })] }]);
    fireEvent.click(screen.getByRole("tab", { name: /Domingo/ }));
    await waitFor(() => expect(screen.getByText("Día de descanso")).toBeVisible());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 850)); });
    expect(mocks.writes).toHaveLength(1);
  });
  it("keeps the session open when saving fails", async () => {
    mocks.saveFails = true;
    render(<WorkoutTracker userId="user" dayPlans={[plan("Lunes", "Sentadilla")]} initialDay="Lunes" />);
    fireEvent.click(await screen.findByRole("button", { name: "Empezar entrenamiento" }));
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(screen.queryByRole("tablist", { name: week })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Peso de la serie 1 de Sentadilla" })).toBeVisible());
  });
  it("completes an off-schedule routine on today's date and returns to the week", async () => {
    const onSessionModeChange = vi.fn();
    render(<WorkoutTracker userId="user" dayPlans={[plan("Viernes", "Press banca")]} initialDay="Viernes" onSessionModeChange={onSessionModeChange} />);
    fireEvent.click(await screen.findByRole("button", { name: "Empezar entrenamiento" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar serie 1 de Press banca" }));
    fireEvent.click(screen.getByRole("button", { name: "Terminar entrenamiento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cerrar resumen" }));
    await waitFor(() => expect(screen.getByRole("tablist", { name: week })).toBeVisible());
    expect(mocks.writes.find((write) => write.table === "day_completions")?.rows).toEqual({ user_id: "user", day_label: "Viernes", completed_at: "2026-10-04", rpe: null });
    expect(onSessionModeChange).toHaveBeenLastCalledWith(false);
  });
  it("allows opening another routine after one is already completed", async () => {
    mocks.completedDays = ["Lunes"];
    render(<WorkoutTracker userId="user" dayPlans={[plan("Lunes", "Sentadilla"), plan("Martes", "Dominadas")]} initialDay="Lunes" />);
    expect(await screen.findByText("Resumen guardado")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Martes" }));
    expect(await screen.findByRole("button", { name: "Empezar entrenamiento" })).toBeVisible();
    expect(screen.getAllByText("Dominadas").length).toBeGreaterThan(0);
    expect(mocks.writes).toHaveLength(0);
  });
  it("today's CTA starts today's routine rather than the previously viewed one", async () => {
    vi.setSystemTime(new Date("2026-10-07T12:00:00"));
    const onAutoStartConsumed = vi.fn(); const dayPlans = [plan("Miércoles", "Sentadilla"), plan("Viernes", "Press banca")];
    const { rerender } = render(<WorkoutTracker userId="user" dayPlans={dayPlans} initialDay="Viernes" onAutoStartConsumed={onAutoStartConsumed} />);
    await screen.findByRole("button", { name: "Empezar entrenamiento" });
    rerender(<WorkoutTracker userId="user" dayPlans={dayPlans} initialDay="Viernes" autoStart onAutoStartConsumed={onAutoStartConsumed} />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Peso de la serie 1 de Sentadilla" })).toBeVisible());
    expect(screen.queryByRole("textbox", { name: "Peso de la serie 1 de Press banca" })).not.toBeInTheDocument();
    expect(onAutoStartConsumed).toHaveBeenCalled();
  });
  it("never auto-starts another routine when today is a rest day", async () => {
    const onAutoStartConsumed = vi.fn();
    render(<WorkoutTracker userId="user" dayPlans={[plan("Lunes", "Sentadilla")]} initialDay="Lunes" autoStart onAutoStartConsumed={onAutoStartConsumed} />);
    await waitFor(() => expect(onAutoStartConsumed).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Día de descanso")).toBeVisible());
    expect(screen.getByRole("tab", { name: /Domingo/ })).toHaveAttribute("aria-selected", "true");
    expect(mocks.writes).toHaveLength(0);
  });

  it("refreshes the actual date after midnight before starting a new routine", async () => {
    const dayPlans = [plan("Lunes", "Sentadilla")];
    const { rerender } = render(<WorkoutTracker userId="user" dayPlans={dayPlans} initialDay="Lunes" />);
    await screen.findByRole("button", { name: "Empezar entrenamiento" });
    vi.setSystemTime(new Date("2026-10-05T00:05:00"));
    rerender(<WorkoutTracker userId="user" dayPlans={dayPlans} initialDay="Lunes" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Empezar entrenamiento" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Empezar entrenamiento" }));
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    await waitFor(() => expect(mocks.writes).toHaveLength(1));
    expect(mocks.writes[0].rows).toEqual([expect.objectContaining({ day_label: "Lunes", logged_at: "2026-10-05" })]);
  });
});
