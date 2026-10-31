/**
 * Huella de movimiento de cada ejercicio: la trayectoria de una repetición,
 * dibujada con los datos reales de la ficha (patrón, estímulo y carga). No es
 * una foto ni un vídeo: es la firma visual de Autopilot, igual en la web, en la
 * PWA, en el APK y en las apps de iPhone y Mac (`ExerciseMotion.swift`).
 *
 * Es pura y determinista: el mismo ejercicio siempre dibuja lo mismo.
 */

import { MOVEMENT_PATTERNS, STIMULUS_TYPES } from "@/shared/types/training";

export type MotionPattern = (typeof MOVEMENT_PATTERNS)[number];
export type MotionStimulus = (typeof STIMULUS_TYPES)[number];

export type MotionInput = {
  name: string;
  pattern?: string | null;
  stimulus?: string | null;
  load?: string | null;
};

export type MotionPoint = { x: number; y: number };

/** Puntos de una repetición sobre un lienzo de 100 × 56 (la posición de estiramiento y la de contracción). */
type Rail = [MotionPoint, MotionPoint, MotionPoint, MotionPoint];

export type MotionSpec = {
  /** Trayectoria de una repetición, lista para `<animateMotion path>`. */
  d: string;
  /** Donde el músculo trabaja más: el punto donde se queda el punto en reposo. */
  peak: MotionPoint;
  /** Reposo de la trayectoria. */
  start: MotionPoint;
  /** Duración de un ciclo completo (concentric + excéntrica + pausa), en segundos. */
  duration: number;
  /** Repeticiones que sugiere el estímulo (solo se insinúan, nunca se prometen). */
  reps: number;
  /** Isométrico: el punto viaja una vez y respira en su sitio. */
  hold: boolean;
  /** Grosor de la línea, en unidades del lienzo. */
  stroke: number;
  /** Patrón reconocido. */
  pattern: MotionPattern;
  /** Estímulo reconocido (null si la ficha no lo tiene). */
  stimulus: MotionStimulus | null;
  /** Texto corto y honesto para leerlo en voz alta. */
  label: string;
};

/** Lienzo común: 100 × 56, con el suelo en y = 46. */
export const MOTION_VIEWBOX = "0 0 100 56";
const FLOOR = 46;

/**
 * Raíles: de la posición de estiramiento (el músculo largo) a la de contracción
 * (el músculo corto). Cada patrón va por donde va de verdad el movimiento.
 */
const RAILS: Record<MotionPattern, Rail> = {
  Empuje: [{ x: 30, y: 38 }, { x: 46, y: 33 }, { x: 64, y: 22 }, { x: 79, y: 13 }],
  "Tirón": [{ x: 79, y: 16 }, { x: 62, y: 20 }, { x: 44, y: 30 }, { x: 28, y: 36 }],
  Sentadilla: [{ x: 50, y: 13 }, { x: 45, y: 24 }, { x: 45, y: 35 }, { x: 50, y: FLOOR - 3 }],
  Bisagra: [{ x: 26, y: 17 }, { x: 43, y: 19 }, { x: 61, y: 27 }, { x: 75, y: FLOOR - 8 }],
  Core: [{ x: 39, y: 35 }, { x: 45, y: 26 }, { x: 55, y: 26 }, { x: 61, y: 35 }],
};

/**
 * Ritmo por estímulo (en segundos). La fase concéntrica es corta y viva; la
 * excéntrica, más lenta; la pausa deja respirar el bucle.
 */
const TEMPO: Record<MotionStimulus, { conc: number; ecc: number; pause: number; reps: number }> = {
  Fuerza: { conc: 0.85, ecc: 2.3, pause: 1.5, reps: 3 },
  Hipertrofia: { conc: 0.8, ecc: 1.6, pause: 0.45, reps: 4 },
  Resistencia: { conc: 0.42, ecc: 0.75, pause: 0.15, reps: 6 },
  "Isométrico": { conc: 1.1, ecc: 1.1, pause: 3.0, reps: 2 },
};

/** Carga: cuánto se abre la trayectoria y cuánto pesa la línea. */
const WEIGHT: Record<string, { amp: number; stroke: number }> = {
  Alta: { amp: 1, stroke: 2.2 },
  Media: { amp: 0.82, stroke: 1.8 },
  Baja: { amp: 0.64, stroke: 1.5 },
};

/** FNV-1a: pequeña, rápida y estable entre plataformas. */
const hash = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Devía los controles de la curva unos píxeles para que cada ejercicio tenga su letra. */
const jitter = (seed: number, index: number, span: number): number => {
  const wave = Math.sin(seed * 0.0001 + index * 1.7) * 0.5 + Math.sin(seed * 0.0007 + index) * 0.5;
  return Math.round(wave * span * 100) / 100;
};

const railPath = (rail: Rail, seed: number, amp: number): string => {
  const [p0, c1, c2, p1] = rail;
  // Todo se escala desde el centro del lienzo: la amplitud abre o cierra el gesto.
  const at = (p: MotionPoint, i: number): MotionPoint => ({
    x: Math.round((50 + (p.x - 50) * amp + jitter(seed, i, 2.4)) * 100) / 100,
    y: Math.round((28 + (p.y - 28) * amp + jitter(seed, i + 4, 1.8)) * 100) / 100,
  });
  const s = at(p0, 0);
  const a = at(c1, 1);
  const b = at(c2, 2);
  const e = at(p1, 3);
  return `M${s.x} ${s.y}C${a.x} ${a.y} ${b.x} ${b.y} ${e.x} ${e.y}`;
};

/**
 * La huella del ejercicio, o `null` si la ficha no tiene patrón: sin patrón no
 * hay movimiento que dibujar y la pantalla enseña la foto en su lugar.
 */
export function exerciseMotion(input: MotionInput): MotionSpec | null {
  const pattern = MOVEMENT_PATTERNS.find((p) => p === input.pattern);
  if (!pattern) return null;

  const stimulus = STIMULUS_TYPES.find((s) => s === input.stimulus) ?? null;
  const tempo = TEMPO[stimulus ?? "Hipertrofia"];
  const weight = WEIGHT[input.load ?? "Media"] ?? WEIGHT.Media;
  const seed = hash(input.name);

  const rail = RAILS[pattern];
  const peak = rail[3];
  const start = rail[0];

  return {
    d: railPath(rail, seed, weight.amp),
    peak,
    start,
    duration: Math.round((tempo.conc + tempo.ecc + tempo.pause) * 100) / 100,
    reps: tempo.reps,
    hold: stimulus === "Isométrico",
    stroke: weight.stroke,
    pattern,
    stimulus,
    label: stimulus ? `${pattern} · ${stimulus}` : pattern,
  };
}

/**
 * Tiempos de `keyTimes` para un ciclo: sube rápido (concentric), baja despacio
 * (excéntrica) y descansa. Con `hold`, viaja una vez y se queda arriba.
 */
export function motionKeyTimes(spec: MotionSpec): { keyPoints: string; keyTimes: string } {
  const stimulus = spec.stimulus ?? "Hipertrofia";
  const tempo = TEMPO[stimulus];
  if (spec.hold) return { keyPoints: "0;1;1", keyTimes: "0;0.28;1" };
  const total = spec.duration;
  const up = Math.round((tempo.conc / total) * 1000) / 1000;
  const down = Math.round(((tempo.conc + tempo.ecc) / total) * 1000) / 1000;
  return { keyPoints: "0;1;0;0", keyTimes: `0;${up};${down};1` };
}
