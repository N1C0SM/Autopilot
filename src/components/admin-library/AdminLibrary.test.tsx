import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TrainingRulesEditor from "@/components/admin/TrainingRulesEditor";
import GoalPhysiquesEditor from "@/components/admin/GoalPhysiquesEditor";
import ExerciseLibrary from "@/components/admin/ExerciseLibrary";

const db = vi.hoisted(() => ({
  tables: {} as Record<string, unknown>,
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const select = (table: string) => {
    const result = () => Promise.resolve({ data: db.tables[table], error: null });
    const chain: Record<string, unknown> = {};
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.single = result;
    chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject);
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => ({
        select: () => select(table),
        update: (payload: unknown) => ({
          eq: (_column: string, id: string) => {
            db.update(table, payload, id);
            return Promise.resolve({ error: null });
          },
        }),
        delete: () => ({
          eq: (_column: string, id: string) => {
            db.remove(table, id);
            return Promise.resolve({ error: null });
          },
        }),
      }),
      storage: { from: () => ({ remove: () => Promise.resolve({ error: null }) }) },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TrainingRulesEditor", () => {
  beforeEach(() => {
    db.tables.training_rules = {
      id: "rules-1",
      min_sets_per_session: 8, max_sets_per_session: 20,
      series_p1_min: 3, series_p1_max: 5, series_p2_min: 3, series_p2_max: 4, series_p3_min: 2, series_p3_max: 3,
      reps_fuerza: "4-8", reps_hipertrofia: "8-15", reps_resistencia: "15-25", reps_isometrico: "20-60s",
      rest_fuerza: "180s", rest_hipertrofia: "90s", rest_resistencia: "45s", rest_isometrico: "60s",
      max_consecutive_high_fatigue: 2, max_heavy_hinges: 1, max_pattern_repeats: 2, push_pull_max_diff: 1,
      max_p2_exercises: 2, max_p3_exercises: 2,
      required_patterns: ["Empuje"],
      recovery_hours: { Pecho: 48 },
    };
  });

  it("saves the edited values", async () => {
    render(<TrainingRulesEditor />);
    const min = await screen.findByLabelText("Mínimo de series");
    expect(min).toHaveValue(8);
    fireEvent.change(min, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(db.update).toHaveBeenCalledWith("training_rules", expect.objectContaining({ min_sets_per_session: 10 }), "rules-1"),
    );
  });

  it("restores the defaults without saving them", async () => {
    render(<TrainingRulesEditor />);
    const min = await screen.findByLabelText("Mínimo de series");
    fireEvent.click(screen.getByRole("button", { name: "Restablecer" }));
    expect(min).toHaveValue(12);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("toggles the required patterns", async () => {
    render(<TrainingRulesEditor />);
    const chip = await screen.findByRole("button", { name: "Aislamiento" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("labels the repetitions and the rest of every stimulus in separate groups", async () => {
    render(<TrainingRulesEditor />);
    expect(await screen.findByRole("heading", { name: "Repeticiones por estímulo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Descanso por estímulo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Repeticiones de Fuerza")).toHaveValue("4-8");
    expect(screen.getByLabelText("Descanso de Fuerza")).toHaveValue("180s");
    expect(screen.getByLabelText("Descanso de Isométrico")).toHaveValue("60s");
  });

  it("gives every recovery input an id without whitespace", async () => {
    (db.tables.training_rules as { recovery_hours: Record<string, number> }).recovery_hours = {
      "Cuerpo completo": 48,
      Pecho: 48,
    };
    render(<TrainingRulesEditor />);
    const wholeBody = await screen.findByLabelText("Horas de recuperación de Cuerpo completo");
    expect(wholeBody.id).toBe("rule-recovery-cuerpo-completo");
    expect(wholeBody.id).not.toMatch(/\s/);
    expect(screen.getByLabelText("Horas de recuperación de Pecho").id).toBe("rule-recovery-pecho");
  });
});

describe("GoalPhysiquesEditor", () => {
  beforeEach(() => {
    db.tables.goal_physiques = [
      { id: "p1", name: "Jason", image_url: "https://example.com/p1.jpg", sort_order: 0, visible: true },
      { id: "p2", name: "David", image_url: "", sort_order: 1, visible: false },
    ];
  });

  it("lists each physique as a row with its visibility", async () => {
    render(<GoalPhysiquesEditor />);
    expect(await screen.findByText("Jason")).toBeInTheDocument();
    expect(screen.getByText("David")).toBeInTheDocument();
    expect(screen.getByText("Visible")).toBeInTheDocument();
    expect(screen.getByText("Oculto")).toBeInTheDocument();
  });

  it("replaces a broken photo with the composed placeholder", async () => {
    const { container } = render(<GoalPhysiquesEditor />);
    await screen.findByText("Jason");
    const photo = container.querySelector("img");
    expect(photo).not.toBeNull();
    fireEvent.error(photo as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
  });

  it("edits a physique in a sheet and saves it", async () => {
    render(<GoalPhysiquesEditor />);
    fireEvent.click(await screen.findByText("Jason"));
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("Nombre"), { target: { value: "Jason B" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(db.update).toHaveBeenCalledWith("goal_physiques", expect.objectContaining({ name: "Jason B", visible: true }), "p1"),
    );
  });

  it("asks for confirmation before deleting", async () => {
    render(<GoalPhysiquesEditor />);
    fireEvent.click(await screen.findByText("Jason"));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Eliminar físico" }));

    const alert = await screen.findByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "Cancelar" }));
    expect(db.remove).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByText("Jason"));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Eliminar físico" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(db.remove).toHaveBeenCalledWith("goal_physiques", "p1"));
  });
});

describe("ExerciseLibrary", () => {
  beforeEach(() => {
    db.tables.exercises = [
      {
        id: "e1", name: "Press banca", muscle_group: "Pecho", exercise_type: "Gimnasio",
        image_url: "https://example.com/e1.jpg", video_url: "https://example.com/e1.mp4", media_style_version: 2,
      },
      {
        id: "e2", name: "Dominadas", muscle_group: "Espalda", exercise_type: "Calistenia",
        image_url: null, video_url: null, media_style_version: 2, media_error: "Sin créditos",
      },
    ];
  });

  it("shows a spinner, not the empty state, while the library loads", async () => {
    render(<ExerciseLibrary />);
    expect(screen.getByRole("status", { name: "Cargando" })).toBeInTheDocument();
    expect(screen.queryByText("Aún no hay ejercicios")).not.toBeInTheDocument();
    expect(await screen.findByText("Press banca")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Cargando" })).not.toBeInTheDocument();
  });

  it("shows the empty state once an empty library has loaded", async () => {
    db.tables.exercises = [];
    render(<ExerciseLibrary />);
    expect(await screen.findByText("Aún no hay ejercicios")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Cargando" })).not.toBeInTheDocument();
  });

  it("lists the exercises and narrows them with the search", async () => {
    render(<ExerciseLibrary />);
    expect(await screen.findByText("Press banca")).toBeInTheDocument();
    expect(screen.getByText("2 de 2 ejercicios")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar ejercicio"), { target: { value: "domin" } });
    expect(screen.queryByText("Press banca")).not.toBeInTheDocument();
    expect(screen.getByText("1 de 2 ejercicios")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar ejercicio"), { target: { value: "zzz" } });
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("filters by media status with the chips", async () => {
    render(<ExerciseLibrary />);
    await screen.findByText("Press banca");
    const chip = screen.getByRole("button", { name: /^Sin imagen ·/ });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Press banca")).not.toBeInTheDocument();
    expect(screen.getByText("Dominadas")).toBeInTheDocument();
  });

  it("replaces a broken thumbnail with the composed placeholder", async () => {
    const { container } = render(<ExerciseLibrary />);
    await screen.findByText("Press banca");
    const thumb = container.querySelector('img[src="https://example.com/e1.jpg"]');
    expect(thumb).not.toBeNull();
    fireEvent.error(thumb as HTMLImageElement);
    expect(container.querySelector('img[src="https://example.com/e1.jpg"]')).toBeNull();
  });

  it("offers the video preview only when there is media", async () => {
    render(<ExerciseLibrary />);
    await screen.findByText("Press banca");
    expect(screen.getByRole("button", { name: "Ver el vídeo de Press banca" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver el vídeo de Dominadas" })).not.toBeInTheDocument();
  });

  it("opens the editor from a row and deletes only after confirming", async () => {
    render(<ExerciseLibrary />);
    fireEvent.click(await screen.findByText("Dominadas"));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("Editar ejercicio")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Eliminar ejercicio" }));

    const alert = await screen.findByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "Cancelar" }));
    expect(db.remove).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByText("Dominadas"));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Eliminar ejercicio" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(db.remove).toHaveBeenCalledWith("exercises", "e2"));
  });

  it("opens an empty editor from the new exercise button", async () => {
    render(<ExerciseLibrary />);
    await screen.findByText("Press banca");
    fireEvent.click(screen.getByRole("button", { name: "Nuevo ejercicio" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("Nuevo ejercicio")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Añadir ejercicio" })).toBeDisabled();
    const classify = within(sheet).getByRole("button", { name: "Clasificar con IA" });
    expect(classify).toHaveTextContent("Clasificar");
    expect(classify).toBeDisabled();
    expect(within(sheet).queryByRole("button", { name: "Eliminar ejercicio" })).not.toBeInTheDocument();
  });
});
