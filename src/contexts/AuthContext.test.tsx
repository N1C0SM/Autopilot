import { act, cleanup, render, screen } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authListener: null as ((event: string, session: Session | null) => void) | null,
  unsubscribe: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: typeof mocks.authListener) => {
        mocks.authListener = listener;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
      getSession: mocks.getSession,
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

const AuthStatus = () => {
  const { user, loading } = useAuth();
  return <div>{loading ? "Cargando" : user?.id ?? "Sin sesión"}</div>;
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authListener = null;
});

describe("AuthProvider", () => {
  it("does not replace an auth event with a stale empty session restore", async () => {
    let resolveRestore!: (value: { data: { session: Session | null }; error: null }) => void;
    mocks.getSession.mockReturnValue(new Promise((resolve) => { resolveRestore = resolve; }));
    render(<AuthProvider><AuthStatus /></AuthProvider>);

    const session = { user: { id: "saved-user" } } as Session;
    act(() => mocks.authListener?.("SIGNED_IN", session));
    expect(screen.getByText("saved-user")).toBeInTheDocument();

    await act(async () => {
      resolveRestore({ data: { session: null }, error: null });
    });
    expect(screen.getByText("saved-user")).toBeInTheDocument();
  });

  it("restores the session found in persistent auth storage", async () => {
    const user = { id: "restored-user" } as User;
    const session = { user } as Session;
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    render(<AuthProvider><AuthStatus /></AuthProvider>);

    expect(await screen.findByText("restored-user")).toBeInTheDocument();
  });
});
