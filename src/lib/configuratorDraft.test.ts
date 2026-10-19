import { beforeEach, describe, expect, it } from "vitest";
import {
  clearConfiguratorDraft,
  CONFIGURATOR_DRAFT_KEY,
  CONFIGURATOR_DRAFT_TTL_MS,
  readConfiguratorDraft,
  saveConfiguratorDraft,
} from "./configuratorDraft";

interface Draft {
  goal: string;
  days: number[];
}

beforeEach(() => {
  localStorage.clear();
});

describe("borrador del configurador", () => {
  it("guarda y recupera las respuestas", () => {
    saveConfiguratorDraft<Draft>({ goal: "recomp", days: [2, 4] });
    expect(readConfiguratorDraft<Draft>()).toMatchObject({
      data: { goal: "recomp", days: [2, 4] },
    });
  });

  it("caduca a los 7 días y limpia la clave", () => {
    localStorage.setItem(
      CONFIGURATOR_DRAFT_KEY,
      JSON.stringify({ data: { goal: "recomp", days: [2] }, createdAt: Date.now() - CONFIGURATOR_DRAFT_TTL_MS - 1 }),
    );
    expect(readConfiguratorDraft()).toBeNull();
    expect(localStorage.getItem(CONFIGURATOR_DRAFT_KEY)).toBeNull();
  });

  it("ignora borradores corruptos", () => {
    localStorage.setItem(CONFIGURATOR_DRAFT_KEY, "no-json");
    expect(readConfiguratorDraft()).toBeNull();
    localStorage.setItem(CONFIGURATOR_DRAFT_KEY, JSON.stringify({ data: null, createdAt: Date.now() }));
    expect(readConfiguratorDraft()).toBeNull();
  });

  it("se puede limpiar", () => {
    saveConfiguratorDraft({ goal: "recomp" });
    clearConfiguratorDraft();
    expect(localStorage.getItem(CONFIGURATOR_DRAFT_KEY)).toBeNull();
  });
});
