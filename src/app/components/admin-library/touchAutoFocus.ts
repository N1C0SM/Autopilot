/**
 * `onOpenAutoFocus` para hojas y menús: en pantallas táctiles no se enfoca ningún
 * campo al abrir (ni teclado, ni resalte); con puntero se deja el foco por defecto.
 */
export const skipAutoFocusOnTouch = (event: Event) => {
  if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) {
    event.preventDefault();
  }
};
