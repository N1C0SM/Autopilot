/**
 * Colores literales del producto que no pueden leer un token CSS.
 *
 * Existen tres casos legítimos: lo que se pinta en un `<canvas>` (imágenes que la app
 * exporta), lo que se serializa a HTML/PDF (email, vista previa) y los colores que son
 * DATOS (actividades del calendario, insignias de las tiendas). Todo lo demás usa los
 * tokens de `index.css`.
 *
 * Se declaran una sola vez aquí para que el sistema tenga una única fuente también
 * fuera del CSS: si mañana cambia el dorado, se cambia en un sitio.
 */

/** Dorado de marca (token `--primary` = hsl(41 61% 61%) = #D8B25E). Mismo en web, app y canvas. */
export const BRAND_GOLD = "#D8B25E";

/** Lienzo de las imágenes exportadas (historia de entrenamiento, scan). */
export const INK = {
  base: "#000000",
  mid: "#000000",
  deep: "#000000",
  card: "#111113",
  line: "#1C1C1E",
  silhouette: "#3d3d40",
  /** Fondo del lienzo que captura html2canvas en el scan. */
  scanCanvas: "#000000",
} as const;

/** Sombreado del mapa muscular: luces y sombras sobre la silueta (no son color de marca). */
export const SHADING = {
  highlight: "#fff",
  shadow: "#000",
} as const;

/** Máscaras CSS: el negro es opacidad, no color. */
export const MASK_OPAQUE = "#000";

/** Texto sobre esas imágenes: mismos pasos que `foreground` y `muted-foreground`. */
export const INK_TEXT = {
  primary: "#FFFFFF",
  body: "#F5F5F7",
  secondary: "#A8A8AE",
  tertiary: "#A8A8AE",
  faint: "#A8A8AE",
} as const;

/** Mapa muscular: de «poco trabajado» a «mucho» en la sesión. */
export const MUSCLE_HEAT = {
  none: INK.silhouette,
  low: "#f0c36a",
  mid: "#f5a742",
  high: "#ff7a28",
  glow: "rgba(255,150,50,0.8)",
} as const;

/**
 * Colores de las actividades del calendario. Son datos del usuario (cada tipo de
 * actividad conserva su color al exportar el calendario), no interfaz.
 */
export const ACTIVITY_COLORS = {
  orange: "#f97316",
  green: "#10b981",
  red: "#ef4444",
  cyan: "#06b6d4",
  sky: "#0ea5e9",
  lime: "#84cc16",
  yellow: "#eab308",
  purple: "#a855f7",
  pink: "#ec4899",
  slate: "#64748b",
} as const;

/** Colores oficiales del logo de Google Play (arte de marca, no se recolorea). */
export const STORE_BADGE = {
  playBlue: "#4285f4",
  playGreen: "#34a853",
  playYellow: "#fbbc04",
  playRed: "#ea4335",
} as const;

/** Confeti de celebración (canvas-confetti): dorados de marca, no interfaz. */
export const CONFETTI_COLORS = ["#FFD700", "#FFA500", "#FF8C00", "#F59E0B"] as const;

/** Aviso de error dentro del HTML serializado de la vista previa de email. */
export const EMAIL_ERROR = "#b00020";

/**
 * Tema del editor de plantillas de email (Monaco). No puede usar variables CSS
 * porque Monaco pinta en su propio lienzo; los valores son los grises de iOS.
 */
export const MONACO_THEME = {
  background: "#1C1C1E",
  foreground: "#F7F5F3",
  lineHighlight: "#2C2C2E",
  lineNumber: "#8E8E93",
  lineNumberActive: "#EBEBF5",
  caret: BRAND_GOLD,
  selection: "#E8BB7344",
  selectionInactive: "#E8BB7322",
  bracketMatch: "#E8BB7333",
  bracketMatchBorder: BRAND_GOLD,
  indentGuide: "#38383A",
  indentGuideActive: "#636366",
  whitespace: "#38383A",
  scrollbar: "#63636655",
  scrollbarHover: "#63636688",
  scrollbarActive: "#636366AA",
  /** Colores de sintaxis (iOS): etiquetas, atributos, valores, comentarios y cifras. */
  tokens: {
    tag: "FF9F0A",
    attribute: "64D2FF",
    value: "30D158",
    comment: "8E8E93",
    number: "BF5AF2",
  },
} as const;
