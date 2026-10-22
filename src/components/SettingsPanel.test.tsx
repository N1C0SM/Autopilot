import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPanel from "./SettingsPanel";

type Meal = { name: string; description: string };
const defaultMeals: Meal[] = [
  { name: "Desayuno", description: "Avena con plátano" },
  { name: "Almuerzo", description: "Pollo con arroz" },
  { name: "Merienda", description: "Yogur con nueces" },
  { name: "Cena", description: "Salmón con verduras" },
];

const mocks = vi.hoisted(() => ({
  user: { id: "user", email: "test@example.com", new_email: null as string | null },
  tier: "full", paid: "paid", status: "active", end: null as string | null, travelUntil: null as string | null,
  ios: false, plan: null as string | null, avatar: "" as string,
  availability: { days: "2", hours: "0.92", training_days: [1, 3], auto_calculated: true, sport_schedules: { running: "18:00" } } as Record<string, unknown>,
  onboarding: {} as Record<string, unknown>,
  saves: [] as Record<string, unknown>[],
  updates: [] as { table: string; row: Record<string, unknown> }[],
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  // A-01: orden de llamadas (Auth antes que profiles) y respuesta configurable de Auth.
  calls: [] as string[],
  authError: null as { message: string } | null,
  confirmedEmail: null as string | null,
  syncResponse: { data: { updated: false, reason: "no_access" } as unknown, error: null as unknown },
  mealsResponse: { data: { meals: [] as Meal[] } as unknown, error: null as unknown },
  uploads: [] as { bucket: string; path: string; file: File }[],
  uploadError: null as { message: string } | null,
  invoked: [] as string[],
  invokeArgs: [] as { name: string; body?: unknown }[],
  compressImage: vi.fn(async (file: File) => file),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/platform", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/platform")>()), isIOSNative: () => mocks.ios }));
vi.mock("@/lib/imageCompression", () => ({ compressImage: mocks.compressImage }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user, signOut: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const query = { select: () => query, eq: () => query, maybeSingle: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "profiles" ? { avatar_url: mocks.avatar, name: "Ana Ruiz", subscription_tier: mocks.tier, payment_status: mocks.paid, subscription_status: mocks.status, subscription_end: mocks.end, travel_mode_until: mocks.travelUntil, travel_equipment: "gomas" } : table === "onboarding" ? { availability: mocks.availability, ...mocks.onboarding } : null, error: null }).then(resolve),
      upsert: (row: Record<string, unknown>) => { mocks.saves.push(row); return Promise.resolve({ error: null }); },
      update: (row: Record<string, unknown>) => { mocks.updates.push({ table, row }); mocks.calls.push(`${table}.update`); return query; },
    }; return query;
  },
  rpc: () => Promise.resolve({ data: {} }),
  functions: { invoke: (name: string, options?: { body?: unknown }) => {
    mocks.invoked.push(name);
    mocks.invokeArgs.push({ name, body: options?.body });
    if (name === "sync-nutrition-macros") return Promise.resolve(mocks.syncResponse);
    if (name === "ai-generate-meals") return Promise.resolve(mocks.mealsResponse);
    if (name === "check-subscription" && mocks.plan) return Promise.resolve({ data: { plan: mocks.plan }, error: null });
    return Promise.resolve({ data: {}, error: null });
  } },
  auth: { updateUser: vi.fn(async (payload: { email?: string }) => {
    mocks.calls.push("auth.updateUser");
    if (mocks.authError) return { data: { user: null }, error: mocks.authError };
    return { data: { user: { ...mocks.user, email: mocks.confirmedEmail ?? mocks.user.email } }, error: null };
  }) },
  storage: { from: (bucket: string) => ({
    upload: (path: string, file: File) => {
      mocks.uploads.push({ bucket, path, file });
      return Promise.resolve({ error: mocks.uploadError });
    },
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${bucket}/${path}` } }),
  }) },
} }));
beforeEach(() => {
  mocks.tier = "full"; mocks.paid = "paid"; mocks.status = "active"; mocks.end = null; mocks.travelUntil = null; mocks.saves = []; mocks.updates = [];
  mocks.ios = false; mocks.plan = null; mocks.avatar = "";
  mocks.user.email = "test@example.com"; mocks.user.new_email = null;
  mocks.onboarding = {}; mocks.calls = []; mocks.invoked = []; mocks.invokeArgs = [];
  mocks.authError = null; mocks.confirmedEmail = null;
  mocks.syncResponse = { data: { updated: false, reason: "no_access" }, error: null };
  mocks.mealsResponse = { data: { meals: defaultMeals }, error: null };
  mocks.uploads = []; mocks.uploadError = null; mocks.compressImage.mockClear();
  mocks.toast.error.mockClear(); mocks.toast.success.mockClear(); mocks.toast.info.mockClear();
});
afterEach(cleanup);
const show = () => render(<MemoryRouter><SettingsPanel /></MemoryRouter>);
describe("settings plan labels and availability", () => {
  it.each([["full", "Coach"], ["personal", "Coach"], ["training", "Plus"], ["free", "Free"]])("shows the shared name for stored tier %s", async (tier, name) => {
    mocks.tier = tier; show();
    expect(await screen.findByText(`Plan ${name}`)).toBeVisible();
  });
  it("does not label expired paid access as an active Coach plan", async () => {
    mocks.end = "2000-01-01T00:00:00Z"; show();
    expect(await screen.findByText("Plan Free")).toBeVisible();
    expect(screen.queryByText("Suscripción activa")).not.toBeInTheDocument();
  });
  it("reads current capacity and preserves schedule metadata when saving other profile data", async () => {
    show();
    expect(await screen.findByRole("spinbutton", { name: "Días/semana" })).toHaveValue(2);
    expect(screen.getByRole("spinbutton", { name: "Minutos/sesión" })).toHaveValue(55);
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    await waitFor(() => expect(mocks.saves).toHaveLength(1));
    expect(mocks.saves[0].availability).toEqual(mocks.availability);
  });
  it("overlays manual capacity while retaining chosen weekdays and sports", async () => {
    show(); await screen.findByRole("spinbutton", { name: "Días/semana" });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Días/semana" }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    await waitFor(() => expect(mocks.saves).toHaveLength(1));
    expect(mocks.saves[0].availability).toEqual({ ...mocks.availability, days: "3", auto_calculated: false });
  });
});

describe("settings goal and rest controls", () => {
  it("moves the goal with the arrow keys, keeps a single tab stop and saves the chosen goal", async () => {
    show();
    const radios = await screen.findAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: "ArrowDown" });
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(radios[1]).toHaveFocus();
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    await waitFor(() => expect(mocks.saves).toHaveLength(1));
    expect(mocks.saves[0].goal).toBe("gain_muscle");
  });
  it("names the rest presets control for assistive technology", async () => {
    show();
    const presets = await screen.findByRole("tablist", { name: "Descanso entre series" });
    expect(within(presets).getAllByRole("tab").length).toBeGreaterThan(0);
  });
});

describe("settings account deletion", () => {
  it.each([
    ["active", "Tienes una suscripción activa", "Al eliminar la cuenta se cancela la suscripción y pierdes el acceso de inmediato, aunque hayas pagado hasta el final del periodo."],
    ["trialing", "Tienes una prueba activa", "Al eliminar la cuenta cancelas la prueba y pierdes el acceso de inmediato — aunque aún no se te haya cobrado."],
  ])("warns about a %s subscription before deleting the account", async (status, title, body) => {
    mocks.status = status; show();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar cuenta" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(title)).toBeVisible();
    expect(within(dialog).getByText(body)).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Sí, eliminar cuenta" })).toBeEnabled();
  });
  it("shows no subscription warning when a free account is deleted", async () => {
    mocks.tier = "free"; show();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar cuenta" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Esta acción elimina permanentemente tu cuenta/)).toBeVisible();
    expect(within(dialog).queryByText(/Tienes una (suscripción|prueba) activa/)).not.toBeInTheDocument();
  });
});

describe("settings travel mode", () => {
  it("asks for an end date before activating and does not write anything", async () => {
    show();
    fireEvent.click(await screen.findByRole("switch", { name: "Modo viaje" }));
    fireEvent.click(await screen.findByRole("button", { name: "Activar" }));
    expect(mocks.toast.error).toHaveBeenCalledWith("Indica hasta cuándo estarás de viaje");
    expect(mocks.updates).toHaveLength(0);
  });
  it("closes the form without saving when the switch is turned back off", async () => {
    show();
    const toggle = await screen.findByRole("switch", { name: "Modo viaje" });
    fireEvent.click(toggle);
    expect(await screen.findByLabelText("Equipamiento disponible")).toBeVisible();
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.queryByLabelText("Equipamiento disponible")).not.toBeInTheDocument());
    expect(mocks.updates).toHaveLength(0);
  });
  it("turns an active travel mode off from its switch and clears the stored trip", async () => {
    mocks.travelUntil = "2999-01-01"; show();
    const toggle = await screen.findByRole("switch", { name: "Modo viaje" });
    await waitFor(() => expect(toggle).toBeChecked());
    fireEvent.click(toggle);
    await waitFor(() => expect(mocks.updates).toContainEqual({ table: "profiles", row: { travel_mode_until: null, travel_equipment: null } }));
  });
});

describe("settings purchase surfaces", () => {
  const showWithUpgrade = () => render(<MemoryRouter><SettingsPanel onUpgrade={vi.fn()} /></MemoryRouter>);
  it("shows prices, the offer and the billing portal outside iOS", async () => {
    mocks.plan = "monthly"; show();
    expect(await screen.findByText(/^Mensual \(.+€\/mes\)$/)).toBeVisible();
    expect(screen.getByText(/ahorra .+€\/año/)).toBeVisible();
    expect(screen.getByText("Gestionar suscripción")).toBeVisible();
  });
  it("offers the upgrade and the trial to a free account outside iOS", async () => {
    mocks.tier = "free"; showWithUpgrade();
    expect(await screen.findByRole("button", { name: /^Mejorar a/ })).toBeVisible();
    expect(screen.getByText(/7 días de prueba/)).toBeVisible();
  });
  it("shows no price, offer or external billing on iOS, but lets you cancel in-app", async () => {
    mocks.ios = true; mocks.plan = "monthly";
    const { container } = showWithUpgrade();
    expect(await screen.findByText("Plan Coach")).toBeVisible();
    expect(await screen.findByText("Mensual")).toBeVisible();
    // §3.1.1: cancelar es gestión de cuenta y se hace dentro de la app; el
    // portal de Stripe (que permite contratar) no se abre en iOS.
    expect(screen.queryByText("Gestionar suscripción")).not.toBeInTheDocument();
    expect(await screen.findByText("Cancelar suscripción")).toBeVisible();
    expect(screen.queryByText(/ahorra/)).not.toBeInTheDocument();
    expect(screen.queryByText(/portal de gestión/)).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent("€");
  });
  it("shows no upgrade, trial or price on iOS for a free account", async () => {
    mocks.ios = true; mocks.tier = "free";
    const { container } = showWithUpgrade();
    expect(await screen.findByText("Plan Free")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Mejorar a|Ver /i })).not.toBeInTheDocument();
    expect(screen.queryByText(/7 días de prueba/)).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent("€");
  });
});

describe("settings profile avatar", () => {
  it("falls back to the initial when the avatar image fails to load", async () => {
    mocks.avatar = "https://cdn.test/avatar.jpg"; show();
    const button = await screen.findByRole("button", { name: "Cambiar foto de perfil" });
    const image = await waitFor(() => {
      const img = button.querySelector("img");
      expect(img).not.toBeNull();
      return img as HTMLImageElement;
    });
    fireEvent.error(image);
    expect(button.querySelector("img")).toBeNull();
    expect(within(button).getByText("A")).toBeInTheDocument();
  });
});

const fileInputOf = async (container: HTMLElement) => {
  // La foto se pinta cuando termina la carga inicial del panel.
  await screen.findByRole("button", { name: "Cambiar foto" });
  const input = container.querySelector('input[type="file"]');
  expect(input).toBeInstanceOf(HTMLInputElement);
  return input as HTMLInputElement;
};

describe("settings profile save (A-01)", () => {
  it("cambia el correo en Auth antes de tocar profiles y no lo guarda como confirmado si queda pendiente", async () => {
    mocks.confirmedEmail = null; // Supabase mantiene el correo antiguo hasta la confirmación
    show();
    fireEvent.change(await screen.findByLabelText("Correo electrónico"), { target: { value: "nuevo@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));

    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith("Perfil guardado"));
    expect(mocks.calls.indexOf("auth.updateUser")).toBeGreaterThanOrEqual(0);
    expect(mocks.calls.indexOf("auth.updateUser")).toBeLessThan(mocks.calls.indexOf("profiles.update"));
    // profiles solo recibe el nombre: el correo no está confirmado.
    expect(mocks.updates.filter((u) => u.table === "profiles").map((u) => u.row)).toEqual([{ name: "Ana Ruiz" }]);
    expect(mocks.toast.info).toHaveBeenCalledWith(expect.stringContaining("confirmación"));
  });

  it("guarda el correo en profiles cuando Auth lo acepta al momento", async () => {
    mocks.confirmedEmail = "nuevo@example.com";
    show();
    fireEvent.change(await screen.findByLabelText("Correo electrónico"), { target: { value: "nuevo@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));

    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith("Perfil guardado"));
    expect(mocks.updates.filter((u) => u.table === "profiles").map((u) => u.row)).toEqual([
      { name: "Ana Ruiz", email: "nuevo@example.com" },
    ]);
    expect(mocks.toast.info).not.toHaveBeenCalled();
  });

  it("no escribe nada en profiles si Auth rechaza el cambio de correo", async () => {
    mocks.authError = { message: "Email address is invalid" };
    show();
    fireEvent.change(await screen.findByLabelText("Correo electrónico"), { target: { value: "mal@correo" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith(expect.stringContaining("no parece válido")));
    expect(mocks.updates).toHaveLength(0);
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("marca la fila como guardada y vuelve a permitir guardar al editar", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Guardar perfil" }));
    expect(await screen.findByText("Guardado")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana R." } });
    expect(await screen.findByRole("button", { name: "Guardar perfil" })).toBeVisible();
  });
});

describe("settings nutrition feedback (A-01 / N-01)", () => {
  const saveNutritionChange = async () => {
    mocks.onboarding = { weight: 80, goal: "lose_weight", nutrition_preferences: "keto" };
    mocks.syncResponse = {
      data: { updated: true, macros: { protein: 197, carbs: 41, fats: 148, calories: 2284 } },
      error: null,
    };
    const view = show();
    const weight = await screen.findByRole("spinbutton", { name: "Peso (kg)" });
    expect(weight).toHaveValue(80);
    fireEvent.change(weight, { target: { value: "82" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    await screen.findByRole("status");
    return view;
  };

  it("informa de las macros actualizadas y avisa de que las comidas están desactualizadas", async () => {
    await saveNutritionChange();
    expect(mocks.toast.success).toHaveBeenCalledWith("Datos guardados");
    expect(mocks.toast.success).toHaveBeenCalledWith("Macros actualizados");
    expect(screen.getByRole("status")).toHaveTextContent(/plan de comidas está desactualizado/i);
  });

  it("regenera las comidas solo tras confirmarlo y lo pide al servidor", async () => {
    await saveNutritionChange();
    // La regeneración la hace el servidor (sync-nutrition-macros), que sí puede
    // escribir nutrition_plan; el cliente no tiene permiso de escritura.
    mocks.syncResponse = { data: { updated: true, meals_updated: true }, error: null };
    fireEvent.click(screen.getByRole("button", { name: "Regenerar comidas" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Recalcularemos el plan de comidas/)).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Regenerar comidas" }));

    await waitFor(() =>
      expect(mocks.invokeArgs).toContainEqual({
        name: "sync-nutrition-macros",
        body: { regenerate_meals: true },
      }),
    );
    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith("Comidas actualizadas"));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("explica por qué no actualiza la nutrición cuando falta acceso", async () => {
    mocks.onboarding = { weight: 80, goal: "lose_weight" };
    show();
    fireEvent.change(await screen.findByRole("spinbutton", { name: "Peso (kg)" }), { target: { value: "81" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));

    await waitFor(() => expect(mocks.toast.info).toHaveBeenCalledWith(expect.stringContaining("no la incluye")));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("no finge éxito si la sincronización de macros falla", async () => {
    mocks.onboarding = { weight: 80, goal: "lose_weight" };
    mocks.syncResponse = { data: null, error: { message: "network" } };
    show();
    fireEvent.change(await screen.findByRole("spinbutton", { name: "Peso (kg)" }), { target: { value: "81" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith("Tus datos se han guardado, pero no se pudo actualizar la nutrición. Inténtalo de nuevo."),
    );
  });
});

describe("settings avatar upload", () => {
  it("rechaza archivos que no son imágenes sin comprimirlos", async () => {
    const { container } = show();
    fireEvent.change(await fileInputOf(container), { target: { files: [new File(["hola"], "nota.txt", { type: "text/plain" })] } });

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Ese archivo no es una imagen. Usa JPG, PNG o WebP."));
    expect(mocks.compressImage).not.toHaveBeenCalled();
    expect(mocks.uploads).toHaveLength(0);
  });

  it("rechaza una foto de más de 10 MB antes de comprimir", async () => {
    const { container } = show();
    const huge = new File([new Uint8Array(11 * 1024 * 1024)], "enorme.jpg", { type: "image/jpeg" });
    fireEvent.change(await fileInputOf(container), { target: { files: [huge] } });

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("La imagen es demasiado grande (máximo 10 MB)."));
    expect(mocks.compressImage).not.toHaveBeenCalled();
    expect(mocks.uploads).toHaveLength(0);
  });

  it("comprime la foto antes de subirla y confirma con un toast", async () => {
    const { container } = show();
    const original = new File(["foto-grande"], "foto.png", { type: "image/png" });
    const compressed = new File(["foto-comprimida"], "foto.jpg", { type: "image/jpeg" });
    mocks.compressImage.mockResolvedValueOnce(compressed);

    fireEvent.change(await fileInputOf(container), { target: { files: [original] } });

    await waitFor(() => expect(mocks.uploads).toHaveLength(1));
    expect(mocks.compressImage).toHaveBeenCalledWith(original, expect.objectContaining({ maxDimension: 1024, mimeType: "image/jpeg" }));
    expect(mocks.uploads[0]).toEqual({ bucket: "avatars", path: "user/avatar.jpg", file: compressed });
    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith("Foto actualizada"));
    expect(mocks.updates.some((u) => u.table === "profiles" && typeof u.row.avatar_url === "string")).toBe(true);
  });
});
