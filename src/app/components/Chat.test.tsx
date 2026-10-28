import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Chat from "@/app/components/Chat";
const mocks = vi.hoisted(() => ({ load: vi.fn(), send: vi.fn(), sent: vi.fn(), error: vi.fn(), upload: vi.fn(), realtime: null as ((payload: { new: unknown }) => void) | null }));
vi.mock("@/shared/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "trainer" } }) }));
vi.mock("@/shared/integrations/supabase/client", () => ({ supabase: {
  from: () => { const query = { select: () => query, eq: () => query, order: mocks.load, insert: (payload: unknown) => { mocks.sent(payload); return { select: () => ({ single: mocks.send }) }; } }; return query; },
  auth: { getUser: () => Promise.resolve({ data: { user: { id: "trainer" } } }) },
  storage: { from: () => ({ upload: mocks.upload, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }) }) },
  channel: () => { const channel = { on: (_event: unknown, _filter: unknown, callback: typeof mocks.realtime) => { mocks.realtime = callback; return channel; }, subscribe: () => channel }; return channel; }, removeChannel: vi.fn(),
} }));
vi.mock("@/shared/hooks/useVideoCall", () => ({ useVideoCall: () => ({ state: "idle", clearError: vi.fn() }) }));
vi.mock("@/app/components/call/CallOverlay", () => ({ default: () => null }));
vi.mock("@/shared/components/AIDisclaimer", () => ({ default: () => null }));
vi.mock("@/shared/lib/storageSign", () => ({ signedUrlsFor: () => Promise.resolve(new Map()) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, info: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); mocks.load.mockResolvedValue({ data: [], error: null }); mocks.upload.mockResolvedValue({ error: null }); Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }); mocks.send.mockResolvedValue({ data: { id: "sent-1", sender_id: "trainer", content: "Mensaje de prueba", created_at: "2026-10-09T12:00:00Z" }, error: null }); }); afterEach(cleanup);
describe("trainer chat reliability", () => {
  it("explains the internal admin audience instead of showing client instructions", async () => {
    render(<Chat conversationUserId="trainer" audience="team" layout="fill" />);
    expect(await screen.findByText(/Canal privado con administración/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Chat con administración" })).toBeInTheDocument();
  });
  it("shows a failed load with retry and recovers the conversation", async () => {
    mocks.load.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    render(<Chat conversationUserId="client" isAdmin audience="client" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar esta conversación.");
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(/Empieza la conversación con tu cliente/)).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toBeEnabled();
  });
  it("keeps the draft and shows an error when insertion fails", async () => {
    mocks.send.mockResolvedValueOnce({ data: null, error: { message: "insert denied" } });
    render(<Chat conversationUserId="client" isAdmin />);
    await screen.findByText(/Empieza la conversación/);
    fireEvent.change(screen.getByRole("textbox", { name: "Mensaje" }), { target: { value: "Mensaje de prueba" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Tu borrador sigue aquí")));
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue("Mensaje de prueba");
  });
  it("renders a successful send immediately and deduplicates its realtime echo", async () => {
    render(<Chat conversationUserId="client" isAdmin />); await screen.findByText(/Empieza la conversación/);
    fireEvent.change(screen.getByRole("textbox", { name: "Mensaje" }), { target: { value: "Mensaje de prueba" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    expect(await screen.findByText("Mensaje de prueba")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue("");
    act(() => mocks.realtime?.({ new: { id: "sent-1", sender_id: "trainer", content: "Mensaje de prueba", created_at: "2026-10-09T12:00:00Z" } }));
    expect(screen.getAllByText("Mensaje de prueba")).toHaveLength(1);
    expect(mocks.sent).toHaveBeenCalledWith(expect.objectContaining({ conversation_user_id: "client", sender_id: "trainer" }));
  });
  it.each([
    ["image", "foto.jpg", "image/jpeg", "📷 Foto"],
    ["video", "clip.mp4", "video/mp4", "📹 Video"],
  ])("keeps the stored placeholder text when a %s is sent without a message", async (mediaType, name, mime, content) => {
    const { container } = render(<Chat conversationUserId="client" isAdmin />);
    await screen.findByText(/Empieza la conversación/);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(["x"], name, { type: mime })] } });
    fireEvent.click(await screen.findByRole("button", { name: "Enviar mensaje" }));
    await waitFor(() => expect(mocks.sent).toHaveBeenCalledWith(expect.objectContaining({ content, media_type: mediaType, media_url: expect.stringContaining("https://cdn.test/trainer/chat/client/") })));
  });
});
