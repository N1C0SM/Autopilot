import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PlanVideos from "@/app/components/admin-library/PlanVideos";

const db = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  secrets: {} as Record<string, string>,
  invoke: vi.fn(),
}));

vi.mock("@/shared/integrations/supabase/client", () => {
  const select = (table: string) => {
    const chain: Record<string, unknown> = {};
    let key = "";
    chain.order = () => chain;
    chain.eq = (_column: string, value: string) => { key = value; return chain; };
    chain.range = (from: number, to: number) => Promise.resolve({ data: (db.tables[table] ?? []).slice(from, to + 1), error: null });
    chain.maybeSingle = () => Promise.resolve({ data: key in db.secrets ? { value: db.secrets[key] } : null, error: null });
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => ({ select: () => select(table) }),
      functions: { invoke: (name: string, options: { body: unknown }) => db.invoke(name, options.body) },
    },
  };
});

const plan = (...names: string[]) => [{ day: "A", type: "gimnasio", exercises: names.map((name) => ({ exercise_id: "", name })) }];

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  db.secrets = {};
  db.tables.training_plan = [{ workouts_json: plan("Press banca", "Sentadilla") }, { workouts_json: plan("Remo con barra", "Dominadas") }];
  db.tables.exercises = [
    { id: "a", name: "Press banca", image_url: "https://x/a.webp", video_url: "https://x/a.mp4" },
    { id: "b", name: "Sentadilla", image_url: "https://x/b.webp", video_url: null },
    { id: "c", name: "Dominadas", image_url: null, video_url: null },
    { id: "d", name: "Remo con barra", image_url: "https://x/d.webp", video_url: null },
    { id: "e", name: "Curl de bíceps", image_url: "https://x/e.webp", video_url: null },
  ];
  db.invoke.mockImplementation((_name: string, body: { exercise_id: string }) =>
    Promise.resolve({ data: { status: "completed", video_url: `https://x/${body.exercise_id}.mp4` }, error: null }));
});

describe("Admin → Biblioteca: vídeos de los ejercicios de los planes", () => {
  it("cuenta los que usan los planes y aún no tienen vídeo, con el coste a 1,6 créditos por vídeo", async () => {
    render(<PlanVideos />);
    expect(await screen.findByText("4 ejercicios en los planes · 1 con vídeo · 3 sin vídeo")).toBeInTheDocument();
    expect(screen.getByText("2 vídeos de 4 s · ≈3,2 créditos de Lovable (1,6 por vídeo)")).toBeInTheDocument();
    expect(screen.getByText(/1 necesita antes su foto/)).toBeInTheDocument();
    expect(screen.getByText("≈3,2")).toBeInTheDocument();
    expect(db.invoke).not.toHaveBeenCalled();
  });

  it("pide confirmación y genera uno a uno, saltando los que ya tienen vídeo", async () => {
    const onChanged = vi.fn();
    render(<PlanVideos onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Generar vídeos de los ejercicios de los planes" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("¿Generar 2 vídeos?")).toBeInTheDocument();
    expect(within(dialog).getByText(/≈3,2 créditos de Lovable/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Ahora no" }));
    expect(db.invoke).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Generar vídeos de los ejercicios de los planes" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Generar 2 vídeos" }));
    await waitFor(() => expect(screen.getByText("Listo: 2 vídeos nuevos.")).toBeInTheDocument());
    expect(db.invoke.mock.calls.map(([name, body]) => [name, body])).toEqual([
      ["exercise-video", { exercise_id: "d", action: "create" }],
      ["exercise-video", { exercise_id: "b", action: "create" }],
    ]);
    expect(onChanged).toHaveBeenCalled();
  });

  it("«Parar» termina el vídeo en curso y no empieza el siguiente", async () => {
    let finish: (value: unknown) => void = () => undefined;
    db.invoke.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<PlanVideos />);
    fireEvent.click(await screen.findByRole("button", { name: "Generar vídeos de los ejercicios de los planes" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Generar 2 vídeos" }));
    expect(await screen.findByText("Generando 1 de 2")).toBeInTheDocument();
    expect(screen.getByText("Remo con barra")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Parar" }));
    expect(screen.getByText("Parando al terminar este vídeo…")).toBeInTheDocument();
    finish({ data: { status: "completed", video_url: "https://x/d.mp4" }, error: null });
    await waitFor(() => expect(screen.getByText("Parado: 1 de 2 vídeos creados.")).toBeInTheDocument());
    expect(db.invoke).toHaveBeenCalledTimes(1);
  });

  it("lista los que fallan y sigue con el resto", async () => {
    db.invoke.mockImplementationOnce(() => Promise.resolve({ data: { error: "La generación del vídeo falló" }, error: null }));
    render(<PlanVideos />);
    fireEvent.click(await screen.findByRole("button", { name: "Generar vídeos de los ejercicios de los planes" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Generar 2 vídeos" }));
    await waitFor(() => expect(screen.getByText("Listo: 1 vídeo nuevo.")).toBeInTheDocument());
    expect(screen.getByText("Para reintentar (1)")).toBeInTheDocument();
    expect(screen.getByText(/La generación del vídeo falló/)).toBeInTheDocument();
    expect(db.invoke).toHaveBeenCalledTimes(2);
  });

  it("con los vídeos en pausa lo dice, explica dónde activarlos y no lanza nada", async () => {
    db.secrets.AI_VIDEO_ENABLED = "0";
    render(<PlanVideos />);
    expect(await screen.findByRole("button", { name: "Vídeos en pausa" })).toBeDisabled();
    expect(screen.getByText(/Actívalos en Admin → Landing → Claves de IA → Vídeos de ejercicios/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generar vídeos de los ejercicios de los planes" })).not.toBeInTheDocument();
    expect(db.invoke).not.toHaveBeenCalled();
  });
});
