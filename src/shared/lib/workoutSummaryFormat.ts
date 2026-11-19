import type { WorkoutReviewItem } from "@/shared/lib/workoutReview";

/**
 * Formato del resumen del entreno y de su imagen para compartir. Puro: mismas reglas que
 * `WorkoutSummaryView` y `WorkoutShareCard` en la app (WorkoutView.swift).
 */

/** Enteros en español con punto de miles siempre («2.366», no «2366»), como `NumberText.grouped`. */
export const groupedInt = (n: number): string => {
  const abs = Math.round(Math.abs(n));
  const text = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return n < 0 && abs !== 0 ? `−${text}` : text;
};

/** Pesos con coma decimal y un decimal como mucho: «62,5». */
export const kgText = (n: number): string => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

/** «48 min» o «1:05 h»: la cifra y su unidad por separado (la unidad va más pequeña). */
export function durationParts(ms: number): { value: string; unit: string } {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return { value: String(minutes), unit: "min" };
  return { value: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`, unit: "h" };
}

/**
 * Etiqueta de «Frente a la última vez»: solo las mejoras se destacan (en dorado). Lo demás
 * enseña la cifra de hoy en gris, sin restas que desanimen.
 */
export function compareTag(item: Pick<WorkoutReviewItem, "trend" | "change" | "today">): { text: string; highlight: boolean } {
  if (item.trend === "up") return { text: item.change, highlight: true };
  if (item.trend === "new") return { text: "Nuevo", highlight: false };
  return { text: item.today, highlight: false };
}

/** Lo que más se celebra de la sesión: un récord o lo que sube el volumen. Nunca una bajada. */
export function sessionHighlight(p: { records: string[]; volumeKg: number; previousVolumeKg?: number }): string | null {
  if (p.records.length) return `Nuevo récord · ${p.records[0]}`;
  const prev = p.previousVolumeKg || 0;
  const gain = p.volumeKg - prev;
  if (prev > 0 && gain > 0) return `+${groupedInt(gain)} kg más que la última vez`;
  return null;
}

/** «Pecho, hombros y tríceps»: los tres músculos con más series. */
export function muscleLine(muscles: string[], counts: Record<string, number> = {}): string {
  const top = [...muscles].sort((a, b) => (counts[b] || 0) - (counts[a] || 0)).slice(0, 3);
  const low = top.map((m, i) => (i ? m.toLowerCase() : m));
  return low.length > 1 ? `${low.slice(0, -1).join(", ")} y ${low[low.length - 1]}` : low[0] ?? "";
}
