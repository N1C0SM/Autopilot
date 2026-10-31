/**
 * Figura en movimiento del ejercicio (estilo Hevy/Symmetry, pero propia):
 * una silueta lateral que hace la repetición en bucle. Lógica pura y
 * determinista: dos poses por tipo de gesto y una curva de tempo
 * (sube rápido, aguanta, baja despacio, descansa). Sin fotos ni IA.
 *
 * Es una ilustración del gesto, no una demostración biomecánica validada.
 */

export type Joint = "head" | "neck" | "elbow" | "hand" | "hip" | "knee" | "foot";
export type Pose = Record<Joint, [number, number]>;
export type FigureKind = "squat" | "hinge" | "pullup" | "row" | "pushup" | "press" | "bench" | "plank";
export type FigureProp = "floor" | "pullbar" | "barbell" | "bench";

export type FigureSpec = {
  kind: FigureKind;
  a: Pose;
  b: Pose;
  /** 0–1: recorrido parcial (p. ej. dominada escapular). */
  amplitude: number;
  duration: number;
  hold: boolean;
  props: FigureProp[];
  /** Qué extremidades trabajan: se pintan en ámbar. */
  working: "arms" | "legs" | "body";
};

export const FIGURE_VIEWBOX = "0 0 120 120";

const P = (o: Pose) => o;

const POSES: Record<FigureKind, { a: Pose; b: Pose; props: FigureProp[]; working: FigureSpec["working"] }> = {
  squat: {
    a: P({ head: [60, 20], neck: [60, 30], elbow: [70, 38], hand: [80, 37], hip: [60, 60], knee: [62, 83], foot: [60, 106] }),
    b: P({ head: [64, 42], neck: [62, 52], elbow: [74, 57], hand: [84, 56], hip: [46, 82], knee: [68, 84], foot: [60, 106] }),
    props: ["floor"], working: "legs",
  },
  hinge: {
    a: P({ head: [60, 20], neck: [60, 30], elbow: [61, 45], hand: [62, 60], hip: [60, 60], knee: [61, 83], foot: [60, 106] }),
    b: P({ head: [87, 46], neck: [78, 50], elbow: [76, 64], hand: [74, 80], hip: [48, 64], knee: [60, 84], foot: [60, 106] }),
    props: ["floor", "barbell"], working: "legs",
  },
  pullup: {
    a: P({ head: [61, 31], neck: [58, 40], elbow: [59, 27], hand: [60, 14], hip: [56, 70], knee: [56, 92], foot: [58, 112] }),
    b: P({ head: [62, 11], neck: [58, 20], elbow: [51, 22], hand: [60, 14], hip: [56, 50], knee: [56, 72], foot: [58, 92] }),
    props: ["pullbar"], working: "arms",
  },
  row: {
    a: P({ head: [85, 44], neck: [76, 48], elbow: [76, 62], hand: [76, 77], hip: [46, 62], knee: [56, 84], foot: [56, 106] }),
    b: P({ head: [85, 44], neck: [76, 48], elbow: [63, 55], hand: [72, 63], hip: [46, 62], knee: [56, 84], foot: [56, 106] }),
    props: ["floor", "barbell"], working: "arms",
  },
  pushup: {
    a: P({ head: [94, 78], neck: [84, 80], elbow: [84, 92], hand: [84, 104], hip: [52, 90], knee: [34, 95], foot: [16, 100] }),
    b: P({ head: [94, 94], neck: [84, 96], elbow: [74, 98], hand: [84, 104], hip: [52, 99], knee: [34, 100], foot: [16, 102] }),
    props: ["floor"], working: "arms",
  },
  press: {
    a: P({ head: [60, 20], neck: [60, 30], elbow: [68, 40], hand: [66, 26], hip: [60, 60], knee: [61, 83], foot: [60, 106] }),
    b: P({ head: [60, 20], neck: [60, 30], elbow: [62, 17], hand: [61, 5], hip: [60, 60], knee: [61, 83], foot: [60, 106] }),
    props: ["floor", "barbell"], working: "arms",
  },
  bench: {
    a: P({ head: [80, 74], neck: [70, 76], elbow: [70, 61], hand: [70, 46], hip: [40, 76], knee: [26, 76], foot: [22, 104] }),
    b: P({ head: [80, 74], neck: [70, 76], elbow: [61, 74], hand: [70, 64], hip: [40, 76], knee: [26, 76], foot: [22, 104] }),
    props: ["floor", "bench", "barbell"], working: "arms",
  },
  plank: {
    a: P({ head: [94, 88], neck: [84, 90], elbow: [84, 104], hand: [96, 104], hip: [52, 94], knee: [34, 98], foot: [16, 103] }),
    b: P({ head: [94, 87], neck: [84, 89], elbow: [84, 104], hand: [96, 104], hip: [52, 91], knee: [34, 97], foot: [16, 103] }),
    props: ["floor"], working: "body",
  },
};

const NAME_RULES: Array<[RegExp, FigureKind]> = [
  [/plank|plancha|hollow|hold|l-sit|isom/, "plank"],
  [/dominad|pull-?up|chin|muscle|jal[oó]n|lat pull/, "pullup"],
  [/remo|row|face pull/, "row"],
  [/banca|bench|press de pecho|chest press/, "bench"],
  [/flexi|push-?up|fondo|dip/, "pushup"],
  [/militar|overhead|press|hombro|pike|handstand|pino/, "press"],
  [/peso muerto|deadlift|hip thrust|puente|rdl|bisagra|good morning|swing/, "hinge"],
  [/sentadilla|squat|zancada|lunge|prensa|pistol|step/, "squat"],
];

const PATTERN_KIND: Record<string, FigureKind> = {
  Empuje: "pushup", "Tirón": "pullup", Sentadilla: "squat", Bisagra: "hinge", Core: "plank",
};

export function resolveFigureKind(name: string, pattern?: string | null): FigureKind {
  const n = name.toLowerCase();
  for (const [re, kind] of NAME_RULES) if (re.test(n)) return kind;
  return (pattern && PATTERN_KIND[pattern]) || "squat";
}

export function exerciseFigure(input: { name: string; pattern?: string | null; stimulus?: string | null }): FigureSpec {
  const kind = resolveFigureKind(input.name, input.pattern);
  const base = POSES[kind];
  const partial = /escapular|scapular|isom|negativ/i.test(input.name) ? 0.35 : 1;
  const hold = kind === "plank" || input.stimulus === "Isométrico";
  const duration = hold ? 3.6 : input.stimulus === "Fuerza" ? 3 : 2.4;
  return { kind, a: base.a, b: base.b, amplitude: partial, duration, hold, props: base.props, working: base.working };
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/** Progreso 0–1 del gesto en un instante del ciclo (0–1): sube 30 %, aguanta 12 %, baja 45 %, descansa 13 %. */
export function figureProgress(phase: number, hold = false): number {
  const p = ((phase % 1) + 1) % 1;
  if (hold) return (1 - Math.cos(p * Math.PI * 2)) / 2;
  if (p < 0.3) return ease(p / 0.3);
  if (p < 0.42) return 1;
  if (p < 0.87) return 1 - ease((p - 0.42) / 0.45);
  return 0;
}

export function poseAt(spec: FigureSpec, progress: number): Pose {
  const t = Math.max(0, Math.min(1, progress)) * spec.amplitude;
  const out = {} as Pose;
  (Object.keys(spec.a) as Joint[]).forEach((j) => {
    const [ax, ay] = spec.a[j];
    const [bx, by] = spec.b[j];
    out[j] = [ax + (bx - ax) * t, ay + (by - ay) * t];
  });
  return out;
}
