import type { KeyboardEvent } from "react";
import { cn } from "@/shared/lib/utils";

/** Clases para un `Input` dentro de `AuthFieldRow`: sin fondo propio, alineado con el texto. */
export const authFieldInputClass = (withTrailing = false) =>
  cn(
    "min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 md:focus-visible:ring-0",
    "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_hsl(var(--background))] [&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--foreground))]",
    withTrailing ? "pr-0" : "pr-5",
  );

/** Acción secundaria en texto dorado, como "Ya tengo cuenta" en la bienvenida (`Button variant="plain" size="sm"`). */
export const authSecondaryActionClass = "h-11 w-full font-medium";

/** Oculta un elemento del pie mientras el teclado está abierto (clase que pone `@/lib/native`). */
export const hideWithKeyboardClass = "[.keyboard-open_&]:hidden";

/** El retorno en un campo intermedio pasa al siguiente en vez de enviar el formulario. */
export const focusNextOnEnter = (nextId: string) => (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
  e.preventDefault();
  document.getElementById(nextId)?.focus();
};

/**
 * Los errores de Supabase Auth en el alta llegan en inglés («Password is known to be
 * weak…», «Email rate limit exceeded»…); al usuario se le explican en español.
 * Mismo criterio que el registro del iPhone (`CreateAccountView.signupMessage`).
 */
export const signupErrorMessage = (error: { message?: string; code?: string } | null | undefined): string => {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (text.includes("pwned") || text.includes("known to be weak") || text.includes("easy to guess")) {
    return "Esa contraseña es demasiado común. Elige otra que no uses en otros sitios.";
  }
  if (text.includes("weak_password") || text.includes("password should") || text.includes("too weak") || text.includes("at least")) {
    return "La contraseña es demasiado débil. Usa al menos 6 caracteres mezclando letras y números.";
  }
  if (text.includes("rate limit") || text.includes("too many") || text.includes("429")) {
    return "Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.";
  }
  if ((text.includes("invalid") && text.includes("email")) || text.includes("validate email") || text.includes("email_address_invalid")) {
    return "Ese correo no parece válido. Revisa que tenga el formato nombre@dominio.com.";
  }
  if (text.includes("signup") && (text.includes("disabled") || text.includes("not allowed"))) {
    return "Ahora mismo no se pueden crear cuentas. Inténtalo en unos minutos.";
  }
  if (text.includes("fetch") || text.includes("network")) {
    return "No hemos podido crear tu cuenta. Comprueba tu conexión y vuelve a intentarlo.";
  }
  return "No hemos podido crear tu cuenta. Revisa el correo y la contraseña.";
};
