import { describe, expect, it } from "vitest";
import { canUnlink } from "./linkedAccounts";

describe("canUnlink", () => {
  it("bloquea desconectar el único acceso", () => {
    expect(canUnlink([{ provider: "google" }])).toBe(false);
  });
  it("permite desconectar Google si queda el correo", () => {
    expect(canUnlink([{ provider: "google" }, { provider: "email" }])).toBe(true);
  });
});
