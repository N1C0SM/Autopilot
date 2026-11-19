import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ExerciseRowEditor from "@/app/components/dashboard/ExerciseRowEditor";
import type { GymExerciseEntry } from "@/shared/types/training";

vi.mock("@/shared/lib/native", () => ({ hapticSelection: vi.fn(), hapticTap: vi.fn(), isNative: () => false }));

afterEach(cleanup);

const base = {
  exercise_id: "e1",
  name: "Remo con barra",
  series: 4,
  reps: "8-12",
  weight: "60",
  rest: "75 s",
} as unknown as GymExerciseEntry;

const open = (ex: Partial<GymExerciseEntry> = {}, onChange = vi.fn()) => {
  render(<ExerciseRowEditor ex={{ ...base, ...ex } as GymExerciseEntry} index={0} total={1} onChange={onChange} onMove={vi.fn()} onRemove={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /Remo con barra/ }));
  return onChange;
};

/** Radix cambia de pestaña al pulsar con el ratón (mousedown), como en el navegador. */
const pickTab = (name: string) => fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });

describe("fila del editor de rutina", () => {
  it("abre unas reps «8-12» y un descanso «75 s» tal cual, sin cambiarlos", () => {
    const onChange = open();
    expect(screen.getByRole("tab", { name: "Rango" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Mínimo de repeticiones")).toHaveValue("8");
    expect(screen.getByLabelText("Máximo de repeticiones")).toHaveValue("12");
    expect(screen.getByRole("button", { name: "Otro descanso" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Descanso en segundos")).toHaveValue("75");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("resumen plegado con su unidad: «4 series · 20-60 s · 3 min»", () => {
    render(<ExerciseRowEditor ex={{ ...base, reps: "20-60s", rest: "180s" } as unknown as GymExerciseEntry} index={0} total={1} onChange={vi.fn()} onMove={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("4 series · 20-60 s · 3 min")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remo con barra: 4 series, de 20 a 60 segundos, descanso de 3 minutos" })).toBeInTheDocument();
  });

  it("cambiar el peso no toca las reps ni el descanso", () => {
    const onChange = open();
    fireEvent.change(screen.getByLabelText("Peso en kilos"), { target: { value: "62,5" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reps: "8-12", rest: "75 s", weight: "62.5" }));
  });

  it("un peso guardado como número se abre con coma y una segunda coma no se guarda", () => {
    const onChange = open({ weight: 62.5 as unknown as string });
    const weight = screen.getByLabelText("Peso en kilos");
    expect(weight).toHaveValue("62,5");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(weight, { target: { value: "62,5," } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ weight: "62.5", reps: "8-12" }));
  });

  it("el rango se edita por su mínimo y su máximo y se guarda «8-13»", () => {
    const onChange = open();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar máximo de repeticiones" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reps: "8-13", rest: "75 s" }));
    fireEvent.click(screen.getByRole("button", { name: "Reducir mínimo de repeticiones" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reps: "7-12" }));
  });

  it("el mínimo nunca pasa del máximo: lo escrito se ajusta al salir del campo", () => {
    const onChange = open();
    const min = screen.getByLabelText("Mínimo de repeticiones");
    fireEvent.change(min, { target: { value: "15" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(min);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reps: "11-12" }));
  });

  it("tocar una cifra deja escribir otra (la actual queda como pista) y salir sin escribir no cambia nada", () => {
    const onChange = open();
    const max = screen.getByLabelText("Máximo de repeticiones");
    fireEvent.focus(max);
    expect(max).toHaveValue("");
    expect(max).toHaveAttribute("placeholder", "12");
    fireEvent.blur(max);
    expect(max).toHaveValue("12");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.focus(max);
    fireEvent.change(max, { target: { value: "15" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reps: "8-15" }));
  });

  it("los isométricos «20-60s» conservan la «s» al editarlos", () => {
    const onChange = open({ reps: "20-60s" as unknown as number });
    expect(screen.getByLabelText("Mínimo de segundos")).toHaveValue("20");
    fireEvent.click(screen.getByRole("button", { name: "Aumentar mínimo de segundos" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reps: "25-60s" }));
  });

  it("«Fijo» deja una cifra con − / + y «Rango» la abre en «8-12»", () => {
    const onChange = open({ reps: 10 });
    expect(screen.getByRole("tab", { name: "Fijo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Repeticiones")).toHaveValue("10");
    fireEvent.click(screen.getByRole("button", { name: "Aumentar repeticiones" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reps: 11 }));
    pickTab("Rango");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reps: "8-12" }));
  });

  it("de «Rango» a «Fijo» queda su centro («8-12» → «10»)", () => {
    const onChange = open();
    pickTab("Fijo");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reps: "10" }));
  });

  it("un descanso rápido se guarda como el generador («180s»)", () => {
    const onChange = open({ rest: "90s" });
    expect(screen.getByRole("button", { name: "Descanso de 90 segundos" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Descanso de 3 minutos" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rest: "180s", reps: "8-12" }));
  });

  it("«Otro» abre un contador libre y guarda «105s»; el valor rápido elegido no se reescribe", () => {
    const onChange = open({ rest: "90 s" });
    fireEvent.click(screen.getByRole("button", { name: "Otro descanso" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Descanso en segundos")).toHaveValue("90");
    fireEvent.click(screen.getByRole("button", { name: "Aumentar descanso en segundos" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rest: "105s" }));
    fireEvent.change(screen.getByLabelText("Descanso en segundos"), { target: { value: "75" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rest: "75s" }));
  });

  it("un texto guardado («AMRAP», «60-90 s») se ve tal cual y escribir su número de partida lo cambia", () => {
    const onChange = open({ reps: "AMRAP" as unknown as number, rest: "60-90 s" });
    const reps = screen.getByLabelText("Repeticiones");
    expect(reps).toHaveValue("AMRAP");
    expect(screen.getByLabelText("Descanso en segundos")).toHaveValue("60-90 s");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.focus(reps);
    fireEvent.change(reps, { target: { value: "10" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reps: "10", rest: "60-90 s" }));
    fireEvent.change(screen.getByLabelText("Descanso en segundos"), { target: { value: "60" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rest: "60s" }));
  });

  it("tocar el descanso que ya estaba elegido no reescribe «90 s»", () => {
    const onChange = open({ rest: "90 s" });
    fireEvent.click(screen.getByRole("button", { name: "Descanso de 90 segundos" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
