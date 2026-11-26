import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MyRoutines, { RoutinesPreview } from "@/app/components/dashboard/MyRoutines";
import type { DayPlan } from "@/shared/types/training";

vi.mock("@/shared/lib/native", () => ({
  hapticTap: vi.fn(), hapticSelection: vi.fn(), hapticNotify: vi.fn(), isNative: () => false,
}));
vi.mock("@/shared/hooks/useExerciseMetadata", () => ({ useExerciseMetadata: () => ({ byId: {}, byName: {} }) }));

afterEach(cleanup);

const routine = (day: string, name: string, count: number): DayPlan => ({
  day,
  type: "gimnasio",
  routine_name: name,
  custom: true,
  exercises: Array.from({ length: count }, (_, i) => ({
    exercise_id: `e${i}`, name: `Ejercicio ${i + 1}`, series: 3, reps: 10, weight: "", rest: "90s", muscle_group: i % 2 ? "Espalda" : "Pecho",
  })),
});

const handlers = () => ({
  onNew: vi.fn(), onStart: vi.fn(), onEdit: vi.fn(),
  onDuplicate: vi.fn().mockResolvedValue(true), onDelete: vi.fn().mockResolvedValue(true),
});

describe("Mis rutinas", () => {
  it("cada rutina, compacta: nombre, recuento con músculos, tres miniaturas con «+N» y una sola acción, «Empezar»", () => {
    const h = handlers();
    render(<MyRoutines routines={[routine("Martes", "Pierna pesada", 6), routine("Jueves", "Brazos", 1)]} limitReached={false} {...h} />);
    expect(screen.getByRole("heading", { name: "Mis rutinas" })).toBeInTheDocument();
    // Sin el recuento repetido bajo el título: las tarjetas ya se cuentan solas.
    expect(screen.queryByText("2 rutinas tuyas")).toBeNull();
    expect(screen.getByText("6 ejercicios · Pecho y espalda")).toBeInTheDocument();
    expect(screen.getByText("1 ejercicio · Pecho")).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empezar Pierna pesada" }));
    expect(h.onStart).toHaveBeenCalledWith("Martes");
    expect(screen.getByRole("button", { name: "Más acciones de Brazos" })).toBeInTheDocument();
    // «Nueva rutina» es una píldora tranquila junto al título (secundaria, nunca dorada).
    const add = screen.getByRole("button", { name: "Nueva rutina" });
    expect(add.className).toContain("bg-secondary");
    fireEvent.click(add);
    expect(h.onNew).toHaveBeenCalled();
  });

  it("sin rutinas invita a crear la primera; con siete sesiones lo dice en claro", () => {
    const h = handlers();
    const { rerender } = render(<MyRoutines routines={[]} limitReached={false} {...h} />);
    expect(screen.getByText("Crea tu primera rutina")).toBeInTheDocument();
    // Sin rutinas, una sola «Nueva rutina»: la de la tarjeta (sin repetirla junto al título).
    expect(screen.getAllByRole("button", { name: /Nueva rutina/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Nueva rutina/ }));
    expect(h.onNew).toHaveBeenCalled();
    rerender(<MyRoutines routines={[routine("Lunes", "Torso", 2)]} limitReached {...h} />);
    expect(screen.getByRole("status")).toHaveTextContent("Tienes 7 sesiones: borra o edita una para añadir otra");
  });

  it("una rutina con entreno a medias se continúa y la hecha hoy no se vuelve a empezar", () => {
    render(<MyRoutines routines={[routine("Lunes", "Torso", 2), routine("Martes", "Pierna", 2)]} limitReached={false} resumableDay="Lunes" doneToday={["Martes"]} {...handlers()} />);
    expect(screen.getByRole("button", { name: "Continuar Torso" })).toHaveTextContent("Continuar");
    expect(screen.getByText("Hecha hoy")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Empezar Pierna" })).toBeNull();
  });

  it("en Hoy, hasta tres filas que llevan a Entrenar con «Ver todas»", () => {
    const onOpen = vi.fn();
    render(<RoutinesPreview routines={["Lunes", "Martes", "Miércoles", "Jueves"].map((d) => routine(d, `R ${d}`, 1))} onOpen={onOpen} />);
    expect(screen.getAllByRole("button", { name: /^R / })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Ver todas" }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("«Completar con el autopiloto»: fila secundaria con lo que cubren tus rutinas, el AP mientras trabaja y «Hemos respetado tus N rutinas»", async () => {
    let finish: (kept: number | null) => void = () => {};
    const onComplete = vi.fn(() => new Promise<number | null>((resolve) => { finish = resolve; }));
    const routines = [routine("Lunes", "Torso", 2), routine("Jueves", "Pierna", 2)];
    const { rerender } = render(<MyRoutines routines={routines} limitReached={false} autopilot={{ own: 2, frequency: 4, onComplete }} {...handlers()} />);
    expect(screen.getByText("Tus rutinas cubren 2 de tus 4 días de entreno")).toBeInTheDocument();
    const action = screen.getByRole("button", { name: "Completar con el autopiloto" });
    // Secundaria: la acción dorada de la sección sigue siendo «Nueva rutina».
    expect(action.className).toContain("bg-secondary");
    fireEvent.click(action);
    expect(onComplete).toHaveBeenCalledTimes(1);
    const busy = screen.getByRole("button", { name: /Preparando tus sesiones…/ });
    expect(busy).toHaveAttribute("aria-busy", "true");
    fireEvent.click(busy);
    expect(onComplete).toHaveBeenCalledTimes(1);
    // El plan se refresca antes de terminar: ya no lo pide, pero la carga sigue en su sitio.
    rerender(<MyRoutines routines={routines} limitReached={false} autopilot={null} {...handlers()} />);
    expect(screen.getByRole("button", { name: /Preparando tus sesiones…/ })).toBeInTheDocument();
    await act(async () => { finish(2); });
    expect(screen.getByRole("status")).toHaveTextContent("Hemos respetado tus 2 rutinas");
    expect(screen.getByRole("status")).toHaveTextContent("El piloto automático solo adapta sus propias sesiones.");
    expect(screen.queryByRole("button", { name: "Completar con el autopiloto" })).toBeNull();
  });

  it("«Completar con el autopiloto»: en singular con una rutina y, si falla, el aviso con «Reintentar»", async () => {
    const onComplete = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(1);
    render(<MyRoutines routines={[routine("Lunes", "Torso", 2)]} limitReached={false} autopilot={{ own: 1, frequency: 3, onComplete }} {...handlers()} />);
    expect(screen.getByText("Tu rutina cubre 1 de tus 3 días de entreno")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Completar con el autopiloto" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("No se han podido preparar tus sesiones");
    expect(screen.getByRole("alert")).toHaveTextContent("Tus rutinas siguen guardadas.");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); });
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent("Hemos respetado tu rutina");
  });

  it("«Completar con el autopiloto» no aparece si Entrenar no lo ofrece", () => {
    render(<MyRoutines routines={[routine("Lunes", "Torso", 2)]} limitReached={false} {...handlers()} />);
    expect(screen.queryByText("Completar con el autopiloto")).toBeNull();
  });
});
