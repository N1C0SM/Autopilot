import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomeOverview from "@/app/components/dashboard/HomeOverview";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";

const mocks = vi.hoisted(() => ({
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  ios: false,
  isNative: vi.fn().mockReturnValue(false),
  /** Portada de IA devuelta por useSessionCover (null = sin portada aún). */
  cover: null as string | null,
}));
vi.mock("@/shared/lib/native", () => ({ hapticTap: mocks.hapticTap, hapticSelection: mocks.hapticSelection, isNative: mocks.isNative }));
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
/** Domingo 4 de octubre de 2026: la semana va del lunes 28 de septiembre al domingo 4. */
const SUNDAY = new Date("2026-10-04T12:00:00");

const pill = (name: string | RegExp) => within(screen.getByRole("list", { name: "Esta semana" })).getByRole("button", { name });

describe("dashboard home overview", () => {
  it("greets with the date and the name, and shows today's session as the primary action", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY);
    const onStartWorkout = vi.fn();
    render(
      <HomeOverview
        dayPlans={[{ day: "Domingo", type: "gimnasio", routine_name: "Pull B", muscle_focus: "Espalda · Bíceps", exercises: [{ exercise_id: "squat", name: "Sentadilla", series: 3, reps: 8, weight: "", rest: "90 s" }] }]}
        onNavigate={vi.fn()}
        onStartWorkout={onStartWorkout}
        profileName="Nicolás Pérez"
      />,
    );

    // La fecha pequeña, el nombre grande y una línea en gris; «Hoy» titula la tarjeta del día.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Domingo, 4 de octubre");
    expect(screen.getByText("Nicolás")).toBeVisible();
    expect(screen.getByText("La constancia crea el cambio.")).toBeVisible();
    expect(screen.getByRole("heading", { level: 3, name: "Hoy" })).toBeVisible();
    const card = screen.getByRole("button", { name: "Ver la sesión Pull B · Espalda y bíceps" });
    expect(within(card).getByText("Pull B")).toBeVisible();
    expect(within(card).getByText("Entrenamiento")).toBeVisible();
    expect(within(card).getByText("Espalda y bíceps")).toBeVisible();
    expect(card).toHaveTextContent("5 min · 1 ejercicio");
    fireEvent.click(card);
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("Sesión de hoy")).toBeVisible();
    expect(within(sheet).getByText("Sentadilla")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Empezar entrenamiento" }));
    expect(onStartWorkout).toHaveBeenCalledWith("Domingo");
  });

  it("starts the session in one tap from the gold «Empezar» pill", () => {
    const onStartWorkout = vi.fn();
    render(
      <HomeOverview
        dayPlans={[{ day: today, type: "gimnasio", routine_name: "Pull B", exercises: [{ exercise_id: "row", name: "Remo", series: 3, reps: 8, weight: "", rest: "90 s" }] }]}
        onNavigate={vi.fn()}
        onStartWorkout={onStartWorkout}
      />,
    );

    const start = screen.getByRole("button", { name: "Empezar Pull B" });
    expect(start).toHaveTextContent("Empezar");
    fireEvent.click(start);
    expect(onStartWorkout).toHaveBeenCalledWith(today);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps only the greeting, the week, the day's card and the three figures, in the iPhone order on every width", () => {
    render(
      <HomeOverview
        dayPlans={[{
          day: today,
          type: "gimnasio",
          routine_name: "Upper A",
          muscle_focus: "Pecho, espalda, hombros",
          exercises: [
            { exercise_id: "bench", name: "Press banca plano", series: 4, reps: 8, weight: "", rest: "2 min" },
            { exercise_id: "row", name: "Remo sentado", series: 3, reps: 10, weight: "", rest: "90 s" },
          ],
        }]}
        onNavigate={vi.fn()}
        onOpenPlan={vi.fn()}
      />,
    );

    const week = screen.getByRole("list", { name: "Esta semana" });
    const card = screen.getByRole("button", { name: "Ver la sesión Upper A · Pecho, espalda y hombros" });
    const figures = screen.getByRole("region", { name: "Tu día" });
    for (const [before, after] of [[week, card], [card, figures]]) {
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // La web ancha es el iPhone más grande: nada se esconde ni aparece según el ancho.
    for (const element of [week, card, figures]) {
      expect(element.className).not.toMatch(/(^|\s)(lg:)?hidden|lg:block/);
    }
    expect(within(week).getAllByRole("button")).toHaveLength(7);
    // Fuera de Hoy: «Tu plan», «Mis rutinas», «Entreno vacío», «Nueva rutina» y la oferta de Plus.
    expect(screen.queryByRole("region", { name: "Tu plan" })).not.toBeInTheDocument();
    for (const gone of [/Tu plan$/, /Mis rutinas/, /Entreno vacío/, /Nueva rutina/, /Plus/, /Tu progreso/]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });

  it("changes the card when a day pill is tapped: that day's session from the plan, the rest day or what was done", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY);
    const onStartWorkout = vi.fn();
    render(
      <HomeOverview
        dayPlans={[
          { day: "Lunes", type: "gimnasio", routine_name: "Piernas", exercises: [{ exercise_id: "squat", name: "Sentadilla", series: 4, reps: 6, weight: "", rest: "2 min" }] },
          { day: "Jueves", type: "gimnasio", routine_name: "Empuje", exercises: [] },
          { day: "Sábado", type: "actividad", sport: "Correr", intensity: "Media", duration: "30 min" },
        ]}
        completedDays={["Lunes"]}
        completedThisWeek={1}
        trainedDates={["2026-09-30"]}
        doneByDate={{ "2026-09-30": ["Lunes"] }}
        onNavigate={vi.fn()}
        onStartWorkout={onStartWorkout}
      />,
    );

    // La tira es la semana de lunes a domingo: hoy marcado y un punto en los días entrenados.
    const week = within(screen.getByRole("list", { name: "Esta semana" })).getAllByRole("button");
    expect(week.map((day) => day.getAttribute("aria-label"))).toEqual([
      "lunes 28", "martes 29", "miércoles 30, entrenaste", "jueves 1", "viernes 2", "sábado 3", "domingo 4, hoy",
    ]);
    expect(week[6]).toHaveAttribute("aria-current", "date");
    expect(week[6]).toHaveAttribute("aria-pressed", "true");
    // Hoy: la siguiente que falta (sea el día que sea), nunca «descanso» por ser domingo.
    expect(screen.getByRole("button", { name: "Ver la sesión Empuje" })).toBeVisible();
    expect(screen.queryByText("Descanso")).not.toBeInTheDocument();

    // Jueves: su sesión del plan, que se empieza igual.
    fireEvent.click(pill("jueves 1"));
    expect(mocks.hapticSelection).toHaveBeenCalledTimes(1);
    expect(pill("jueves 1")).toHaveAttribute("aria-pressed", "true");
    expect(pill("domingo 4, hoy")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("heading", { level: 3, name: "Jueves 1" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Empezar Empuje" }));
    expect(onStartWorkout).toHaveBeenCalledWith("Jueves");

    // Martes: sin sesión en el plan, descanso.
    fireEvent.click(pill("martes 29"));
    expect(screen.getByText("Descanso")).toBeVisible();
    expect(screen.getByText("Recuperar también forma parte del plan.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Empezar/ })).not.toBeInTheDocument();

    // Miércoles: se hizo «Piernas» ese día, así que se ve hecha (y el lunes también, sin botón de empezar).
    fireEvent.click(pill("miércoles 30, entrenaste"));
    const done = screen.getByRole("button", { name: "Ver la sesión Piernas, hecha" });
    expect(screen.getByText("Hecha")).toBeVisible();
    fireEvent.click(done);
    expect(within(screen.getByRole("dialog")).getByText("Completado el miércoles 30")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(pill("lunes 28"));
    expect(screen.getByRole("button", { name: "Ver la sesión Piernas, hecha" })).toBeVisible();

    // Sábado: la actividad, con su intensidad y duración.
    fireEvent.click(pill("sábado 3"));
    expect(screen.getByRole("heading", { level: 3, name: "Ayer" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ver la sesión Correr" })).toHaveTextContent("Media · 30 min");
    expect(screen.getByRole("button", { name: "Ver la actividad Correr" })).toHaveTextContent("Ver actividad");

    // Hoy vuelve a ser «Hoy».
    fireEvent.click(pill("domingo 4, hoy"));
    expect(screen.getByRole("heading", { level: 3, name: "Hoy" })).toBeVisible();
  });

  it("shows the native-style invitation on every day when no routine exists", () => {
    const onPrepareRoutine = vi.fn();
    render(
      <HomeOverview dayPlans={[]} hasPlan={false} nutrition={false} onNavigate={vi.fn()} onPrepareRoutine={onPrepareRoutine} onOpenPlan={vi.fn()} />,
    );

    expect(screen.getByText("Prepara tu rutina inicial gratis")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Preparar mi rutina gratis" }));
    expect(onPrepareRoutine).toHaveBeenCalledOnce();
    // Sin plan no hay «Ver plan»: la invitación ya es la acción.
    expect(screen.queryByRole("button", { name: /Ver plan/ })).not.toBeInTheDocument();
    const other = within(screen.getByRole("list", { name: "Esta semana" })).getAllByRole("button").find((button) => button.getAttribute("aria-pressed") === "false");
    fireEvent.click(other!);
    expect(screen.getByText("Prepara tu rutina inicial gratis")).toBeVisible();
  });

  it("paints a real photo of the session on a gym day, falling back to the brand photo", () => {
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

  it("rests calmly when the whole week is done: only the decorative brand photo and no extra buttons", () => {
    const onStartWorkout = vi.fn();
    const { container } = render(
      <HomeOverview dayPlans={[{ day: "Lunes", type: "gimnasio", exercises: [] }]} completedDays={["Lunes"]} onNavigate={vi.fn()} onStartWorkout={onStartWorkout} />,
    );
    expect(screen.getByText("Semana completa")).toBeVisible();
    expect(screen.getByText("Has hecho tu sesión de esta semana. El lunes empieza otra vuelta.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Entrenar igualmente" })).not.toBeInTheDocument();
    const images = Array.from(container.querySelectorAll("img"));
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", BRAND_PHOTOS.gym);
    expect(images[0]).toHaveAttribute("aria-hidden", "true");
    expect(onStartWorkout).not.toHaveBeenCalled();
  });

  it("sums up the day in three honest figures that open Nutrición and Entrenar", () => {
    const onNavigate = vi.fn();
    const onOpenPlan = vi.fn();
    render(
      <HomeOverview
        dayPlans={[
          { day: "Lunes", type: "gimnasio", exercises: [] },
          { day: "Martes", type: "gimnasio", exercises: [] },
          { day: "Miércoles", type: "actividad", sport: "Correr", duration: "30 min" },
        ]}
        onNavigate={onNavigate}
        onOpenPlan={onOpenPlan}
        completedDays={["Lunes"]}
        completedThisWeek={1}
        macros={{ protein: 150, carbs: 250, fats: 70, calories: 2230 }}
      />,
    );

    const figures = screen.getByRole("region", { name: "Tu día" });
    const kcal = within(figures).getByRole("button", { name: "Calorías: 2.230 kcal al día" });
    expect(within(kcal).getByText("2.230")).toHaveClass("type-figure");
    expect(within(figures).getByRole("button", { name: "Proteína: 150 g al día" })).toBeVisible();
    const sessions = within(figures).getByRole("button", { name: "Sesiones: 1 de 3 esta semana" });
    fireEvent.click(kcal);
    expect(onNavigate).toHaveBeenLastCalledWith("nutrition");
    fireEvent.click(sessions);
    expect(onOpenPlan).toHaveBeenCalledOnce();
  });

  it("opens Entrenar from «Ver plan»", () => {
    const onOpenPlan = vi.fn();
    render(<HomeOverview dayPlans={[{ day: today, type: "gimnasio", routine_name: "Pull B", exercises: [] }]} onNavigate={vi.fn()} onOpenPlan={onOpenPlan} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver plan" }));
    expect(onOpenPlan).toHaveBeenCalledOnce();
  });

  it("marks today as done and opens what was logged before progress", () => {
    const onNavigate = vi.fn();
    const date = new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    render(
      <HomeOverview
        dayPlans={[{ day: "Lunes", type: "gimnasio", routine_name: "Pull B", exercises: [] }, { day: "Martes", type: "gimnasio", routine_name: "Upper B", exercises: [] }]}
        completedToday
        completedDays={["Lunes"]}
        doneByDate={{ [key]: ["Lunes"] }}
        onNavigate={onNavigate}
      />,
    );

    const doneCard = screen.getByRole("button", { name: "Ver la sesión Pull B, hecha" });
    expect(doneCard).toHaveTextContent("Siguiente: Upper B.");
    expect(screen.getByText("Hecha")).toBeVisible();
    expect(screen.getByText("Buen trabajo hoy.")).toBeVisible();
    fireEvent.click(doneCard);
    expect(screen.getByText("Completado hoy")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Ver mi progreso" }));
    expect(onNavigate).toHaveBeenCalledWith("progress");
  });

  it("says the session is logged even when the day's completion is not in the plan", () => {
    render(<HomeOverview dayPlans={[{ day: "Lunes", type: "gimnasio", exercises: [] }]} completedToday onNavigate={vi.fn()} />);
    expect(screen.getByText("Sesión completada")).toBeVisible();
    expect(screen.getByText("Hecha")).toBeVisible();
  });

  it("sums up the session with its exercises and an approximate length", () => {
    render(
      <HomeOverview
        dayPlans={[{
          day: today,
          type: "gimnasio",
          routine_name: "Pull B",
          exercises: [
            { exercise_id: "row", name: "Remo", series: 4, reps: 8, weight: "", rest: "2 min", muscle_group: "Espalda" },
            { exercise_id: "curl", name: "Curl", series: 3, reps: 12, weight: "", rest: "90 s", muscle_group: "Bíceps" },
          ],
        }]}
        onNavigate={vi.fn()}
      />,
    );

    const card = screen.getByRole("button", { name: "Ver la sesión Pull B" });
    expect(card).toHaveTextContent("20 min · 2 ejercicios");
    // Sin foco en el plan, los músculos salen de sus ejercicios.
    expect(within(card).getByText("Espalda y bíceps")).toBeVisible();
  });

  it("never rests just because of the weekday", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T12:00:00")); // miércoles
    render(<HomeOverview dayPlans={[{ day: "Viernes", type: "gimnasio", routine_name: "Pull B", exercises: [] }]} onNavigate={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Ver la sesión Pull B" })).toBeVisible();
    expect(screen.queryByText(/descans/i)).not.toBeInTheDocument();
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
    expect(screen.getAllByText("30 min").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Marcar actividad como hecha" }));
    await waitFor(() => expect(onCompleteActivity).toHaveBeenCalledWith("Lunes"));
  });

  it("offers «Editar plan» when the plan has no sessions yet", () => {
    const onEditRoutine = vi.fn();
    render(<HomeOverview dayPlans={[{ day: "Lunes", type: "descanso" } as never]} onNavigate={vi.fn()} onEditRoutine={onEditRoutine} />);
    expect(screen.getByText("Tu plan aún no tiene sesiones")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Editar plan" }));
    expect(onEditRoutine).toHaveBeenCalledOnce();
  });

  it("never mentions the paid plan and shows no dashes without nutrition targets", () => {
    const props = { dayPlans: [{ day: today, type: "gimnasio" as const, exercises: [] }], onNavigate: vi.fn(), nutrition: false };
    for (const ios of [false, true]) {
      mocks.ios = ios;
      render(<HomeOverview {...props} />);
      expect(screen.queryByText(/Plus/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Calorías: por calcular" })).toBeVisible();
      expect(screen.queryByText("—")).not.toBeInTheDocument();
      cleanup();
    }
  });
});
