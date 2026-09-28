import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TrainerCertificates from "./TrainerCertificates";
import { TrainerPresentation } from "@/components/TrainersSection";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), insert: vi.fn(), list: vi.fn(), error: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ order: mocks.list }) }), insert: mocks.insert }),
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error, warning: vi.fn() } }));
const trainer = { id: "profile", display_name: "Entrenador de prueba", headline: "", bio: "", photo_url: "", specialty: "Fuerza", visible: true, sort_order: 0 };

beforeEach(() => {
  cleanup(); vi.clearAllMocks();
  mocks.list.mockResolvedValue({ data: [], error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.insert.mockResolvedValue({ error: null });
  vi.stubGlobal("crypto", { randomUUID: () => "certificate-id" });
});
async function fill(file = new File(["certificate"], "diploma.pdf", { type: "application/pdf" })) {
  render(<TrainerCertificates profileId="profile" />);
  await screen.findByText(/Sin certificados publicados/);
  fireEvent.change(screen.getByLabelText("Nombre de la titulación"), { target: { value: "Entrenamiento personal" } });
  fireEvent.change(screen.getByLabelText("Entidad que lo expide"), { target: { value: "Entidad de prueba" } });
  fireEvent.change(screen.getByLabelText(/Documento/), { target: { files: [file] } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Subir y publicar certificado" })); });
}

describe("Trainer certificates", () => {
  it("publishes only after a successful file upload", async () => {
    await fill();
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ trainer_profile_id: "profile", file_path: "profile/certificate-id.pdf" })));
  });
  it("does not create a certificate when storage fails", async () => {
    mocks.upload.mockResolvedValue({ error: new Error("upload failed") });
    await fill();
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("cleans up an uploaded file if saving its metadata fails", async () => {
    mocks.insert.mockResolvedValue({ error: new Error("save failed") });
    await fill();
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(["profile/certificate-id.pdf"]));
  });
  it("rejects unsupported files before uploading", async () => {
    await fill(new File(["<svg/>"], "document.svg", { type: "image/svg+xml" }));
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
  });
  it("shows a neutral presentation without certificates", () => {
    render(<TrainerPresentation trainer={trainer} certificates={[]} />);
    expect(screen.getByText("Entrenador del equipo")).toBeInTheDocument();
    expect(screen.queryByText(/verificado/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver certificado/ })).not.toBeInTheDocument();
  });
  it("shows the document and issuer without claiming verification", () => {
    render(<TrainerPresentation trainer={trainer} certificates={[{ id: "certificate", trainer_profile_id: "profile", title: "Título de prueba", issuer: "Entidad de prueba", file_path: "file.pdf", created_at: "" }]} />);
    expect(screen.getByRole("button", { name: "Ver certificado: Título de prueba" })).toBeInTheDocument();
    expect(screen.getByText(/Título de prueba · Entidad de prueba/)).toBeInTheDocument();
    expect(screen.queryByText(/verificado/i)).not.toBeInTheDocument();
  });
});
