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
 * Se usa para no mostrar en iOS ningún punto de venta de bienes digitales:
 * App Store §3.1.1 exige compra in-app para contenido digital y §3.1.3(a)
 * (reader apps) solo cubre revistas, periódicos, libros, audio, música y
 * vídeo — una app de fitness no entra en esa lista. Por eso en iOS se ocultan
 * precios, CTAs de compra y comparativas de planes, sin redirigir a la web.
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

/**
 * True cuando Sign in with Apple está realmente operativo end-to-end.
 *
 * Hoy devuelve `false` porque el provider Apple no está configurado en
 * Supabase (requiere Team ID, Services ID, Key ID y .p8 del Apple
 * Developer Program, aún no contratado). Mostrar el botón hoy abriría
 * Safari con el error `{"code":400,"error_code":"validation_failed",
 * "msg":"Unsupported provider: missing OAuth secret"}` — mala UX y
 * motivo de rechazo potencial en App Review (§2.1 completeness).
 *
 * Cuando el CEO contrate Apple Developer y QA confirme el flujo
 * funcional, cambiar a `true` (o leer un env flag).
 */
export const appleSignInEnabled = (): boolean => false;