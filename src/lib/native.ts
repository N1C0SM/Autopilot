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

export interface NativeShareOptions {
  title?: string;
  text?: string;
  filename?: string;
  blob?: Blob;
  dataUrl?: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = (reader.result as string) || "";
      const base64 = res.includes(",") ? res.split(",")[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Comparte una imagen o archivo abriendo el menú nativo de iOS (UIActivityViewController)
 * o Android (Intent chooser). Soporta WhatsApp, Instagram Stories, Mensajes, AirDrop, etc.
 * En la web usa Web Share API si está disponible, o realiza fallback a descarga directa.
 */
export async function shareFileOrImage(
  options: NativeShareOptions,
): Promise<{ shared: boolean; downloaded?: boolean }> {
  const filename = options.filename || `autopilot-${Date.now()}.png`;

  if (isNative()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");

      let base64 = "";
      if (options.dataUrl) {
        base64 = options.dataUrl.includes(",")
          ? options.dataUrl.split(",")[1]
          : options.dataUrl;
      } else if (options.blob) {
        base64 = await blobToBase64(options.blob);
      }

      if (!base64) {
        throw new Error("No image data provided to share");
      }

      console.log("[SHARE] Writing file to cache:", filename);
      
      // Escribimos en CacheDirectory para que iOS/Android cree una URL file:// limpia
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });

      console.log("[SHARE] File saved at:", saved.uri);

      // En iOS y Android, Share.share abre el menú nativo de compartir
      const shareResult = await Share.share({
        title: options.title || "Autopilot",
        text: options.text,
        files: [saved.uri],
        dialogTitle: options.title || "Compartir",
      });

      console.log("[SHARE] Share result:", shareResult);

      // Limpiamos el archivo temporal después de compartir
      try {
        await Filesystem.deleteFile({
          path: filename,
          directory: Directory.Cache,
        });
      } catch {
        // No es crítico si falla la limpieza
      }

      return { shared: true };
    } catch (err: unknown) {
      const msg = (err as Error)?.message?.toLowerCase() || "";
      const name = (err as Error)?.name || "";
      console.error("[SHARE] Native share error:", err);
      
      // Si el usuario simplemente cerró la hoja de compartir nativa, no consideramos error
      if (name === "AbortError" || msg.includes("cancel") || msg.includes("dismiss")) {
        return { shared: false };
      }
      
      // Re-lanzamos el error para que el componente lo maneje
      throw new Error(`Error al compartir: ${msg || "Error desconocido"}`);
    }
  }

  // Web fallback con Web Share API (si soporta files)
  if (typeof navigator !== "undefined" && typeof window !== "undefined") {
    let blob = options.blob;
    if (!blob && options.dataUrl) {
      try {
        const res = await fetch(options.dataUrl);
        blob = await res.blob();
      } catch { /* ignora */ }
    }

    if (blob) {
      const file = new File([blob], filename, { type: blob.type || "image/png" });
      
      // Primero intentamos Web Share API nativa del navegador
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: options.title || "Autopilot",
            text: options.text,
          });
          return { shared: true };
        } catch (shareErr: unknown) {
          const name = (shareErr as Error)?.name || "";
          if (name === "AbortError") {
            return { shared: false };
          }
          // Si falla el share, caemos al fallback de descarga
          console.warn("[SHARE] Web Share API falló, usando descarga:", shareErr);
        }
      }
    }

    // Fallback de descarga en navegador tradicional
    const downloadUrl = options.dataUrl || (blob ? URL.createObjectURL(blob) : null);
    if (downloadUrl) {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (!options.dataUrl && blob) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
      }
      return { shared: false, downloaded: true };
    }
  }

  throw new Error("No se pudo compartir ni descargar la imagen");
}

