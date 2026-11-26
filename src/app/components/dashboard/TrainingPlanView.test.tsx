import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import TrainingPlanView from "@/app/components/dashboard/TrainingPlanView";
vi.mock("@/shared/hooks/useExerciseMetadata", () => ({ useExerciseMetadata: () => ({ byId: {}, byName: {} }) }));
vi.mock("@/app/components/ExerciseMedia", () => ({
  ExerciseThumb: ({ image }: { image?: string | null }) =>
    image ? <img data-testid="thumb-image" src={image} alt="" /> : <span data-testid="thumb-placeholder" />,
}));
vi.mock("@/app/components/ExerciseFocus", () => ({
  default: ({ exercise }: { exercise: { name: string; image?: string | null } | null }) =>
    exercise ? (
      <div data-testid="focus">
        {exercise.image ? <img data-testid="focus-image" src={exercise.image} alt="" /> : <span data-testid="focus-placeholder" />}
      </div>
    ) : null,
}));
vi.mock("@/shared/components/AIDisclaimer", () => ({ default: () => null }));
vi.mock("@/app/components/dashboard/CalendarExportDialog", () => ({ default: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</> }));
// La portada IA es red: aquí se prueba el respaldo de marca y el resto de la pantalla.
vi.mock("@/shared/hooks/useSessionCover", () => ({ useSessionCover: () => null, cachedSessionCover: () => null }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const squat = { exercise_id: "squat", name: "Sentadilla", series: 3, reps: 8, weight: "", rest: "90 s" };
const setToday = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};

/** Nombre accesible de una fila: «Sesión N: nombre, 2 ejercicios · ≈ 15 min, para hoy» (con espacios que no se parten). */
const row = (n: number, name: string, line: string, state?: string) =>
  `Sesión ${n}: ${name}, ${line.replace(/ (?=\d|min|ejercicio)/g, "\u00a0")}${state ? `, ${state}` : ""}`;

describe("routine in order", () => {
  const plans = [
    { day: "Lunes", type: "gimnasio" as const, routine_name: "Piernas", exercises: [squat, { ...squat, exercise_id: "lunge", name: "Zancada" }] },
    { day: "Jueves", type: "gimnasio" as const, routine_name: "Empuje", exercises: [squat] },
    { day: "Sábado", type: "actividad" as const, sport: "Running", intensity: "Media", duration: "45 min" },
  ];
  const piernas = (state?: string) => row(1, "Piernas", "2 ejercicios · ≈ 15 min", state);
  const empuje = (state?: string) => row(2, "Empuje", "1 ejercicio · ≈ 5 min", state);
  const running = "Sesión 3: Running, Intensidad media · 45 min";

  it("lists only the sessions in order, without weekdays or rest days", () => {
    setToday("2026-10-14T12:00:00"); // miércoles: no cambia nada
    render(<TrainingPlanView dayPlans={plans} onOpenWorkout={vi.fn()} />);
    expect(screen.getByRole("button", { name: piernas("para hoy") })).toBeVisible();
    expect(screen.getByRole("button", { name: empuje() })).toBeVisible();
    expect(screen.getByRole("button", { name: running })).toBeVisible();
    expect(screen.queryByText(/lunes|jueves|sábado|miércoles/i)).not.toBeInTheDocument();
    // Sin días de descanso (el descanso entre series de cada ejercicio sí se lee, con su unidad).
    expect(screen.queryByText(/día de descanso|descansa\b/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Días de la semana" })).not.toBeInTheDocument();
    // «Esta semana» con lo hecho en tramos y la cuenta corta al lado.
    expect(screen.getByRole("heading", { name: "Esta semana" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Esta semana: 0 de 3 sesiones" })).toHaveTextContent("0 de 3");
    expect(screen.getByText("Hoy")).toBeVisible();
  });

  it("opens the next pending session and starts it whatever the day", () => {
    const onOpenWorkout = vi.fn();
    render(<TrainingPlanView dayPlans={plans} doneThisWeek={["Lunes"]} onOpenWorkout={onOpenWorkout} />);
    expect(screen.getByRole("button", { name: piernas("hecha esta semana") })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: empuje("para hoy") })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Esta semana: 1 de 3 sesiones" })).toBeVisible();
    expect(screen.getByText("Hecha")).toBeVisible();
    // Sus ejercicios, abiertos dentro de la misma tarjeta, con series × reps y el descanso con su unidad.
    expect(screen.getByRole("group", { name: "Ejercicios" })).toHaveTextContent("3 × 8");
    expect(screen.getByRole("group", { name: "Ejercicios" })).toHaveTextContent("Descanso 90 s");
    fireEvent.click(screen.getByRole("button", { name: "Empezar sesión" }));
    expect(onOpenWorkout).toHaveBeenCalledWith("Jueves");
    // Sin copiar, descargar ni exportar: solo la rutina.
    expect(screen.queryByRole("button", { name: "Copiar plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Descargar plan" })).not.toBeInTheDocument();
  });

  it("after training today, the next session reads «Siguiente», not «Hoy»", () => {
    render(<TrainingPlanView dayPlans={plans} doneThisWeek={["Lunes"]} doneToday={["Lunes"]} onOpenWorkout={vi.fn()} />);
    expect(screen.getByRole("button", { name: empuje("siguiente") })).toBeVisible();
    expect(screen.getByText("Siguiente")).toBeVisible();
    expect(screen.queryByText("Hoy")).not.toBeInTheDocument();
  });

  it("shows completed sessions without offering to start them again", () => {
    render(<TrainingPlanView dayPlans={plans} initialDay="Lunes" doneToday={["Lunes"]} onOpenWorkout={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Entrenamiento completado");
    expect(screen.queryByRole("button", { name: "Empezar sesión" })).not.toBeInTheDocument();
  });

  it("offers to resume a saved workout draft", () => {
    const onOpenWorkout = vi.fn();
    render(<TrainingPlanView dayPlans={plans} initialDay="Jueves" resumableDay="Jueves" onOpenWorkout={onOpenWorkout} />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar entreno" }));
    expect(onOpenWorkout).toHaveBeenCalledWith("Jueves");
  });

  it("folds the open session on a second tap and keeps the rest folded", () => {
    render(<TrainingPlanView dayPlans={plans} onOpenWorkout={vi.fn()} />);
    const first = screen.getByRole("button", { name: piernas("para hoy") });
    expect(first).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Empezar sesión" })).not.toBeInTheDocument();
  });

  it("personalizes a session name and icon with the suggestion", async () => {
    const onPersonalize = vi.fn().mockResolvedValue(true);
    render(<TrainingPlanView dayPlans={[{ ...plans[0], session_icon: "🔥", exercises: [{ ...squat, muscle_group: "Cuádriceps" }] }, ...plans.slice(1)]} onOpenWorkout={vi.fn()} onPersonalize={onPersonalize} />);
    fireEvent.click(screen.getByRole("button", { name: /Nombre e icono/ }));
    expect(await screen.findByText("Personalizar sesión")).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: "🦵, sugerido" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onPersonalize).toHaveBeenCalledWith("Lunes", { name: "Piernas", icon: "🦵" }));
  });

  it("opens the session asked for from Hoy and any other on tap", () => {
    const onOpenWorkout = vi.fn();
    const { rerender } = render(<TrainingPlanView dayPlans={plans} initialDay="Sábado" onOpenWorkout={onOpenWorkout} />);
    expect(screen.getByRole("button", { name: running })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("45 min")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Empezar actividad" }));
    expect(onOpenWorkout).toHaveBeenCalledWith("Sábado");

    fireEvent.click(screen.getByRole("button", { name: piernas("para hoy") }));
    expect(screen.getByRole("group", { name: "Ejercicios" })).toHaveTextContent("Zancada");

    rerender(<TrainingPlanView dayPlans={plans} initialDay="Jueves" onOpenWorkout={onOpenWorkout} />);
    expect(screen.getByRole("button", { name: empuje() })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: piernas("para hoy") })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the first session again when the whole week is done", () => {
    render(<TrainingPlanView dayPlans={plans} doneThisWeek={["Lunes", "Jueves", "Sábado"]} onOpenWorkout={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Esta semana: 3 de 3 sesiones" })).toBeVisible();
    expect(screen.getByRole("button", { name: piernas("hecha esta semana") })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows a neutral state when the plan has no sessions at all, with «Editar plan»", () => {
    const onEditPlan = vi.fn();
    render(<TrainingPlanView dayPlans={[]} onOpenWorkout={vi.fn()} onEditPlan={onEditPlan} />);
    expect(screen.getByText("Tu plan aún no tiene sesiones")).toBeVisible();
    expect(screen.queryByText(/esta semana/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar plan" }));
    expect(onEditPlan).toHaveBeenCalled();
  });

  it("a session without exercises invites to add them, in positive", () => {
    render(<TrainingPlanView dayPlans={[{ day: "Lunes", type: "gimnasio", routine_name: "Torso", exercises: [] }]} onOpenWorkout={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Sesión 1: Torso, Añade sus ejercicios, para hoy" })).toBeVisible();
    expect(screen.getByText("Añade sus ejercicios con «Editar» y empiézala cuando quieras.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Empezar sesión" })).not.toBeInTheDocument();
  });

  it("falls back to the composed placeholder when an exercise image fails to load", () => {
    setToday("2026-10-12T12:00:00"); // lunes
    render(
      <TrainingPlanView
        dayPlans={[{ day: "Lunes", type: "gimnasio", routine_name: "Piernas", exercises: [{ ...squat, image_url: "https://cdn.test/squat.jpg" }] }]}
        onOpenWorkout={vi.fn()}
      />,
    );
    fireEvent.error(screen.getByTestId("thumb-image"));
    expect(screen.queryByTestId("thumb-image")).toBeNull();
    expect(screen.getByTestId("thumb-placeholder")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Sentadilla"));
    expect(screen.getByTestId("focus")).toBeInTheDocument();
    expect(screen.queryByTestId("focus-image")).toBeNull();
    expect(screen.getByTestId("focus-placeholder")).toBeInTheDocument();
  });
});

describe("Entrenar header", () => {
  const auto = { day: "Lunes", type: "gimnasio" as const, routine_name: "Piernas", exercises: [squat] };

  it("says the plan mode in one short sentence, with the quiet pills and «Editar» by «Esta semana»", () => {
    const onEmptyWorkout = vi.fn();
    const onOpenLibrary = vi.fn();
    const onEditPlan = vi.fn();
    render(<TrainingPlanView dayPlans={[auto]} onEmptyWorkout={onEmptyWorkout} onOpenLibrary={onOpenLibrary} onEditPlan={onEditPlan} />);
    expect(screen.getByText("Tu plan lo prepara el piloto automático.")).toBeVisible();
    // Sin la frase repetida de antes ni el modo en dos líneas.
    expect(screen.queryByText("Tus sesiones en orden. Hazlas el día que te venga bien.")).not.toBeInTheDocument();
    expect(screen.queryByText("Piloto automático")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entreno vacío" }));
    fireEvent.click(screen.getByRole("button", { name: "Ejercicios" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar plan" }));
    expect(onEmptyWorkout).toHaveBeenCalled();
    expect(onOpenLibrary).toHaveBeenCalled();
    expect(onEditPlan).toHaveBeenCalled();
  });

  it("an all-yours plan says so, and a mixed one counts your routines", () => {
    const { rerender } = render(<TrainingPlanView dayPlans={[{ ...auto, custom: true }]} />);
    expect(screen.getByText("Tu plan lo has creado tú.")).toBeVisible();
    rerender(<TrainingPlanView dayPlans={[auto, { ...auto, day: "Jueves", custom: true }]} />);
    expect(screen.getByText("Tu plan lo prepara el piloto automático, con 1 rutina tuya.")).toBeVisible();
  });
});
