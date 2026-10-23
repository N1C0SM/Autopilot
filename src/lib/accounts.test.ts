import { beforeEach, describe, expect, it, vi } from "vitest";

const { setSession, getSession, signOut } = vi.hoisted(() => ({ setSession: vi.fn(), getSession: vi.fn(), signOut: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { setSession, getSession, signOut }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) } }));

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

  it("cambia de cuenta con la sesión guardada y nunca pierde cuentas", async () => {
    rememberSession(session("u1", "a@x.com"));
    rememberSession(session("u2", "b@x.com", "r2"));
    getSession.mockResolvedValue({ data: { session: null } });
    setSession.mockResolvedValueOnce({ data: { session: session("u2", "b@x.com", "r9") }, error: null });
    expect(await switchToAccount("u2")).toBe("ok");
    expect(setSession).toHaveBeenCalledWith({ access_token: "a-r2", refresh_token: "r2" });
    expect(listAccounts().find((a) => a.id === "u2")?.refreshToken).toBe("r9");

    // Fallo de red: la cuenta sigue intacta.
    setSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await switchToAccount("u1")).toBe("offline");
    expect(listAccounts().find((a) => a.id === "u1")?.expired).toBeFalsy();

    // Sesión rechazada por el servidor: se marca para volver a entrar, pero no se borra.
    setSession.mockResolvedValueOnce({ data: { session: null }, error: Object.assign(new Error("Invalid Refresh Token"), { status: 400 }) });
    expect(await switchToAccount("u1")).toBe("expired");
    expect(listAccounts().map((a) => [a.id, !!a.expired])).toEqual([["u1", true], ["u2", false]]);

    // Al volver a entrar, deja de estar caducada.
    rememberSession(session("u1", "a@x.com", "r5"));
    expect(listAccounts().find((a) => a.id === "u1")?.expired).toBe(false);
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
