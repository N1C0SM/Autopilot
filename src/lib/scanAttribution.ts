/**
 * Atribución de las tarjetas de escaneo anónimas (RGPD art. 17).
 *
 * El escaneo funciona sin registro y su tarjeta se sube a
 * progress-photos/scan-cards/anonymous/<uuid>.png. Para poder borrarla cuando el
 * usuario elimine su cuenta, el navegador envía en la subida un id anónimo de
 * sesión que la edge function guarda en scan_card_uploads. Ese mismo id viaja en
 * user_metadata.anon_scan_id al registrarse, de modo que delete-account puede
 * localizar y borrar las rutas exactas.
 *
 * El id vive en sessionStorage, igual que el contexto de escaneo
 * ("autopilot_scan"): sobrevive a la navegación y a la vuelta de la verificación
 * por email en la misma pestaña, pero no se comparte entre pestañas ni usuarios
 * distintos del mismo navegador. Si la verificación se abre en otra pestaña, la
 * tarjeta no se puede atribuir y NO se borrará al eliminar la cuenta.
 */
const ANON_SCAN_ID_KEY = "autopilot_anon_scan_id";

/** UUID v4 sin depender de crypto.randomUUID (WebViews antiguos). */
function randomUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Id anónimo actual, o null si esta pestaña no ha hecho ningún escaneo. */
export function readAnonScanId(): string | null {
  try {
    return sessionStorage.getItem(ANON_SCAN_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Id anónimo de la sesión de escaneo actual: se conserva entre subidas de la
 * misma sesión (tarjeta + reenvío del email) y se renueva al empezar otro
 * escaneo (ver clearAnonScanId en Scan.reset).
 */
export function getOrCreateAnonScanId(): string {
  try {
    const existing = sessionStorage.getItem(ANON_SCAN_ID_KEY);
    if (existing) return existing;
    const id = randomUuid();
    sessionStorage.setItem(ANON_SCAN_ID_KEY, id);
    return id;
  } catch {
    return randomUuid();
  }
}

/**
 * Olvida el id anónimo. Se llama al cerrar sesión y al empezar un escaneo nuevo:
 * evita que un tercero en el mismo navegador herede la atribución de fotos que
 * no son suyas.
 */
export function clearAnonScanId(): void {
  try {
    sessionStorage.removeItem(ANON_SCAN_ID_KEY);
  } catch {
    // sessionStorage puede no estar disponible (modo restringido): nada que hacer.
  }
}
