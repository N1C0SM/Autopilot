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
    render(
      <HomeOverview
        dayPlans={[{ day: today, type: "gimnasio", routine_name: "Pull B", muscle_focus: "Espalda · Bíceps", exercises: [{ exercise_id: "squat", name: "Sentadilla", series: 3, reps: 8, weight: "", rest: "90 s" }] }]}
        onNavigate={onNavigate}
        profileName="Nicolás Pérez"
      />,
    );

    // Rediseño: «Hoy» como título grande y el saludo debajo, en gris.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Hoy");
    expect(screen.getByText("Hola, Nicolás. A entrenar.")).toBeVisible();
    // El saludo es corto: la sesión se nombra solo en su tarjeta.
    expect(screen.queryByText(/Hoy toca/)).not.toBeInTheDocument();
    const startButton = screen.getByRole("button", { name: "Ver la sesión Pull B · Espalda y bíceps" });
    expect(within(startButton).getByText("Pull B")).toBeVisible();
    expect(within(startButton).getByText("1 ejercicio")).toBeVisible();
    expect(within(startButton).getByText("Siguiente sesión · 1 de 1")).toBeVisible();
    fireEvent.click(startButton);
    expect(screen.getByText("Sentadilla")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Empezar entrenamiento" }));
    expect(onNavigate).toHaveBeenCalledWith("training", today);
    expect(mocks.hapticTap).toHaveBeenCalledTimes(2);
  });

  it("proposes the next pending session whatever the weekday, with one mark per session", () => {
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
        onNavigate={onNavigate}
        onStartWorkout={onStartWorkout}
      />,
    );

    // Ni días de la semana ni «descanso» por ser domingo: toca la siguiente que falta.
    expect(screen.queryByText(/descans/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^[LMXJVSD]$/)).not.toBeInTheDocument();
    const startButton = screen.getByRole("button", { name: "Ver la sesión Empuje" });
    expect(within(startButton).getByText("Siguiente sesión · 2 de 3")).toBeVisible();
    expect(screen.getByRole("region", { name: "Esta semana: 1 de 3 sesiones" })).toBeVisible();
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

  it("shows the weekly progress and nutrition cards while keeping paid nutrition reachable", () => {
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
        nutrition={false}
      />,
    );

        expect(screen.getByText("Plan de nutrición")).toBeVisible();
    const nutritionCard = screen.getByRole("button", { name: /Nutrición/ });
    const progressCard = screen.getByRole("button", { name: /Tu progreso/ });
    expect(nutritionCard).toBeVisible();
    expect(progressCard).toBeVisible();
    // «Tu progreso» y «Tu plan» van juntos, después de la acción principal.
    expect(progressCard.closest("[data-home-rows]")).toBe(screen.getByRole("button", { name: /Tu plan/ }).closest("[data-home-rows]"));
    const startButton = screen.getByRole("button", { name: /Ver la sesión Entrenamiento de fuerza/ });
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

    expect(screen.getByRole("button", { name: "Ver la sesión Pull B" })).toHaveTextContent("2 ejercicios · 7 series · unos 20 min");
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
