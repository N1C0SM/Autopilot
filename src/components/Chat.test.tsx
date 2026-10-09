import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Chat from "./Chat";
const mocks = vi.hoisted(() => ({ load: vi.fn(), send: vi.fn(), sent: vi.fn(), error: vi.fn(), realtime: null as ((payload: { new: unknown }) => void) | null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "trainer" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => { const query = { select: () => query, eq: () => query, order: mocks.load, insert: (payload: unknown) => { mocks.sent(payload); return { select: () => ({ single: mocks.send }) }; } }; return query; },
  channel: () => { const channel = { on: (_event: unknown, _filter: unknown, callback: typeof mocks.realtime) => { mocks.realtime = callback; return channel; }, subscribe: () => channel }; return channel; }, removeChannel: vi.fn(),
} }));
vi.mock("@/hooks/useVideoCall", () => ({ useVideoCall: () => ({ state: "idle", clearError: vi.fn() }) }));
vi.mock("@/components/call/CallOverlay", () => ({ default: () => null }));
vi.mock("@/components/AIDisclaimer", () => ({ default: () => null }));
vi.mock("@/lib/storageSign", () => ({ signedUrlsFor: () => Promise.resolve(new Map()) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, info: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); mocks.load.mockResolvedValue({ data: [], error: null }); mocks.send.mockResolvedValue({ data: { id: "sent-1", sender_id: "trainer", content: "Mensaje de prueba", created_at: "2026-10-09T12:00:00Z" }, error: null }); }); afterEach(cleanup);
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
});
