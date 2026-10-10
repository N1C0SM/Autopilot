import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PaymentSuccess, { BookSuccess } from "./PaymentSuccess";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), profile: vi.fn(), auth: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.auth }));
vi.mock("@/components/PageHead", () => ({ default: () => null }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  functions: { invoke: mocks.invoke },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
} }));

describe("payment return", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.invoke.mockReset().mockResolvedValue({ data: {}, error: null });
    mocks.profile.mockReset();
    mocks.auth.mockReturnValue({ user: { id: "client" }, loading: false });
  });
  afterEach(() => cleanup());

  it("recognizes an active Plus plan after synchronization", async () => {
    mocks.profile.mockResolvedValue({ data: { payment_status: "paid", subscription_tier: "plus", subscription_status: "active" } });
    render(<MemoryRouter><PaymentSuccess /></MemoryRouter>);
    expect(await screen.findByText("¡Pago Exitoso!")).toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledWith("check-subscription");
  });

  it("does not let a remembered book replace an explicit plan return", async () => {
    localStorage.setItem("autopilot_pending_book", JSON.stringify({ id: "old-book", at: Date.now() }));
    mocks.profile.mockResolvedValue({ data: { payment_status: "paid", subscription_tier: "coach", subscription_status: "active" } });
    render(<MemoryRouter initialEntries={["/payment-success?client_reference_id=client"]}><PaymentSuccess /></MemoryRouter>);
    expect(await screen.findByText("¡Pago Exitoso!")).toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalledWith("verify-book-purchase", expect.anything());
  });

  it("never requests a book download with only its public reference", async () => {
    render(<MemoryRouter><BookSuccess bookRef="book-11111111-1111-4111-8111-111111111111" sessionId="" onNotBook={vi.fn()} /></MemoryRouter>);
    expect(await screen.findByText("No hemos podido confirmar tu compra")).toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(screen.queryByText("Descargar mi libro")).not.toBeInTheDocument();
  });

  it("shows an unconfirmed purchase when the server rejects the session", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error("Wrong product") });
    render(<MemoryRouter><BookSuccess bookRef="book-11111111-1111-4111-8111-111111111111" sessionId="cs_test_other" onNotBook={vi.fn()} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("No hemos podido confirmar tu compra")).toBeInTheDocument());
    expect(screen.queryByText("¡Pago Exitoso!")).not.toBeInTheDocument();
    expect(screen.queryByText("Descargar mi libro")).not.toBeInTheDocument();
  });
});
