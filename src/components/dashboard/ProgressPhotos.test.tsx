import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProgressPhotos from "./ProgressPhotos";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  insert: vi.fn(),
  deleteRecord: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: mocks.list }) }),
      insert: mocks.insert,
      delete: () => ({ eq: mocks.deleteRecord }),
    }),
    storage: {
      from: () => ({
        upload: mocks.upload,
        remove: mocks.remove,
        getPublicUrl: mocks.getPublicUrl,
      }),
    },
  },
}));
vi.mock("@/lib/storageSign", () => ({ signedUrlsFor: vi.fn().mockResolvedValue(new Map()) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.list.mockResolvedValue({ data: [], error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.deleteRecord.mockResolvedValue({ error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.test/progress-photos/user/photo.png" } });
  vi.stubGlobal("crypto", { randomUUID: () => "photo-id" });
});

describe("progress photos", () => {
  it("does not report an upload as successful when its database record fails", async () => {
    mocks.insert.mockResolvedValue({ error: new Error("metadata failed") });
    const { container } = render(<ProgressPhotos userId="user" />);
    await screen.findByText("Empieza a documentar tu progreso");

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    await act(async () => {
      fireEvent.change(input!, {
        target: { files: [new File(["photo"], "progress.png", { type: "image/png" })] },
      });
    });

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(["user/photo-id.png"]));
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("No se pudo subir la foto"));
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("shows a retry action when the photo list fails to load", async () => {
    mocks.list
      .mockResolvedValueOnce({ data: null, error: new Error("query failed") })
      .mockResolvedValueOnce({ data: [], error: null });
    render(<ProgressPhotos userId="user" />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(screen.getByText("Empieza a documentar tu progreso")).toBeVisible());
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it("requires confirmation before deleting a progress photo", async () => {
    mocks.list.mockResolvedValue({
      data: [{
        id: "photo-id",
        photo_url: "https://example.test/storage/v1/object/public/progress-photos/user/photo.png",
        note: "",
        taken_at: "2025-01-01",
        created_at: "2025-01-01",
      }],
      error: null,
    });
    render(<ProgressPhotos userId="user" />);

    fireEvent.click(await screen.findByRole("button", { name: /Progreso/ }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar foto" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(mocks.deleteRecord).not.toHaveBeenCalled();
  });
});
