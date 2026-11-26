import { describe, expect, it } from "vitest";
import { noticeAgo } from "./noticeTime";

describe("noticeAgo", () => {
  const now = new Date(2026, 10, 27, 12, 0, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("dice «Ahora» en el primer minuto, nunca «0m»", () => {
    expect(noticeAgo(ago(20_000), now)).toBe("Ahora");
    expect(noticeAgo(new Date(now.getTime() + 60_000).toISOString(), now)).toBe("Ahora");
  });

  it("minutos, horas y días con su unidad separada", () => {
    expect(noticeAgo(ago(5 * 60_000), now)).toBe("5 min");
    expect(noticeAgo(ago(3 * 3_600_000), now)).toBe("3 h");
    expect(noticeAgo(ago(2 * 86_400_000), now)).toBe("2 d");
  });

  it("pasada una semana, la fecha corta (y el año si no es este)", () => {
    expect(noticeAgo(new Date(2026, 10, 12, 9).toISOString(), now)).toBe("12 nov");
    expect(noticeAgo(new Date(2025, 8, 3, 9).toISOString(), now)).toBe("3 sept 2025");
  });

  it("sin fecha válida no pinta nada", () => {
    expect(noticeAgo("no es una fecha", now)).toBe("");
  });
});
