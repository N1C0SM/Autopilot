import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingScanContext,
  markPendingScanRestored,
  PENDING_SCAN_KEY,
  PENDING_SCAN_TTL_MS,
  readPendingScanContext,
} from "./pendingScan";

beforeEach(() => {
  sessionStorage.clear();
});

const writeContext = (overrides: Record<string, unknown> = {}) => {
  sessionStorage.setItem(
    PENDING_SCAN_KEY,
    JSON.stringify({
      result: { physique: 6.4, summary: "Análisis" },
      currentImg: "data:image/jpeg;base64,front",
      objectiveImg: "data:image/jpeg;base64,goal",
      leadName: "Ana",
      leadEmail: "ana@example.test",
      createdAt: Date.now(),
      ...overrides,
    }),
  );
};

describe("contexto del scan pendiente", () => {
  it("devuelve el resultado y las fotos mientras no caduca", () => {
    writeContext();
    expect(readPendingScanContext()).toMatchObject({
      result: { physique: 6.4, summary: "Análisis" },
      currentImg: "data:image/jpeg;base64,front",
      objectiveImg: "data:image/jpeg;base64,goal",
      leadEmail: "ana@example.test",
    });
  });

  it("caduca a las 24 horas y limpia la clave", () => {
    writeContext({ createdAt: Date.now() - PENDING_SCAN_TTL_MS - 1 });
    expect(readPendingScanContext()).toBeNull();
    expect(sessionStorage.getItem(PENDING_SCAN_KEY)).toBeNull();
  });

  it("ignora contextos sin resultado o corruptos", () => {
    writeContext({ result: null });
    expect(readPendingScanContext()).toBeNull();
    sessionStorage.setItem(PENDING_SCAN_KEY, "no-json");
    expect(readPendingScanContext()).toBeNull();
  });

  it("marca el contexto como restaurado sin perder el resultado", () => {
    writeContext();
    markPendingScanRestored();
    expect(readPendingScanContext()).toMatchObject({ restored: true, leadEmail: "ana@example.test" });
  });

  it("se puede limpiar", () => {
    writeContext();
    clearPendingScanContext();
    expect(sessionStorage.getItem(PENDING_SCAN_KEY)).toBeNull();
  });
});
