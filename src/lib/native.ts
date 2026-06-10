// Wrappers ligeros sobre Capacitor. En web son no-ops para que el código
// funcione exactamente igual desde el navegador.
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();

export async function initNative() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#090909" });
  } catch {}
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {}
}

export async function hapticTap() {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
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