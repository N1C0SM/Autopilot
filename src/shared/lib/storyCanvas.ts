import { BRAND_A, BRAND_P, BRAND_VIEWBOX } from "@/shared/components/ui/brand-mark";
import { BRAND_GOLD, INK, INK_TEXT } from "@/shared/lib/palette";
import { STORY, STORY_URL } from "@/shared/lib/shareStory";

/**
 * Piezas de dibujo de las historias para compartir (entreno y scan), comunes a las dos para que
 * salgan iguales: fondo, foto real fundida a negro, textos que caben en una línea, la cápsula
 * dorada, las cifras de apoyo y la firma (el AP y autopilotplan.com). Su gemelo en la app es
 * `ShareStory.swift`. Inter para el texto y Big Shoulders para las cifras, como la app.
 */
export const STORY_FONT = `"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
export const STORY_FIGURE = `"Big Shoulders", ${STORY_FONT}`;

const W = STORY.width;
const H = STORY.height;
const SIDE = STORY.side;
const MAX_W = W - SIDE * 2;

/** Espera a las fuentes de la marca para que el lienzo no salga con la del sistema. */
export async function loadStoryFonts(): Promise<void> {
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (!fonts?.load) return;
  await Promise.all([
    `800 120px "Big Shoulders"`, `500 40px "Inter Variable"`, `600 40px "Inter Variable"`, `800 40px "Inter Variable"`,
  ].map((font) => fonts.load(font).catch(() => undefined)));
}

/** Monograma AP de la marca, a lo ancho del cuadro (x, y, size) y centrado en vertical. */
export function drawBrandA(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color = BRAND_GOLD) {
  const k = size / BRAND_VIEWBOX.width;
  ctx.save();
  ctx.translate(x, y + (size - BRAND_VIEWBOX.height * k) / 2); ctx.scale(k, k); ctx.translate(-BRAND_VIEWBOX.x, -BRAND_VIEWBOX.y);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(BRAND_A)); ctx.fill(new Path2D(BRAND_P));
  ctx.restore();
}

/** Negro de la marca con un halo dorado muy tenue arriba (≈12 %), detrás del visual. */
export function drawBackdrop(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = INK.base;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 470, 0, W / 2, 470, 640);
  glow.addColorStop(0, "rgba(216, 178, 94, 0.12)");
  glow.addColorStop(1, "rgba(216, 178, 94, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

/** Carga una foto para el lienzo (con CORS para poder exportarlo); null si no llega a tiempo. */
export function loadStoryImage(src: string | null | undefined, timeoutMs = 6000): Promise<HTMLImageElement | null> {
  if (!src || typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0 ? img : null); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

/**
 * Foto real a sangre arriba (recortada al hueco, con el sujeto un poco por encima del centro) y
 * fundida a negro desde `fadeFrom` hasta `visualEnd`: el texto de debajo siempre se lee.
 */
export function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const boxH = STORY.visualEnd;
  const scale = Math.max(W / img.naturalWidth, boxH / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, boxH); ctx.clip();
  // Tratamiento de marca: saturación contenida y negros profundos.
  ctx.filter = "saturate(0.85) contrast(1.04)";
  ctx.drawImage(img, (W - dw) / 2, (boxH - dh) * 0.35, dw, dh);
  ctx.filter = "none";
  ctx.restore();
  const fade = ctx.createLinearGradient(0, STORY.fadeFrom, 0, boxH);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.55, "rgba(0,0,0,0.62)");
  fade.addColorStop(1, INK.base);
  ctx.fillStyle = fade;
  ctx.fillRect(0, STORY.fadeFrom, W, boxH - STORY.fadeFrom + 1);
}

/** Texto centrado en `y` (centro de la línea) que se encoge hasta caber en una línea. */
export function centerText(ctx: CanvasRenderingContext2D, text: string, y: number, weight: number, size: number, min: number, color: string, family = STORY_FONT) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > MAX_W && s > min) { s -= 2; ctx.font = `${weight} ${s}px ${family}`; }
  let shown = text;
  while (ctx.measureText(shown).width > MAX_W && shown.length > 2) shown = `${shown.slice(0, -2).trimEnd()}…`;
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(shown, W / 2, y);
}

/** Hasta `max` líneas centradas desde `firstY`; la última termina en «…» si no cabe. */
export function wrapCentered(ctx: CanvasRenderingContext2D, text: string, firstY: number, lineHeight: number, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= MAX_W || !line) { line = next; continue; }
    lines.push(line);
    line = word;
    if (lines.length === max) break;
  }
  if (lines.length < max && line) lines.push(line);
  const cut = lines.length === max && lines.join(" ").length < text.length;
  if (cut) {
    let last = lines[max - 1];
    while (ctx.measureText(`${last}…`).width > MAX_W && last.includes(" ")) last = last.slice(0, last.lastIndexOf(" "));
    lines[max - 1] = `${last.replace(/[.,;:]$/, "")}…`;
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, W / 2, firstY + i * lineHeight));
}

/** Cifra protagonista con su unidad al lado («12.450 kg», «7,5 /10»), centrada y en una línea. */
export function drawHeroFigure(ctx: CanvasRenderingContext2D, value: string, unit: string, baseline: number, size: number, color = INK_TEXT.primary) {
  let s = size;
  const unitFont = () => `600 ${Math.round(s * 0.27)}px ${STORY_FONT}`;
  const gap = () => (unit ? s * 0.08 : 0);
  const measure = () => {
    ctx.font = `800 ${s}px ${STORY_FIGURE}`; const a = ctx.measureText(value).width;
    ctx.font = unitFont(); const b = unit ? ctx.measureText(unit).width : 0;
    return a + b + gap();
  };
  while (measure() > MAX_W && s > 80) s -= 8;
  ctx.font = `800 ${s}px ${STORY_FIGURE}`; const nw = ctx.measureText(value).width;
  ctx.font = unitFont(); const uw = unit ? ctx.measureText(unit).width : 0;
  const x0 = W / 2 - (nw + uw + gap()) / 2;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${s}px ${STORY_FIGURE}`; ctx.fillStyle = color;
  ctx.fillText(value, x0, baseline);
  if (unit) {
    ctx.font = unitFont(); ctx.fillStyle = INK_TEXT.secondary;
    ctx.fillText(unit, x0 + nw + gap(), baseline);
  }
}

/** Cápsula dorada tenue centrada en `y` (el logro o el foco): el único acento junto al AP. */
export function drawCapsule(ctx: CanvasRenderingContext2D, label: string, y: number) {
  let fs = 32;
  ctx.font = `600 ${fs}px ${STORY_FONT}`;
  while (ctx.measureText(label).width + 72 > MAX_W && fs > 24) { fs -= 1; ctx.font = `600 ${fs}px ${STORY_FONT}`; }
  let text = label;
  while (ctx.measureText(text).width + 72 > MAX_W && text.length > 4) text = `${text.slice(0, -2).trimEnd()}…`;
  const bw = ctx.measureText(text).width + 72, bh = 64, bx = (W - bw) / 2;
  ctx.fillStyle = "rgba(216,178,94,0.14)";
  ctx.beginPath(); ctx.roundRect(bx, y - bh / 2, bw, bh, bh / 2); ctx.fill();
  ctx.fillStyle = BRAND_GOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, y + 1);
}

/** Dos o tres cifras de apoyo en columnas, sin cajas y separadas por líneas finas. */
export function drawStats(ctx: CanvasRenderingContext2D, stats: [string, string][]) {
  if (!stats.length) return;
  const cw = MAX_W / stats.length;
  stats.forEach(([value, label], i) => {
    const cx = SIDE + cw * i + cw / 2;
    if (i) { ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(SIDE + cw * i - 1, STORY.stats - 52, 2, STORY.statLabel - STORY.stats + 74); }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let s = 88;
    ctx.font = `800 ${s}px ${STORY_FIGURE}`;
    while (ctx.measureText(value).width > cw - 24 && s > 48) { s -= 4; ctx.font = `800 ${s}px ${STORY_FIGURE}`; }
    ctx.fillStyle = INK_TEXT.primary;
    ctx.fillText(value, cx, STORY.stats);
    ctx.fillStyle = INK_TEXT.secondary; ctx.font = `500 34px ${STORY_FONT}`;
    ctx.fillText(label, cx, STORY.statLabel);
  });
}

/** Firma común a todo lo que sale de Autopilot (historias del entreno y del scan): el AP y la web. */
export function drawSignature(ctx: CanvasRenderingContext2D) {
  const size = STORY.markSize;
  drawBrandA(ctx, W / 2 - size / 2, STORY.mark - size / 2, size);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = INK_TEXT.secondary; ctx.font = `500 34px ${STORY_FONT}`;
  ctx.fillText(STORY_URL, W / 2, STORY.url);
}

/** Lienzo de 1080 × 1920 listo para dibujar. */
export function createStoryCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  return { canvas, ctx };
}

/** PNG del lienzo (con respaldo para los WebKit en los que falla `toBlob`). */
export async function exportStory(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((res) => {
    try { canvas.toBlob((b) => res(b), "image/png"); } catch { res(null); }
  });
  if (blob && blob.size > 0) return blob;
  return await (await fetch(canvas.toDataURL("image/png"))).blob();
}
