import type { KeyboardEvent } from "react";
import { cn } from "@/shared/lib/utils";

/** Clases para un `Input` dentro de `AuthFieldRow`: sin fondo propio, alineado con el texto. */
export const authFieldInputClass = (withTrailing = false) =>
  cn(
    "min-w-0 flex-1 rounded-none bg-transparent px-0 md:focus-visible:ring-0",
    "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_hsl(var(--card))] [&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--foreground))]",
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
