/**
 * Tiempo hasta la primera foto de una pantalla (Hoy, el entreno). Solo mide en desarrollo o con el
 * modo de medida (`localStorage["ap:perf"] = "1"`): en producción no hace nada y no deja ruido.
 * Se lee en el panel Performance del navegador (`first-image hoy`) o con
 * `performance.getEntriesByType("measure")`. Es `MediaTiming` en la app (os_signpost «first-image»).
 */
const open = new Set<string>();

const enabled = (): boolean => {
  if (typeof performance === "undefined" || typeof performance.mark !== "function") return false;
  if (import.meta.env.DEV) return true;
  try { return localStorage.getItem("ap:perf") === "1"; } catch { return false; }
};

/** Empieza a contar al abrir la pantalla (una vez por apertura). */
export function beginFirstImage(screen: string): void {
  if (open.has(screen) || !enabled()) return;
  open.add(screen);
  performance.mark(`ap:${screen}:open`);
}

/** Una foto ya está en pantalla: cierra las pantallas que esperaban su primera foto. */
export function noteImageShown(): void {
  if (open.size === 0) return;
  for (const screen of open) {
    try {
      performance.mark(`ap:${screen}:first-image`);
      performance.measure(`first-image ${screen}`, `ap:${screen}:open`, `ap:${screen}:first-image`);
    } catch { /* sin marcas (pestaña recargada): no se mide */ }
  }
  open.clear();
}
