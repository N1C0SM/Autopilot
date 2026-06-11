import { Capacitor } from "@capacitor/core";

/**
 * True cuando la app corre como nativa empaquetada por Capacitor (iOS / Android).
 * En web (navegador, móvil o desktop) devuelve false.
 *
 * Override de debug: `?native=1` en la URL fuerza el modo nativo para poder
 * previsualizar pantallas app-only desde el editor web.
 */
export const isNativeApp = (): boolean => {
  try {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("native") === "1") return true;
    }
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};