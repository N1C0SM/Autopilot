import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  it("shows today's session as the primary action and navigates to the workout", () => {
    const onNavigate = vi.fn();
    render(
      <HomeOverview
        dayPlans={[{ day: today, type: "gimnasio", routine_name: "Pull B", muscle_focus: "Espalda · Bíceps", exercises: [{ exercise_id: "squat", name: "Sentadilla", series: 3, reps: 8, weight: "", rest: "90 s" }] }]}
        onNavigate={onNavigate}
        profileName="Nicolás Pérez"
      />,
    );

    expect(screen.getByText("Hola, Nicolás.")).toBeVisible();
    expect(screen.getByText("A entrenar.")).toBeVisible();
    const greeting = screen.getByRole("heading", { level: 2 });
    expect(greeting).toHaveTextContent("Hola, Nicolás.");
    expect(greeting).toHaveTextContent("A entrenar.");
    // El saludo es corto: la sesión se nombra solo en su tarjeta.
    expect(screen.queryByText(/Hoy toca/)).not.toBeInTheDocument();
    const startButton = screen.getByRole("button", { name: "Empezar Pull B · Espalda y bíceps" });
    expect(within(startButton).getByText("Pull B")).toBeVisible();
    expect(within(startButton).getByText("1 ejercicio")).toBeVisible();
    expect(within(startButton).getByText("Empezar entreno")).toBeVisible();
    fireEvent.click(startButton);
    expect(onNavigate).toHaveBeenCalledWith("training");
    expect(mocks.hapticTap).toHaveBeenCalledTimes(1);
  });

  it("shows only today: there is no weekly strip and no day-by-day navigation", () => {
    const tomorrow = DAYS[(DAYS.indexOf(today) + 1) % 7];
    const dayAfter = DAYS[(DAYS.indexOf(today) + 2) % 7];
    const onNavigate = vi.fn();
    render(
      <HomeOverview
        dayPlans={[
          { day: today, type: "gimnasio", exercises: [] },
          { day: tomorrow, type: "gimnasio", routine_name: "Piernas", exercises: [{ exercise_id: "squat", name: "Sentadilla", series: 3, reps: 8, weight: "", rest: "90 s" }] },
          { day: dayAfter, type: "actividad", sport: "Correr", duration: "30 min" },
        ]}
        onNavigate={onNavigate}
      />,
    );

    // Ni «Tu semana» ni celdas de día: Hoy es solo hoy.
    expect(screen.queryByText(/Tu semana/i)).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText(/con sesión — ver entrenamiento/)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: new RegExp(`^${tomorrow}:`) })).not.toBeInTheDocument();
    // La acción principal sigue siendo la sesión de hoy…
    expect(screen.getByRole("button", { name: /Empezar Entrenamiento de fuerza/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Empezar Entrenamiento de fuerza" }));
    // …y va a entrenar sin pedir ningún día de la semana.
    expect(onNavigate).toHaveBeenCalledWith("training");
    expect(onNavigate).not.toHaveBeenCalledWith("training", expect.anything());
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

  it("does not invent a session photo on a rest day", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T12:00:00"));
    const { container } = render(<HomeOverview dayPlans={[{ day: "Lunes", type: "gimnasio", exercises: [] }]} onNavigate={vi.fn()} />);
    expect(screen.getByText("Hoy toca descansar")).toBeVisible();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the weekly progress and nutrition cards while keeping paid nutrition reachable", () => {
    const onNavigate = vi.fn();
    render(
      <HomeOverview
        dayPlans={[
          { day: today, type: "gimnasio", exercises: [] },
          { day: DAYS[(DAYS.indexOf(today) + 1) % 7], type: "gimnasio", exercises: [] },
          { day: DAYS[(DAYS.indexOf(today) + 2) % 7], type: "actividad", sport: "Correr", duration: "30 min" },
        ]}
        onNavigate={onNavigate}
        completedThisWeek={2}
        nutrition={false}
      />,
    );

        expect(screen.getByText("Plan de nutrición")).toBeVisible();
    const nutritionCard = screen.getByRole("button", { name: /Nutrición/ });
    const progressCard = screen.getByRole("button", { name: /Récords/ });
    expect(nutritionCard).toBeVisible();
    expect(progressCard).toBeVisible();
    // Los widgets van juntos en su rejilla, después de la acción principal.
    expect(nutritionCard.closest(".grid")).toBe(progressCard.closest(".grid"));
    const startButton = screen.getByRole("button", { name: /Empezar Entrenamiento de fuerza/ });
    expect(startButton).toBeVisible();
    const allButtons = screen.getAllByRole("button");
    expect(allButtons.indexOf(startButton)).toBeLessThan(allButtons.indexOf(nutritionCard));
    expect(allButtons.indexOf(startButton)).toBeLessThan(allButtons.indexOf(progressCard));
    fireEvent.click(nutritionCard);
    expect(onNavigate).toHaveBeenLastCalledWith("nutrition");
    fireEvent.click(progressCard);
    expect(onNavigate).toHaveBeenLastCalledWith("progress");
    expect(mocks.hapticTap).toHaveBeenCalledTimes(2);
  });

  it("opens training from a rest Sunday without asking for a weekday", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T12:00:00"));
    const onNavigate = vi.fn();
    const onStartWorkout = vi.fn();
    render(<HomeOverview dayPlans={[{ day: "Lunes", type: "gimnasio", exercises: [] }]} onNavigate={onNavigate} onStartWorkout={onStartWorkout} />);
    fireEvent.click(screen.getByRole("button", { name: "Entrenar igualmente" }));
    // Sin tira de semana: se abre Entrenar, sin día concreto.
    expect(onNavigate).toHaveBeenCalledWith("training");
    expect(onStartWorkout).not.toHaveBeenCalled();
  });

  it("sends the completed card to training without a day (session summary)", () => {
    const onNavigate = vi.fn();
    render(<HomeOverview dayPlans={[{ day: "Lunes", type: "gimnasio", exercises: [] }]} completedToday onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver el resumen de la sesión de hoy" }));
    expect(onNavigate).toHaveBeenCalledWith("training");
  });

  it("uses the direct start action only for today's planned session", () => {
    const onNavigate = vi.fn();
    const onStartWorkout = vi.fn();
    render(<HomeOverview dayPlans={[{ day: today, type: "gimnasio", exercises: [] }]} onNavigate={onNavigate} onStartWorkout={onStartWorkout} />);
    fireEvent.click(screen.getByRole("button", { name: /Empezar Entrenamiento/ }));
    expect(onStartWorkout).toHaveBeenCalledOnce();
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

    expect(screen.getByRole("button", { name: "Empezar Pull B" })).toHaveTextContent("2 ejercicios · 7 series · unos 20 min");
  });

  it("tells the next session on a rest day", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T12:00:00"));
    render(<HomeOverview dayPlans={[{ day: "Viernes", type: "gimnasio", routine_name: "Pull B", exercises: [] }]} onNavigate={vi.fn()} />);

    expect(screen.getByText("Hoy toca descansar")).toBeVisible();
    expect(screen.getByText("Tu próxima sesión es el viernes: Pull B.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Empezar/ })).not.toBeInTheDocument();
  });

  it("marks today as done and opens the session summary once it is logged", () => {
    const onNavigate = vi.fn();
    render(<HomeOverview dayPlans={[{ day: today, type: "gimnasio", exercises: [] }]} onNavigate={onNavigate} completedToday />);

    expect(screen.getByText("Hecho hoy")).toBeVisible();
    const doneCard = screen.getByRole("button", { name: "Ver el resumen de la sesión de hoy" });
    expect(doneCard).toBeVisible();
    fireEvent.click(doneCard);
    expect(onNavigate).toHaveBeenCalledWith("training");
    expect(mocks.hapticTap).toHaveBeenCalledTimes(1);
  });

  it("never mentions the paid plan on iOS", () => {
    const props = { dayPlans: [{ day: today, type: "gimnasio" as const, exercises: [] }], onNavigate: vi.fn(), nutrition: false };
    render(<HomeOverview {...props} />);
    expect(screen.getByText(/Incluido en Plus/)).toBeVisible();
    cleanup();

    mocks.ios = true;
    render(<HomeOverview {...props} />);
    expect(screen.getByText("Plan de nutrición")).toBeVisible();
    expect(screen.queryByText(/Incluido en Plus/)).not.toBeInTheDocument();
  });
});
