import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardRedirect from "./DashboardRedirect";

const { rpc, auth } = vi.hoisted(() => ({
  rpc: vi.fn(),
  auth: { user: { id: "admin-user" } as { id: string } | null, loading: false },
}));
vi.mock("@/shared/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/shared/integrations/supabase/client", () => ({ supabase: { rpc } }));

function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
function Entry({ path = "/dashboard" }: { path?: string }) {
  return <MemoryRouter initialEntries={[path]}>
    <Location />
    <Routes>
      <Route path="/dashboard" element={<DashboardRedirect />} />
      <Route path="/" element={<DashboardRedirect />} />
      <Route path="/admin" element={<div />} />
      <Route path="/login" element={<div />} />
      <Route path="/dashboard/user/:userId" element={<div />} />
    </Routes>
  </MemoryRouter>;
}
beforeEach(() => {
  auth.user = { id: "admin-user" };
  auth.loading = false;
  rpc.mockReset().mockResolvedValue({ data: true, error: null });
});
afterEach(cleanup);

describe("generic dashboard entry", () => {
  it("sends an authenticated administrator arriving from OAuth to /admin", async () => {
    render(<Entry />);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/admin$/));
    expect(rpc).toHaveBeenCalledWith("has_role", { _user_id: "admin-user", _role: "admin" });
  });
  it("sends an administrator reopening the app root to /admin", async () => {
    render(<Entry path="/" />);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/admin$/));
  });
  it("sends a non-admin to their own client dashboard", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    render(<Entry />);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/dashboard\/user\/admin-user$/));
  });
  it("leaves explicit client-view navigation available to administrators", () => {
    render(<Entry path="/dashboard/user/admin-user" />);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/dashboard\/user\/admin-user$/);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("waits for session restoration before checking the role", () => {
    auth.loading = true;
    render(<Entry />);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/dashboard$/);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("sends signed-out visitors to login without requesting a role", () => {
    auth.user = null;
    render(<Entry />);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/login$/);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not mistake a failed role check for a non-admin and supports retry", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "unavailable" } });
    render(<Entry />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/admin$/));
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});