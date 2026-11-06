import { describe, expect, it } from "vitest";
import { signupErrorMessage } from "./authFormHelpers";

describe("signupErrorMessage", () => {
  it("explica en español los errores de Supabase Auth del alta", () => {
    expect(signupErrorMessage({ code: "weak_password", message: "Password is known to be weak and easy to guess, please choose a different one." }))
      .toMatch(/demasiado común/);
    expect(signupErrorMessage({ code: "weak_password", message: "Password should be at least 6 characters." })).toMatch(/al menos 6 caracteres/);
    expect(signupErrorMessage({ message: "Email rate limit exceeded" })).toMatch(/Espera un minuto/);
    expect(signupErrorMessage({ code: "email_address_invalid", message: "Email address \"a@b\" is invalid" })).toMatch(/no parece válido/);
    expect(signupErrorMessage({ message: "Failed to fetch" })).toMatch(/conexión/);
  });

  it("nunca enseña el texto en inglés del servidor", () => {
    expect(signupErrorMessage({ message: "Database error saving new user" })).toBe("No hemos podido crear tu cuenta. Revisa el correo y la contraseña.");
    expect(signupErrorMessage(null)).toBe("No hemos podido crear tu cuenta. Revisa el correo y la contraseña.");
  });
});
