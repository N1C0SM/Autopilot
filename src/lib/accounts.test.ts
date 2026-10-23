import { beforeEach, describe, expect, it, vi } from "vitest";

const { setSession, getSession, signOut } = vi.hoisted(() => ({ setSession: vi.fn(), getSession: vi.fn(), signOut: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { setSession, getSession, signOut } } }));

import { forgetAccount, listAccounts, prepareAnotherAccount, rememberSession, switchToAccount } from "./accounts";

const session = (id: string, email: string, token = "r1") => ({
  access_token: `a-${token}`, refresh_token: token,
  user: { id, email, user_metadata: { full_name: `Nombre ${id}` } },
}) as never;

describe("cuentas en el dispositivo", () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

  it("guarda cada cuenta una vez y actualiza sus tokens al rotar", () => {
    rememberSession(session("u1", "a@x.com", "r1"));
    rememberSession(session("u2", "b@x.com", "r2"));
    rememberSession(session("u1", "a@x.com", "r3"));
    expect(listAccounts().map((a) => [a.id, a.refreshToken, a.name])).toEqual([["u1", "r3", "Nombre u1"], ["u2", "r2", "Nombre u2"]]);
  });

  it("cambia de cuenta con la sesión guardada y olvida la que ya no vale", async () => {
    rememberSession(session("u1", "a@x.com"));
    rememberSession(session("u2", "b@x.com", "r2"));
    getSession.mockResolvedValue({ data: { session: null } });
    setSession.mockResolvedValueOnce({ data: { session: session("u2", "b@x.com", "r9") }, error: null });
    expect(await switchToAccount("u2")).toBe(true);
    expect(setSession).toHaveBeenCalledWith({ access_token: "a-r2", refresh_token: "r2" });
    expect(listAccounts().find((a) => a.id === "u2")?.refreshToken).toBe("r9");

    setSession.mockResolvedValueOnce({ data: { session: null }, error: new Error("caducada") });
    expect(await switchToAccount("u1")).toBe(false);
    expect(listAccounts().map((a) => a.id)).toEqual(["u2"]);
  });

  it("añadir otra cuenta guarda la actual y sale solo en este dispositivo", async () => {
    getSession.mockResolvedValue({ data: { session: session("u1", "a@x.com") } });
    await prepareAnotherAccount();
    expect(listAccounts().map((a) => a.id)).toEqual(["u1"]);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    forgetAccount("u1");
    expect(listAccounts()).toEqual([]);
  });
});
