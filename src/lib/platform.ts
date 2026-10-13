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

/**
 * True cuando la app corre como build nativa iOS empaquetada por Capacitor.
 *
 * Se usa como feature flag para esconder CTAs de compra y precios: la app
 * iOS v1 opera en modo "reader app" (App Store Review Guideline §3.1.3(a)).
 *
 * Overrides de debug (en orden de prioridad):
 *   `?native=1&platform=ios`  → fuerza isIOSNative=true desde la web.
 *   `?platform=web`           → fuerza isIOSNative=false aunque Capacitor
 *                               reporte iOS (útil para probar la web dentro
 *                               de la WebView de iOS en depuración).
 */
export const isIOSNative = (): boolean => {
  try {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("platform") === "web") return false;
      if (params.get("native") === "1" && params.get("platform") === "ios") {
        return true;
      }
    }
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
};