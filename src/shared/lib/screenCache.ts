/**
 * Caché de pantalla en localStorage: al volver a la app se pinta lo último bueno
 * que se vio y la red refresca por detrás, sin esqueleto ni espera.
 *
 * Se guarda por usuario y con fecha: una copia vieja se ignora sola y nunca se
 * mezclan los datos de dos cuentas en el mismo navegador. Al cerrar sesión se
 * borra todo lo de esa persona.
 */

const PREFIX = "autopilot:screen:";
/** Al cambiar el formato, las copias antiguas se descartan solas. */
const VERSION = 1;
/** Más viejo que esto ya no se pinta: mejor esqueleto que datos de hace días. */
export const SCREEN_CACHE_TTL = 3 * 24 * 60 * 60 * 1000;

type Envelope<T> = { v: number; at: number; data: T };

const keyOf = (userId: string, name: string) => `${PREFIX}${userId}:${name}`;

/** Lo último guardado de esa pantalla, o null si no hay, caducó o no se puede leer. */
export function readScreen<T>(userId: string, name: string, ttl = SCREEN_CACHE_TTL): T | null {
  try {
    const raw = localStorage.getItem(keyOf(userId, name));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T> | null;
    if (!parsed || parsed.v !== VERSION || typeof parsed.at !== "number") {
      localStorage.removeItem(keyOf(userId, name));
      return null;
    }
    if (Date.now() - parsed.at > ttl) {
      localStorage.removeItem(keyOf(userId, name));
      return null;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

/** Guarda la pantalla. Si el almacenamiento está lleno se descarta en silencio. */
export function writeScreen<T>(userId: string, name: string, data: T): void {
  try {
    const envelope: Envelope<T> = { v: VERSION, at: Date.now(), data };
    localStorage.setItem(keyOf(userId, name), JSON.stringify(envelope));
  } catch {
    /* sin espacio o sin almacenamiento: la app sigue funcionando igual */
  }
}

export function clearScreen(userId: string, name: string): void {
  try {
    localStorage.removeItem(keyOf(userId, name));
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Borra las copias de una cuenta (o todas si no se pasa usuario). Se llama al
 * cerrar sesión: nada de la persona anterior queda en un navegador compartido.
 */
export function clearScreenCache(userId?: string): void {
  try {
    const prefix = userId ? `${PREFIX}${userId}:` : PREFIX;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch {
    /* sin almacenamiento */
  }
}
