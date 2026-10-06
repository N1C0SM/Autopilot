import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ProgressPhotos from "./ProgressPhotos";

const mocks = vi.hoisted(() => ({
  orderByTakenAt: vi.fn(),
  orderByCreatedAt: vi.fn(),
  insert: vi.fn(),
  deleteRecord: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  signedUrlsWithExpiry: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: mocks.orderByTakenAt }) }),
      insert: mocks.insert,
      delete: () => ({ eq: mocks.deleteRecord }),
    }),
    storage: {
      from: () => ({
        upload: mocks.upload,
        remove: mocks.remove,
      }),
    },
  },
}));

vi.mock("@/lib/storageSign", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storageSign")>();
  // Mantenemos `storagePathFor` real (es lo que se prueba al borrar) y solo
  // sustituimos la firma de URLs.
  return { ...actual, signedUrlsWithExpiry: mocks.signedUrlsWithExpiry };
});

vi.mock("sonner", () => ({
  toast: { success: mocks.success, warning: mocks.warning, error: mocks.error },
}));

const photoRow = (overrides: Record<string, unknown> = {}) => ({
  id: "photo-1",
  photo_url: "user/photo.png",
  note: "",
  taken_at: "2025-01-01",
  created_at: "2025-01-01T10:00:00Z",
  ...overrides,
});

const signEverything = (values: string[]) => ({
  urls: new Map((values || []).filter(Boolean).map((v) => [v, `https://signed.test/${v}?token=abc`])),
  expiresAtMs: Date.now() + 3_600_000,
  refreshAtMs: Date.now() + 3_300_000,
});

const noSignature = () => ({
  urls: new Map<string, string>(),
  expiresAtMs: Date.now() + 3_600_000,
  refreshAtMs: Date.now() + 3_300_000,
});

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.orderByTakenAt.mockReturnValue({ order: mocks.orderByCreatedAt });
  mocks.orderByCreatedAt.mockResolvedValue({ data: [], error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.deleteRecord.mockResolvedValue({ error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.signedUrlsWithExpiry.mockImplementation(
    async (_bucket: string, values: string[]) => signEverything(values)
  );
  vi.stubGlobal("crypto", { randomUUID: () => "photo-id" });
});

const uploadFiles = async (container: HTMLElement, files: File[]) => {
  const input = container.querySelector('input[type="file"]');
  expect(input).not.toBeNull();
  await act(async () => {
    fireEvent.change(input!, { target: { files } });
  });
};

const openDeleteDialog = async () => {
  fireEvent.click(await screen.findByRole("button", { name: /Progreso/ }));
  fireEvent.click(screen.getByRole("button", { name: "Eliminar foto" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar foto" }));
};

describe("progress photos", () => {
  it("pide un orden determinista (taken_at + created_at)", async () => {
    render(<ProgressPhotos userId="user" />);
    await waitFor(() => expect(mocks.orderByCreatedAt).toHaveBeenCalled());

    expect(mocks.orderByTakenAt).toHaveBeenCalledWith("taken_at", { ascending: false });
    expect(mocks.orderByCreatedAt).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("does not report an upload as successful when its database record fails", async () => {
    mocks.insert.mockResolvedValue({ error: new Error("metadata failed") });
    const { container } = render(<ProgressPhotos userId="user" />);
    await screen.findByText("Empieza a documentar tu progreso");

    await uploadFiles(container, [new File(["photo"], "progress.png", { type: "image/png" })]);

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(["user/photo-id.png"]));
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("No se pudo subir la foto"));
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("guarda la ruta del objeto (no la URL pública) al subir", async () => {
    const { container } = render(<ProgressPhotos userId="user" />);
    await screen.findByText("Empieza a documentar tu progreso");

    await uploadFiles(container, [new File(["photo"], "IMG_1234.JPG", { type: "image/jpeg" })]);

    await waitFor(() => expect(mocks.insert).toHaveBeenCalled());
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ photo_url: "user/photo-id.jpg" }));
    expect(mocks.success).toHaveBeenCalledWith("Foto subida correctamente 📸");
  });

  it("continúa con el resto del lote cuando un archivo no es válido", async () => {
    const { container } = render(<ProgressPhotos userId="user" />);
    await screen.findByText("Empieza a documentar tu progreso");

    await uploadFiles(container, [
      new File(["texto"], "notas.txt", { type: "text/plain" }),
      new File(["foto"], "foto.png", { type: "image/png" }),
    ]);

    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    expect(mocks.warning).toHaveBeenCalledWith(expect.stringContaining("Se omitió 1 archivo"));
    expect(mocks.success).toHaveBeenCalledWith("Foto subida correctamente 📸");
  });

  it("muestra un marcador en vez de un src vacío si no hay URL firmada", async () => {
    mocks.orderByCreatedAt.mockResolvedValue({ data: [photoRow()], error: null });
    mocks.signedUrlsWithExpiry.mockResolvedValue(noSignature());

    const { container } = render(<ProgressPhotos userId="user" />);

    expect(await screen.findByRole("button", { name: /Progreso/ })).toBeInTheDocument();
    expect(container.querySelector('img[src=""]')).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renueva las URLs firmadas al recuperar el foco cuando la firma está vieja", async () => {
    mocks.orderByCreatedAt.mockResolvedValue({ data: [photoRow()], error: null });
    render(<ProgressPhotos userId="user" />);
    await screen.findByRole("button", { name: /Progreso/ });
    await waitFor(() => expect(mocks.signedUrlsWithExpiry).toHaveBeenCalledTimes(1));

    const later = Date.now() + 40 * 60_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(later);
    try {
      fireEvent.focus(window);
      await waitFor(() => expect(mocks.signedUrlsWithExpiry).toHaveBeenCalledTimes(2));
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("reintenta firmar una foto cuando su imagen falla al cargar", async () => {
    mocks.orderByCreatedAt.mockResolvedValue({ data: [photoRow()], error: null });
    const { container } = render(<ProgressPhotos userId="user" />);
    await screen.findByRole("button", { name: /Progreso/ });
    await waitFor(() => expect(mocks.signedUrlsWithExpiry).toHaveBeenCalledTimes(1));

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    await act(async () => {
      fireEvent.error(img!);
    });

    await waitFor(() => expect(mocks.signedUrlsWithExpiry).toHaveBeenCalledTimes(2));
  });

  it("shows a retry action when the photo list fails to load", async () => {
    mocks.orderByCreatedAt
      .mockResolvedValueOnce({ data: null, error: new Error("query failed") })
      .mockResolvedValueOnce({ data: [], error: null });
    render(<ProgressPhotos userId="user" />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(screen.getByText("Empieza a documentar tu progreso")).toBeVisible());
    expect(mocks.orderByCreatedAt).toHaveBeenCalledTimes(2);
  });

  it("requires confirmation before deleting a progress photo", async () => {
    mocks.orderByCreatedAt.mockResolvedValue({ data: [photoRow()], error: null });
    render(<ProgressPhotos userId="user" />);

    fireEvent.click(await screen.findByRole("button", { name: /Progreso/ }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar foto" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(mocks.deleteRecord).not.toHaveBeenCalled();
  });

  it("borra el archivo del bucket antes de la fila y descarta el query string", async () => {
    const legacyUrl =
      "https://proj.supabase.co/storage/v1/object/sign/progress-photos/user/photo.png?token=abc";
    mocks.orderByCreatedAt.mockResolvedValue({ data: [photoRow({ photo_url: legacyUrl })], error: null });
    render(<ProgressPhotos userId="user" />);

    await openDeleteDialog();

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(["user/photo.png"]));
    await waitFor(() => expect(mocks.deleteRecord).toHaveBeenCalledWith("id", "photo-1"));
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteRecord.mock.invocationCallOrder[0]
    );
    expect(mocks.success).toHaveBeenCalledWith("Foto eliminada");
  });

  it("no borra la fila si el archivo del bucket no se pudo eliminar", async () => {
    mocks.orderByCreatedAt.mockResolvedValue({ data: [photoRow()], error: null });
    mocks.remove.mockResolvedValue({ error: new Error("storage boom") });
    render(<ProgressPhotos userId="user" />);

    await openDeleteDialog();

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(["user/photo.png"]));
    expect(mocks.deleteRecord).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("No se pudo eliminar el archivo"));
  });

  it("cierra el visor con Escape y navega con las flechas", async () => {
    mocks.orderByCreatedAt.mockResolvedValue({
      data: [
        photoRow({ id: "photo-2", photo_url: "user/b.png", taken_at: "2025-03-01" }),
        photoRow({ id: "photo-1", photo_url: "user/a.png", taken_at: "2025-02-01" }),
      ],
      error: null,
    });
    render(<ProgressPhotos userId="user" />);

    fireEvent.click((await screen.findAllByRole("button", { name: /Progreso/ }))[0]);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const firstLabel = dialog.getAttribute("aria-label");

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() =>
      expect(screen.getByRole("dialog").getAttribute("aria-label")).not.toBe(firstLabel)
    );

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
