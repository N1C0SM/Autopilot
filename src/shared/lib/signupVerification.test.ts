import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSignupEmail,
  clearVerifyContext,
  postVerificationPath,
  postVerifyDestination,
  readSignupEmail,
  readVerifyContext,
  safeNextPath,
  saveSignupEmail,
  saveVerifyContext,
  VERIFY_STORAGE_KEY,
  VERIFY_TTL_MS,
} from "@/shared/lib/signupVerification";

beforeEach(() => {
  sessionStorage.clear();
});

describe("safeNextPath", () => {
  it("mantiene las rutas internas", () => {
    expect(safeNextPath("/onboarding-choice", "/fallback")).toBe("/onboarding-choice");
    expect(safeNextPath("/scan?from=signup", "/fallback")).toBe("/scan?from=signup");
  });

  it("rechaza rutas externas o protocol-relative", () => {
    expect(safeNextPath("https://evil.example", "/fallback")).toBe("/fallback");
    expect(safeNextPath("//evil.example", "/fallback")).toBe("/fallback");
    expect(safeNextPath("%2F%2Fevil.example", "/fallback")).toBe("/fallback");
    expect(safeNextPath(null, "/fallback")).toBe("/fallback");
  });
});

describe("postVerificationPath", () => {
  it("prioriza el next explícito y lo sanea", () => {
    expect(postVerificationPath("/scan?from=signup", false)).toBe("/scan?from=signup");
    expect(postVerificationPath("https://evil.example", false)).toBe("/onboarding-choice");
  });

  it("vuelve al scan cuando el alta viene del scan", () => {
    expect(postVerificationPath(null, true)).toBe("/scan?from=signup");
  });

  it("por defecto lleva a elegir onboarding", () => {
    expect(postVerificationPath(null, false)).toBe("/onboarding-choice");
  });
});

describe("postVerifyDestination", () => {
  it("con borrador del quiz vuelve al configurador con autoguardado", () => {
    expect(postVerifyDestination("/onboarding", true)).toBe("/onboarding?guardar=1");
  });

  it("sin borrador respeta el destino previsto", () => {
    expect(postVerifyDestination("/onboarding", false)).toBe("/onboarding");
    expect(postVerifyDestination("/scan?from=signup", false)).toBe("/scan?from=signup");
  });
});

describe("contexto de verificación", () => {
  it("guarda y recupera el contexto de la pestaña", () => {
    saveVerifyContext({ email: "  ana@example.test  ", next: "/scan?from=signup", fromScan: true });
    expect(readVerifyContext()).toMatchObject({
      email: "ana@example.test",
      next: "/scan?from=signup",
      fromScan: true,
    });
  });

  it("caduca a las 24 horas y limpia la clave", () => {
    sessionStorage.setItem(
      VERIFY_STORAGE_KEY,
      JSON.stringify({ email: "ana@example.test", next: "/onboarding-choice", fromScan: false, createdAt: Date.now() - VERIFY_TTL_MS - 1 }),
    );
    expect(readVerifyContext()).toBeNull();
    expect(sessionStorage.getItem(VERIFY_STORAGE_KEY)).toBeNull();
  });

  it("descarta contextos manipulados con destinos externos", () => {
    sessionStorage.setItem(
      VERIFY_STORAGE_KEY,
      JSON.stringify({ email: "ana@example.test", next: "https://evil.example", fromScan: false, createdAt: Date.now() }),
    );
    expect(readVerifyContext()).toBeNull();
  });

  it("se puede limpiar", () => {
    saveVerifyContext({ email: "ana@example.test", next: "/onboarding-choice", fromScan: false });
    clearVerifyContext();
    expect(readVerifyContext()).toBeNull();
  });
});

describe("email pendiente del alta", () => {
  it("guarda, lee y limpia el email para corregirlo", () => {
    saveSignupEmail("  ana@example.test ");
    expect(readSignupEmail()).toBe("ana@example.test");
    clearSignupEmail();
    expect(readSignupEmail()).toBeNull();
  });
});
