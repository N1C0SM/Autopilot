// Wrappers ligeros sobre Capacitor. En web son no-ops para que el código
// funcione exactamente igual desde el navegador.
import { Capacitor } from "@capacitor/core";
import { isIOSNative, isNativeApp } from "@/lib/platform";

export const isNative = () => Capacitor.isNativePlatform();

/**
 * Marca <html> con la plataforma para que el CSS pueda comportarse como app
 * (`html.native`, `html.ios`): sin selección de texto en el chrome, sin callout
 * al mantener pulsado, sin zoom por doble toque ni pellizco. Síncrono y barato:
 * se llama antes del primer render para que no haya salto.
 */
export function initPlatformClasses() {
  if (typeof document === "undefined" || !isNativeApp()) return;
  const root = document.documentElement;
  root.classList.add("native");
  if (isIOSNative()) {
    root.classList.add("ios");
  } else {
    root.classList.add("android");
  }
  // Una app no se amplía con pellizco; el tamaño de texto lo decide el sistema.
  const viewport = document.querySelector('meta[name="viewport"]');
  viewport?.setAttribute(
    "content",
    "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
  );
}

let splashHidden = false;

/** Oculta el Splash Screen nativo con una transición suave cuando la interfaz está lista. */
export async function hideSplashScreen(fadeOutDuration = 300) {
  if (!isNative() || splashHidden) return;
  splashHidden = true;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration });
  } catch { /* This native capability may be unavailable on the current platform. */ }
}

export async function initNative() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch { /* This native capability may be unavailable on the current platform. */ }

  // Salvaguarda: si por red o auth la app tardase, se oculta suavemente tras 2.5 s
  setTimeout(() => {
    void hideSplashScreen(300);
  }, 2500);
  // Con el teclado abierto ocultamos la barra inferior para que no tape
  // el campo de texto (chat, formularios, onboarding).
  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    Keyboard.addListener("keyboardWillShow", () => {
      document.body.classList.add("keyboard-open");
    });
    Keyboard.addListener("keyboardWillHide", () => {
      document.body.classList.remove("keyboard-open");
    });
  } catch { /* This native capability may be unavailable on the current platform. */ }
}

const webVibrate = (pattern: number | number[]) => {
  try { navigator.vibrate?.(pattern); } catch { /* sin soporte */ }
};

/** Toque ligero: pulsar un botón, una fila o una pestaña. */
export async function hapticTap() {
  if (!isNative()) {
    // PWA / web móvil: vibración corta donde el navegador lo permita.
    webVibrate(12);
    return;
  }
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* This native capability may be unavailable on the current platform. */ }
}

/** Impacto con peso: confirmar una acción física (completar una serie, soltar un elemento). */
export async function hapticImpact(weight: "light" | "medium" | "heavy" = "medium") {
  if (!isNative()) {
    webVibrate(weight === "heavy" ? 24 : weight === "medium" ? 16 : 12);
    return;
  }
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = weight === "heavy" ? ImpactStyle.Heavy : weight === "medium" ? ImpactStyle.Medium : ImpactStyle.Light;
    await Haptics.impact({ style });
  } catch { /* This native capability may be unavailable on the current platform. */ }
}

/** Cambio de selección: control segmentado, selector, interruptor, paso de un stepper. */
export async function hapticSelection() {
  if (!isNative()) {
    webVibrate(8);
    return;
  }
  try {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch { /* This native capability may be unavailable on the current platform. */ }
}

/** Resultado de una tarea: guardado correcto, aviso antes de algo destructivo, error. */
export async function hapticNotify(result: "success" | "warning" | "error") {
  if (!isNative()) {
    webVibrate(result === "success" ? [12, 60, 12] : result === "warning" ? [16, 80, 16] : [24, 60, 24, 60, 24]);
    return;
  }
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    const type =
      result === "success" ? NotificationType.Success : result === "warning" ? NotificationType.Warning : NotificationType.Error;
    await Haptics.notification({ type });
  } catch { /* This native capability may be unavailable on the current platform. */ }
}

// Maneja el botón "atrás" físico de Android.
export async function registerBackButton(handler: () => boolean) {
  if (!isNative()) return () => {};
  try {
    const { App } = await import("@capacitor/app");
    const sub = await App.addListener("backButton", () => {
      const consumed = handler();
      if (!consumed) App.exitApp();
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
