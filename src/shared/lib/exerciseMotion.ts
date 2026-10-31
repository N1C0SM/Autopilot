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

/** Una repetición: de la posición de estiramiento (músculo largo) a la de contracción. */
type Rail = [MotionPoint, MotionPoint, MotionPoint, MotionPoint];

export type MotionSpec = {
  /** Trayectoria de una repetición, lista para `<animateMotion path>`. */
  d: string;
  /** Reposo de la trayectoria (donde empieza y termina cada repetición). */
  start: MotionPoint;
  /** Donde el músculo trabaja más: el final del recorrido. */
  end: MotionPoint;
  /** Duración de un ciclo completo (concentric + excéntrica + pausa), en segundos. */
  duration: number;
  /** Repeticiones que sugiere el estímulo. */
  reps: number;
  /** Isométrico: el punto viaja una vez y aguanta arriba. */
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

/** Lienzo común: 100 × 56 (16:9), con el suelo en y = 46. */
export const MOTION_VIEWBOX = "0 0 100 56";
export const MOTION_FLOOR = 46;

/**
 * Raíles: por donde va de verdad cada patrón. Los cuatro puntos son la curva
 * Bézier de una repetición (inicio, dos controles, final).
 */
const RAILS: Record<MotionPattern, Rail> = {
  Empuje: [{ x: 16, y: 42 }, { x: 40, y: 38 }, { x: 62, y: 24 }, { x: 84, y: 12 }],
  "Tirón": [{ x: 84, y: 14 }, { x: 62, y: 18 }, { x: 38, y: 32 }, { x: 16, y: 40 }],
  Sentadilla: [{ x: 50, y: 10 }, { x: 34, y: 26 }, { x: 34, y: 40 }, { x: 50, y: 44 }],
  Bisagra: [{ x: 16, y: 14 }, { x: 38, y: 18 }, { x: 62, y: 30 }, { x: 84, y: 42 }],
  Core: [{ x: 18, y: 42 }, { x: 38, y: 12 }, { x: 62, y: 12 }, { x: 82, y: 42 }],
};

/**
 * Ritmo por estímulo, en segundos. La fase concéntrica es corta y viva; la
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

const round2 = (n: number): number => Math.round(n * 100) / 100;

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/**
 * Los cuatro puntos de la curva, ya con la amplitud de la carga y la letra del
 * ejercicio. Se escala desde el centro del lienzo para no salirse del cuadro.
 */
function shape(rail: Rail, seed: number, amp: number): MotionPoint[] {
  return rail.map((p, i) => ({
    x: clamp(round2(50 + (p.x - 50) * amp + jitter(seed, i, 6)), 6, 94),
    y: clamp(round2(28 + (p.y - 28) * amp + jitter(seed, i + 4, 4.5)), 5, MOTION_FLOOR - 2),
  }));
}

const pathOf = ([s, a, b, e]: MotionPoint[]): string =>
  `M${s.x} ${s.y}C${a.x} ${a.y} ${b.x} ${b.y} ${e.x} ${e.y}`;

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
  // El isométrico viaja menos: aguanta, no recorre.
  const amp = weight.amp * (stimulus === "Isométrico" ? 0.7 : 1);
  const pts = shape(RAILS[pattern], hash(input.name), amp);

  return {
    d: pathOf(pts),
    start: pts[0],
    end: pts[3],
    duration: round2(tempo.conc + tempo.ecc + tempo.pause),
    reps: tempo.reps,
    hold: stimulus === "Isométrico",
    stroke: weight.stroke,
    pattern,
    stimulus,
    label: stimulus ? `${pattern} · ${stimulus}` : pattern,
  };
}

/**
 * Tiempos del bucle para `<animateMotion>`: sube rápido (concentric), baja
 * despacio (excéntrica) y descansa. Con `hold`, viaja una vez y aguanta arriba.
 */
export function motionKeyTimes(spec: MotionSpec): { keyPoints: string; keyTimes: string } {
  const tempo = TEMPO[spec.stimulus ?? "Hipertrofia"];
  if (spec.hold) return { keyPoints: "0;1;1", keyTimes: "0;0.28;1" };
  return {
    keyPoints: "0;1;0;0",
    keyTimes: `0;${round2(tempo.conc / spec.duration)};${round2((tempo.conc + tempo.ecc) / spec.duration)};1`,
  };
}
