import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { DayPlan } from "@/types/training";
import { hapticImpact, hapticNotify } from "@/lib/native";
import WorkoutTracker from "./WorkoutTracker";
import { readActiveWorkout } from "@/lib/activeWorkout";
import { setWorkoutView } from "@/lib/workoutPreferences";

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
vi.mock("@/lib/native", () => ({ hapticTap: vi.fn(), hapticSelection: vi.fn(), hapticImpact: vi.fn(), hapticNotify: vi.fn(), isNative: vi.fn().mockReturnValue(false) }));
vi.mock("@/hooks/useExerciseMetadata", () => ({ useExerciseMetadata: () => ({ byId: {}, byName: {} }) }));
vi.mock("@/components/ExerciseMedia", () => ({ ExerciseThumb: () => null }));
vi.mock("@/components/ExerciseFocus", () => ({ default: () => null }));
vi.mock("./WorkoutStoryShare", () => ({ WorkoutStoryShare: () => null }));
vi.mock("./WorkoutStudyCards", () => ({ WorkoutStudyCards: ({ intro, onFinish }: { intro: ReactNode; onFinish?: () => void }) => <>{intro}<p>Resumen guardado</p>{onFinish && <button onClick={onFinish}>Cerrar resumen</button>}</> }));
vi.mock("./ExerciseSwap", () => ({ ExerciseSwap: () => null }));
vi.mock("./RPEDialog", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: (rpe: number | null) => void }) => open ? (
    <>
      <button onClick={() => onConfirm(7)}>Guardar esfuerzo</button>
      <button onClick={() => onConfirm(null)}>Completar sin valorar esfuerzo</button>
    </>
  ) : null,
}));
const plan = (day: string, name: string): DayPlan => ({ day, type: "gimnasio", routine_name: name, exercises: [{ exercise_id: name, name, series: 1, reps: 8, weight: "20", rest: "60 s" }] });
const week = "Elige el día de la semana";
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks(); mocks.writes = []; mocks.completedDays = []; mocks.saveFails = false;
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-04T12:00:00"));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("routine week navigation and saved session dates", () => {
  it("recovers edited sets and the virtual free plan after unmounting", async () => {
    const freePlan = plan("Lunes", "Remo libre");
    const first = render(<WorkoutTracker userId="user" dayPlans={[freePlan]} initialDay="Lunes" />);
    fireEvent.click(await screen.findByRole("button", { name: "Empezar entrenamiento" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Peso de la serie 1 de Remo libre" }), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar serie 1 de Remo libre" }));
    expect(readActiveWorkout("user")?.logs["Remo libre"][0]).toMatchObject({ weight: "42", done: true });
    first.unmount();
    render(<WorkoutTracker userId="user" dayPlans={[]} resume />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Peso de la serie 1 de Remo libre" })).toHaveValue("42"));
    expect(screen.getByRole("button", { name: "Desmarcar serie 1 de Remo libre" })).toBeVisible();
  });
  it("resynchronizes rest after 45 seconds without waiting for 45 interval ticks", async () => {
    render(<WorkoutTracker userId="user" dayPlans={[plan("Lunes", "Remo")]} initialDay="Lunes" />);
    fireEvent.click(await screen.findByRole("button", { name: "Empezar entrenamiento" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar serie 1 de Remo" }));
    vi.setSystemTime(new Date("2026-10-04T12:00:45"));
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("timer")).toHaveTextContent("0:15");
    vi.setSystemTime(new Date("2026-10-04T12:01:00"));
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(screen.queryByRole("timer")).not.toBeInTheDocument());
  });
  it("keeps either view on the same set log and adds one working set", async () => {
    render(<WorkoutTracker userId="user" dayPlans={[{ ...plan("Lunes", "Remo"), exercises: [...(plan("Lunes", "Remo").exercises || []), ...(plan("Lunes", "Press").exercises || [])] }]} initialDay="Lunes" />);
    fireEvent.click(await screen.findByRole("button", { name: "Empezar entrenamiento" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir serie" }));
    expect(readActiveWorkout("user")?.logs.Remo).toHaveLength(2);
    act(() => { setWorkoutView("user", "focus"); });
    expect(readActiveWorkout("user")?.logs.Remo).toHaveLength(2);
    act(() => { setWorkoutView("user", "list"); });
    expect(readActiveWorkout("user")?.logs.Remo).toHaveLength(2);
  });
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
    expect(hapticImpact).toHaveBeenCalledWith("medium");
    fireEvent.click(screen.getByRole("button", { name: "Terminar entrenamiento" }));
    // El cierre pasa por el RPE: se puede omitir con este botón.
    fireEvent.click(await screen.findByRole("button", { name: "Completar sin valorar esfuerzo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cerrar resumen" }));
    expect(hapticNotify).toHaveBeenCalledWith("success");
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

  it("asks for the decimal and numeric keypads and keeps set fields at a size iOS will not zoom", async () => {
    render(<WorkoutTracker userId="user" dayPlans={[plan("Lunes", "Sentadilla")]} initialDay="Lunes" />);
    fireEvent.click(await screen.findByRole("button", { name: "Empezar entrenamiento" }));
    const weight = screen.getByRole("textbox", { name: "Peso de la serie 1 de Sentadilla" });
    const reps = screen.getByRole("textbox", { name: "Repeticiones de la serie 1 de Sentadilla" });
    expect(weight).toHaveAttribute("inputmode", "decimal");
    expect(reps).toHaveAttribute("inputmode", "numeric");
    expect(reps).toHaveAttribute("pattern", "[0-9]*");
    for (const field of [weight, reps]) expect(field.className).toMatch(/\btype-headline\b/);
  });
  it("pide confirmación antes de terminar con series pendientes", async () => {
    const twoSets: DayPlan = { ...plan("Viernes", "Press banca"), exercises: [{ exercise_id: "press", name: "Press banca", series: 2, reps: 8, weight: "20", rest: "60 s" }] };
    render(<WorkoutTracker userId="user" dayPlans={[twoSets]} initialDay="Viernes" />);
    fireEvent.click(await screen.findByRole("button", { name: "Empezar entrenamiento" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar serie 1 de Press banca" }));
    fireEvent.click(screen.getByRole("button", { name: "Terminar entrenamiento" }));

    expect(await screen.findByText("¿Terminar con series pendientes?")).toBeVisible();
    expect(mocks.writes.some((write) => write.table === "day_completions")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Seguir entrenando" }));
    // La hoja inferior puede quedar montada durante su animación de cierre; basta con que esté cerrada.
    await waitFor(() => {
      const sheet = screen.queryByRole("dialog", { name: "¿Terminar con series pendientes?" });
      expect(sheet === null || sheet.getAttribute("data-state") === "closed").toBe(true);
    });
    expect(mocks.writes.some((write) => write.table === "day_completions")).toBe(false);
  });

  it("permite marcar y desmarcar un día de actividad", async () => {
    const actividad: DayPlan = { day: "Viernes", type: "actividad", sport: "Running", intensity: "Media", duration: "30 min" };
    render(<WorkoutTracker userId="user" dayPlans={[actividad]} initialDay="Viernes" />);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar actividad como hecha" }));
    await waitFor(() => expect(mocks.writes.find((write) => write.table === "day_completions")?.rows).toMatchObject({ day_label: "Viernes", completed_at: "2026-10-04" }));
    expect(await screen.findByRole("button", { name: "Desmarcar actividad" })).toBeVisible();
  });

});
