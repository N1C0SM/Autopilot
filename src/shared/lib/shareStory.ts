import { durationParts, groupedInt } from "@/shared/lib/workoutSummaryFormat";

/**
 * Historias para compartir (entreno y scan): el mismo lienzo de 1080 × 1920, los mismos márgenes
 * seguros (nada importante en la franja de arriba ni en la de abajo que tapa Instagram) y la misma
 * rejilla en la web (canvas) y en la app (`ShareStory` en ShareStory.swift, a 360 × 640 pt ×3).
 * Todas las posiciones verticales son el centro de cada línea, salvo `hero` (línea base de la cifra).
 */
export const STORY = {
  width: 1080,
  height: 1920,
  /** Margen lateral seguro. */
  side: 96,
  /** Visual de arriba (foto real del ejercicio): de 0 a `visualEnd`, fundida a negro desde `fadeFrom`. */
  visualEnd: 980,
  fadeFrom: 400,
  /** Sin foto: el mapa muscular (frente y espalda), dos figuras de `figureHeight` de alto desde `figureTop`. */
  figureTop: 240,
  figureHeight: 440,
  figureGap: 48,
  /** Scan: anillo de la nota de físico, centrado en `ringCenter` con su diámetro y su trazo. */
  ringCenter: 480,
  ringSize: 420,
  ringStroke: 20,
  /** Fecha (36), título (76) y su línea (38). */
  eyebrow: 750,
  title: 818,
  subtitle: 880,
  /** Etiqueta de la cifra protagonista (32) y la cifra, en su línea base y su tamaño. */
  heroLabel: 972,
  hero: 1170,
  heroSize: 200,
  /** Cápsula dorada del logro (64 de alto). */
  highlight: 1262,
  /** Cifras de apoyo (88) y sus etiquetas (34). */
  stats: 1392,
  statLabel: 1452,
  /** Firma: el AP (72 de ancho) y autopilotplan.com (34). */
  mark: 1588,
  markSize: 72,
  url: 1660,
} as const;

/** La web, al pie de todo lo que sale de Autopilot (sin la palabra «Autopilot»). */
export const STORY_URL = "autopilotplan.com";

export interface WorkoutStoryStatsInput {
  volumeKg: number;
  sets: number;
  exercises: number;
  muscles: string[];
  /** Duración real (sin pausas); sin dato, la cuenta de músculos. */
  durationMs?: number | null;
}

/**
 * Las dos o tres cifras de apoyo de la historia del entreno, sin repetir la protagonista: Series
 * (si la protagonista es el volumen), Ejercicios y Minutos (u Horas) o, sin duración, Músculos.
 * Con su singular. Igual que `WorkoutShareCard.stats` en la app.
 */
export function workoutStoryStats(p: WorkoutStoryStatsInput): [string, string][] {
  const stats: [string, string][] = [];
  if (p.volumeKg > 0) stats.push([groupedInt(p.sets), p.sets === 1 ? "Serie" : "Series"]);
  stats.push([groupedInt(p.exercises), p.exercises === 1 ? "Ejercicio" : "Ejercicios"]);
  if (p.durationMs && p.durationMs > 0) {
    const d = durationParts(p.durationMs);
    stats.push([d.value, d.unit === "h" ? "Horas" : d.value === "1" ? "Minuto" : "Minutos"]);
  } else if (p.muscles.length) {
    stats.push([groupedInt(p.muscles.length), p.muscles.length === 1 ? "Músculo" : "Músculos"]);
  }
  return stats.slice(0, 3);
}
