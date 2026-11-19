import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  it("cada rutina enseña nombre, recuento con músculos, miniaturas con «+N» y «Empezar»", () => {
    const h = handlers();
    render(<MyRoutines routines={[routine("Martes", "Pierna pesada", 6), routine("Jueves", "Brazos", 1)]} limitReached={false} {...h} />);
    expect(screen.getByRole("heading", { name: "Mis rutinas" })).toBeInTheDocument();
    expect(screen.getByText("2 rutinas tuyas")).toBeInTheDocument();
    expect(screen.getByText("6 ejercicios · Pecho y espalda")).toBeInTheDocument();
    expect(screen.getByText("1 ejercicio · Pecho")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empezar Pierna pesada" }));
    expect(h.onStart).toHaveBeenCalledWith("Martes");
    expect(screen.getByRole("button", { name: "Más acciones de Brazos" })).toBeInTheDocument();
  });

  it("sin rutinas invita a crear la primera; con siete sesiones lo dice en claro", () => {
    const h = handlers();
    const { rerender } = render(<MyRoutines routines={[]} limitReached={false} {...h} />);
    expect(screen.getByText("Crea tu primera rutina")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Nueva rutina/ })[0]);
    expect(h.onNew).toHaveBeenCalled();
    rerender(<MyRoutines routines={[routine("Lunes", "Torso", 2)]} limitReached {...h} />);
    expect(screen.getByRole("status")).toHaveTextContent("Tienes 7 sesiones: borra o edita una para añadir otra");
  });

  it("una rutina con entreno a medias se continúa y la hecha hoy no se vuelve a empezar", () => {
    render(<MyRoutines routines={[routine("Lunes", "Torso", 2), routine("Martes", "Pierna", 2)]} limitReached={false} resumableDay="Lunes" doneToday={["Martes"]} {...handlers()} />);
    expect(screen.getByRole("button", { name: "Continuar Torso" })).toHaveTextContent("Continuar entreno");
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
});
