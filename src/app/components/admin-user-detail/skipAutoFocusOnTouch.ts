/**
 * `onOpenAutoFocus` para hojas y diálogos de la ficha del cliente: en pantallas táctiles
 * no se enfoca ningún elemento al abrir; con puntero se deja el foco por defecto.
 */
export const skipAutoFocusOnTouch = (event: Event) => {
  if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) {
    event.preventDefault();
  }
};
