import { describe, expect, it } from "vitest";
import { storeLinksComplete } from "./storeLinks";

const all = { ios: "https://apps.apple.com/app/id1", android: "https://play.google.com/store/apps/details?id=x", mac: "https://apps.apple.com/app/id2" };

describe("storeLinksComplete", () => {
  it("muestra la sección con los tres enlaces", () => expect(storeLinksComplete(all)).toBe(true));
  it("la oculta si falta Mac", () => expect(storeLinksComplete({ ...all, mac: "" })).toBe(false));
  it("la oculta si falta Google Play", () => expect(storeLinksComplete({ ...all, android: " " })).toBe(false));
  it("la oculta si falta iPhone", () => expect(storeLinksComplete({ ...all, ios: "" })).toBe(false));
});
