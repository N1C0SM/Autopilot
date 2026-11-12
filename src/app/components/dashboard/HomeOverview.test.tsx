import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomeOverview from "@/app/components/dashboard/HomeOverview";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";

const mocks = vi.hoisted(() => ({
  hapticTap: vi.fn(),
  ios: false,
  isNative: vi.fn().mockReturnValue(false),
  /** Portada de IA devuelta por useSessionCover (null = sin portada aún). */
  cover: null as string | null,
}));
vi.mock("@/shared/lib/native", () => ({ hapticTap: mocks.hapticTap, isNative: mocks.isNative }));
vi.mock("@/shared/lib/platform", () => ({ isIOSNative: () => mocks.ios }));
// La portada de IA y los metadatos de ejercicios son red: aquí lo que se prueba es
// el respaldo (la foto del día siempre es real), no la edge function.
vi.mock("@/shared/hooks/useSessionCover", () => ({ useSessionCover: () => mocks.cover }));
vi.mock("@/shared/hooks/useExerciseMetadata", () => ({ useExerciseMetadata: () => ({ byId: {}, byName: {} }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ios = false;
  mocks.cover = null;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const today = DAYS[(new Date().getDay() + 6) % 7];

describe("dashboard home overview", () => {
  it("shows today's session as the primary action and previews it before opening the workout", () => {
    const onNavigate = vi.fn();
    const onStartWorkout = vi.fn();
    render(
      <HomeOverview
        dayPlans={[{ day: today, type: "gimnasio", routine_name: "Pull B", muscle_focus: "Espalda · Bíceps", exercises: [{ exercise_id: "squat", name: "Sentadilla", series: 3, reps: 8, weight: "", rest: "90 s" }] }]}
        onNavigate={onNavigate}
        onStartWorkout={onStartWorkout}
        profileName="Nicolás Pérez"
      />,
    );

    // Diseño de ChatGPT: «Hoy» pequeño, el nombre grande y una línea en gris.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Hoy");
    expect(screen.getByText("Nicolás")).toBeVisible();
    expect(screen.getByText("La constancia crea el cambio.")).toBeVisible();
    // El saludo es corto: la sesión se nombra solo en su tarjeta.
    expect(screen.queryByText(/Hoy toca/)).not.toBeInTheDocument();
    const startButton = screen.getByRole("button", { name: "Ver la sesión Pull B · Espalda y bíceps" });
    expect(within(startButton).getByText("Pull B")).toBeVisible();
    expect(within(startButton).getByText("Entrenamiento")).toBeVisible();
    expect(startButton).toHaveTextContent("5 min · 1 ejercicio");
    fireEvent.click(startButton);
    expect(within(screen.getByRole("dialog")).getByText("Sentadilla")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Empezar entrenamiento" }));
    expect(onStartWorkout).toHaveBeenCalledWith(today);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(mocks.hapticTap).toHaveBeenCalledTimes(2);
  });

  it("starts the session in one tap from the round gold button", () => {
    const onStartWorkout = vi.fn();
    render(
      <HomeOverview
        dayPlans={[{ day: today, type: "gimnasio", routine_name: "Pull B", exercises: [{ exercise_id: "row", name: "Remo", series: 3, reps: 8, weight: "", rest: "90 s" }] }]}
        onNavigate={vi.fn()}
        onStartWorkout={onStartWorkout}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Empezar Pull B" }));
    expect(onStartWorkout).toHaveBeenCalledWith(today);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("follows the iPhone order on every width: session, today's figures and the plan", () => {
    render(
      <HomeOverview
        dayPlans={[{
          day: "Lunes",
          type: "gimnasio",
          routine_name: "Upper A",
          muscle_focus: "Pecho, espalda, hombros",
          exercises: [
            { exercise_id: "bench", name: "Press banca plano", series: 4, reps: 8, weight: "", rest: "2 min" },
            { exercise_id: "row", name: "Remo sentado", series: 3, reps: 10, weight: "", rest: "90 s" },
          ],
        }]}
        onNavigate={vi.fn()}
      />,
    );

    const week = screen.getByRole("list", { name: "Esta semana" });
    const mainAction = screen.getByRole("button", { name: "Ver la sesión Upper A · Pecho, espalda y hombros" });
    const figures = screen.getByRole("region", { name: "Tu día" });
    const plan = screen.getByRole("region", { name: "Tu plan" });
    for (const [before, after] of [[week, mainAction], [mainAction, figures], [figures, plan]]) {
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // La web ancha es el iPhone más grande: nada se esconde ni aparece según el ancho.
    for (const element of [week, mainAction, figures, plan]) {
      expect(element.className).not.toMatch(/(^|\s)(lg:)?hidden|lg:block/);
    }
    expect(within(week).getAllByRole("listitem")).toHaveLength(7);
    expect(screen.queryByRole("button", { name: /Tu progreso/ })).not.toBeInTheDocument();
  });

  it("shows the native-style empty state without routine rows when no routine exists", () => {
    const onPrepareRoutine = vi.fn();
    render(
      <HomeOverview
        dayPlans={[]}
        hasPlan={false}
        nutrition={false}
        onNavigate={vi.fn()}
        onPrepareRoutine={onPrepareRoutine}
      />,
    );

    expect(screen.getByText("Prepara tu rutina inicial gratis")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Preparar mi rutina gratis" }));
    expect(onPrepareRoutine).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region", { name: "Tu plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tu progreso/ })).not.toBeInTheDocument();
  });

  it("proposes the next pending session whatever the weekday and marks the trained days of the week", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T12:00:00")); // domingo: no cambia nada
    const onNavigate = vi.fn();
    const onStartWorkout = vi.fn();
    render(
      <HomeOverview
        dayPlans={[
          { day: "Lunes", type: "gimnasio", routine_name: "Piernas", exercises: [] },
          { day: "Jueves", type: "gimnasio", routine_name: "Empuje", exercises: [] },
          { day: "Sábado", type: "actividad", sport: "Correr", duration: "30 min" },
        ]}
        completedDays={["Lunes"]}
        completedThisWeek={1}
        trainedDates={["2026-09-30"]}
        onNavigate={onNavigate}
        onStartWorkout={onStartWorkout}
      />,
    );

    // Sin «descanso» por ser domingo: toca la siguiente que falta.
    expect(screen.queryByText(/descans/i)).not.toBeInTheDocument();
    // La tira es la semana de lunes a domingo: hoy con borde y un punto en los días entrenados.
    const week = within(screen.getByRole("list", { name: "Esta semana" })).getAllByRole("listitem");
    expect(week.map((day) => day.getAttribute("aria-label"))).toEqual([
      "lunes 28", "martes 29", "miércoles 30, entrenaste", "jueves 1", "viernes 2", "sábado 3", "domingo 4, hoy",
    ]);
    expect(week[6]).toHaveAttribute("aria-current", "date");
    const startButton = screen.getByRole("button", { name: "Ver la sesión Empuje" });
    expect(startButton).toBeVisible();
    const plan = screen.getByRole("region", { name: "Tu plan" });
    expect(within(plan).getByText("1 de 3 sesiones completadas")).toBeVisible();
    expect(within(plan).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(within(plan).getByRole("button", { name: "Ver sesión Piernas, hecha esta semana" })).toBeVisible();
    fireEvent.click(startButton);
    expect(onStartWorkout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Empezar entrenamiento" }));
    expect(onStartWorkout).toHaveBeenCalledWith("Jueves");
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("paints a real photo of today's session on a gym day, falling back to the brand photo", () => {
    const { container } = render(
      <HomeOverview
        dayPlans={[{ day: today, type: "gimnasio", routine_name: "Pull B", exercises: [{ exercise_id: "row", name: "Remo", series: 4, reps: 8, weight: "", rest: "2 min" }] }]}
        onNavigate={vi.fn()}
      />,
    );

    const photo = container.querySelector("img");
    expect(photo).not.toBeNull();
    expect(photo).toHaveAttribute("src", BRAND_PHOTOS.gym);
    // Es decorativa: el texto ya dice todo lo que hace falta.
    expect(photo?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("prefers the session cover when there is one", () => {
    mocks.cover = "https://cdn.example.com/cover.jpg";
    const { container } = render(
      <HomeOverview dayPlans={[{ day: today, type: "gimnasio", exercises: [{ exercise_id: "row", name: "Remo", series: 3, reps: 8, weight: "", rest: "90 s" }] }]} onNavigate={vi.fn()} />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn.example.com/cover.jpg");
  });

  it("does not invent a session photo on a rest day: only the decorative brand photo", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T12:00:00"));
    const { container } = render(<HomeOverview dayPlans={[{ day: "Lunes", type: "gimnasio", exercises: [] }]} completedDays={["Lunes"]} onNavigate={vi.fn()} />);
    expect(screen.getByText("Toca recuperar")).toBeVisible();
    const images = Array.from(container.querySelectorAll("img"));
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", BRAND_PHOTOS.gym);
    expect(images[0]).toHaveAttribute("aria-hidden", "true");
  });

  it("sums up the day in three figures that open nutrition and training", () => {
    const onNavigate = vi.fn();
    render(
      <HomeOverview
        dayPlans={[
          { day: "Lunes", type: "gimnasio", exercises: [] },
          { day: "Martes", type: "gimnasio", exercises: [] },
          { day: "Miércoles", type: "actividad", sport: "Correr", duration: "30 min" },
        ]}
        onNavigate={onNavigate}
        completedDays={["Lunes"]}
        completedThisWeek={1}
        macros={{ protein: 150, carbs: 250, fats: 70, calories: 2230 }}
      />,
    );

    const figures = screen.getByRole("region", { name: "Tu día" });
    const kcal = within(figures).getByRole("button", { name: "Calorías: 2230 kcal" });
    expect(within(figures).getByRole("button", { name: "Proteína: 150 g proteína" })).toBeVisible();
    const sessions = within(figures).getByRole("button", { name: "Sesiones: 1/3 sesiones" });
    fireEvent.click(kcal);
    expect(onNavigate).toHaveBeenLastCalledWith("nutrition");
    fireEvent.click(sessions);
    expect(onNavigate).toHaveBeenLastCalledWith("training");
    expect(mocks.hapticTap).toHaveBeenCalledTimes(2);
  });

  it("rests only when the whole week is done and still opens training", () => {
    const onNavigate = vi.fn();
    const onStartWorkout = vi.fn();
    render(<HomeOverview dayPlans={[{ day: "Lunes", type: "gimnasio", exercises: [] }]} completedDays={["Lunes"]} onNavigate={onNavigate} onStartWorkout={onStartWorkout} />);
    expect(screen.getByText("Semana completa")).toBeVisible();
    expect(screen.getByText("Has hecho tu sesión de esta semana. El lunes empieza otra vuelta.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Entrenar igualmente" }));
    // Se abre Entrenar, sin sesión concreta.
    expect(onNavigate).toHaveBeenCalledWith("training");
    expect(onStartWorkout).not.toHaveBeenCalled();
  });

  it("shows a completion summary before opening progress", () => {
    const onNavigate = vi.fn();
    render(<HomeOverview dayPlans={[{ day: "Lunes", type: "gimnasio", exercises: [] }]} completedToday onNavigate={onNavigate} />);
    const doneCard = screen.getByRole("button", { name: /Hecho hoy: Sesión completada/ });
    expect(within(doneCard).getByText("HECHO HOY")).toBeVisible();
    expect(within(doneCard).getByText("Sesión completada")).toBeVisible();
    expect(within(doneCard).getByText("Resumen")).toBeVisible();
    fireEvent.click(doneCard);
    expect(screen.getByText("Completado hoy")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Ver mi progreso" }));
    expect(onNavigate).toHaveBeenCalledWith("progress");
  });

  it("previews the next session before starting it", () => {
    const onNavigate = vi.fn();
    const onStartWorkout = vi.fn();
    render(<HomeOverview dayPlans={[{ day: today, type: "gimnasio", exercises: [] }]} onNavigate={onNavigate} onStartWorkout={onStartWorkout} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver la sesión Entrenamiento/ }));
    expect(onStartWorkout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Empezar entrenamiento" }));
    expect(onStartWorkout).toHaveBeenCalledWith(today);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("sums up today's session with its series and an approximate length", () => {
    render(
      <HomeOverview
        dayPlans={[{
          day: today,
          type: "gimnasio",
          routine_name: "Pull B",
          exercises: [
            { exercise_id: "row", name: "Remo", series: 4, reps: 8, weight: "", rest: "2 min" },
            { exercise_id: "curl", name: "Curl", series: 3, reps: 12, weight: "", rest: "90 s" },
          ],
        }]}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Ver la sesión Pull B" })).toHaveTextContent("20 min · 2 ejercicios");
  });

  it("never rests just because of the weekday", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T12:00:00")); // miércoles
    render(<HomeOverview dayPlans={[{ day: "Viernes", type: "gimnasio", routine_name: "Pull B", exercises: [] }]} onNavigate={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Ver la sesión Pull B" })).toBeVisible();
    expect(screen.queryByText(/descans/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/viernes/i)).not.toBeInTheDocument();
  });

  it("marks today as done and opens the session summary once it is logged", () => {
    const onNavigate = vi.fn();
    render(<HomeOverview dayPlans={[{ day: today, type: "gimnasio", exercises: [] }]} onNavigate={onNavigate} completedToday />);

    expect(screen.getByText("HECHO HOY")).toBeVisible();
    const doneCard = screen.getByRole("button", { name: /Hecho hoy: Sesión completada/ });
    expect(doneCard).toBeVisible();
    fireEvent.click(doneCard);
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ver mi progreso" }));
    expect(onNavigate).toHaveBeenCalledWith("progress");
    expect(mocks.hapticTap).toHaveBeenCalledTimes(2);
  });

  it("offers the same mark-complete action for a planned activity", async () => {
    const onCompleteActivity = vi.fn().mockResolvedValue(true);
    render(
      <HomeOverview
        dayPlans={[{ day: "Lunes", type: "actividad", sport: "Correr", intensity: "Media", duration: "30 min" }]}
        onNavigate={vi.fn()}
        onCompleteActivity={onCompleteActivity}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver la sesión Correr" }));
    expect(screen.getByText("30 min")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Marcar actividad como hecha" }));
    await waitFor(() => expect(onCompleteActivity).toHaveBeenCalledWith("Lunes"));
  });

  it("never mentions the paid plan and shows no dashes without nutrition targets", () => {
    const props = { dayPlans: [{ day: today, type: "gimnasio" as const, exercises: [] }], onNavigate: vi.fn(), nutrition: false };
    for (const ios of [false, true]) {
      mocks.ios = ios;
      render(<HomeOverview {...props} />);
      expect(screen.queryByText(/Plus/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Calorías: sin datos" })).toBeVisible();
      expect(screen.queryByText("—")).not.toBeInTheDocument();
      cleanup();
    }
  });
});
