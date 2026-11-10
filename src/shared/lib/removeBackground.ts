/**
 * Quita el fondo blanco de las imágenes de ejercicios antes de guardarlas.
 * Solo se borra el blanco conectado con el borde (relleno desde los bordes),
 * así el blanco dentro del atleta (ojos, ropa clara) se conserva.
 * GIF y APNG animados se convierten en APNG transparente fotograma a fotograma.
 */

/** Cuánto "blanco de fondo" tiene un píxel: 0 = color del atleta, 1 = fondo puro. */
const whiteness = (r: number, g: number, b: number) => {
  const min = Math.min(r, g, b), max = Math.max(r, g, b);
  if (max - min > 40) return 0; // con color: es del atleta
  return Math.max(0, Math.min(1, (min - 170) / 70));
};

/**
 * Pure: vuelve transparente el fondo claro conectado con el borde y deja un contorno
 * limpio: tolera el tramado de los GIF, suaviza el borde y descontamina el halo blanco.
 * Modifica `data`.
 */
export const clearWhiteBackground = (data: Uint8ClampedArray | Uint8Array, w: number, h: number, threshold = 215) => {
  const n = w * h;
  const isBg = (i: number) => {
    const p = i * 4;
    if (data[p + 3] === 0) return true;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    return Math.min(r, g, b) >= threshold && Math.max(r, g, b) - Math.min(r, g, b) <= 30;
  };
  const seen = new Uint8Array(n);
  const stack: number[] = [];
  const push = (i: number) => { if (!seen[i] && isBg(i)) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  let cleared = 0;
  while (stack.length) {
    const i = stack.pop()!;
    data[i * 4 + 3] = 0; cleared++;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  // Anillo de 1 px al fondo para el borde suave.
  const dist = new Uint8Array(n).fill(9);
  for (let i = 0; i < n; i++) if (seen[i]) dist[i] = 0;
  for (let pass = 1; pass <= 1; pass++) {
    for (let i = 0; i < n; i++) {
      if (dist[i] !== 9) continue;
      const x = i % w, y = (i / w) | 0;
      const near = (x > 0 && dist[i - 1] === pass - 1) || (x < w - 1 && dist[i + 1] === pass - 1) || (y > 0 && dist[i - w] === pass - 1) || (y < h - 1 && dist[i + w] === pass - 1);
      if (near) dist[i] = pass;
    }
  }
  for (let i = 0; i < n; i++) {
    const d = dist[i];
    if (d === 0 || d === 9) continue;
    const p = i * 4;
    const wh = whiteness(data[p], data[p + 1], data[p + 2]) * (d === 1 ? 1 : 0.6);
    let a = 1 - wh;
    if (d === 1 && wh > 0) a = Math.min(a, 0.85); // antialias en el borde claro
    if (a <= 0.04) { data[p + 3] = 0; continue; }
    // Quita el blanco mezclado del color (sin halo claro sobre fondo oscuro).
    for (let c = 0; c < 3; c++) data[p + c] = Math.max(0, Math.min(255, Math.round((data[p + c] - (1 - a) * 255) / a)));
    data[p + 3] = Math.round(data[p + 3] * a);
  }
  return cleared;
};

/** Lado mínimo al que se amplían los GIF pequeños para que no se vean pixelados en pantallas retina. */
export const TARGET_SIDE = 540;

/** Pure: factor de ampliación entero (1 si ya es grande). */
export const upscaleFactor = (w: number, h: number, target = TARGET_SIDE) => Math.max(1, Math.min(4, Math.ceil(target / Math.max(w, h))));

/** Pure: ampliación bicúbica (Catmull-Rom) RGBA; suaviza los dientes de sierra del GIF. */
export const upscaleRGBA = (src: Uint8ClampedArray | Uint8Array, w: number, h: number, f: number) => {
  if (f <= 1) return { data: new Uint8ClampedArray(src), w, h };
  const W = w * f, H = h * f, out = new Uint8ClampedArray(W * H * 4);
  const k = (t: number) => { t = Math.abs(t); return t < 1 ? 1.5 * t ** 3 - 2.5 * t ** 2 + 1 : t < 2 ? -0.5 * t ** 3 + 2.5 * t ** 2 - 4 * t + 2 : 0; };
  const px = (x: number, y: number, c: number) => src[((Math.min(h - 1, Math.max(0, y)) * w) + Math.min(w - 1, Math.max(0, x))) * 4 + c];
  for (let Y = 0; Y < H; Y++) {
    const sy = (Y + 0.5) / f - 0.5, y0 = Math.floor(sy), ty = sy - y0;
    for (let X = 0; X < W; X++) {
      const sx = (X + 0.5) / f - 0.5, x0 = Math.floor(sx), tx = sx - x0;
      const acc = [0, 0, 0, 0];
      for (let j = -1; j <= 2; j++) { const wy = k(j - ty); for (let i = -1; i <= 2; i++) { const wgt = wy * k(i - tx); for (let c = 0; c < 4; c++) acc[c] += px(x0 + i, y0 + j, c) * wgt; } }
      const o = (Y * W + X) * 4;
      for (let c = 0; c < 4; c++) out[o + c] = acc[c];
    }
  }
  return { data: out, w: W, h: H };
};

const loadBitmap = (file: Blob) => createImageBitmap(file);

const staticToPng = async (file: Blob): Promise<Blob> => {
  const bmp = await loadBitmap(file);
  const canvas = document.createElement("canvas");
  const f = upscaleFactor(bmp.width, bmp.height);
  canvas.width = bmp.width * f; canvas.height = bmp.height * f;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  clearWhiteBackground(img.data, canvas.width, canvas.height);
  ctx.putImageData(img, 0, 0);
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error("No se pudo procesar la imagen"))), "image/png"));
};

const gifToApng = async (file: Blob): Promise<Blob> => {
  const [{ parseGIF, decompressFrames }, UPNG] = await Promise.all([import("gifuct-js"), import("upng-js").then((m) => m.default ?? m)]);
  const gif = parseGIF(await file.arrayBuffer());
  const frames = decompressFrames(gif, true);
  const w = gif.lsd.width, h = gif.lsd.height;
  const canvas = new Uint8ClampedArray(w * h * 4);
  const out: ArrayBuffer[] = [], delays: number[] = [];
  const f = upscaleFactor(w, h);
  for (const f of frames) {
    const { left, top, width, height } = f.dims;
    const before = f.disposalType === 3 ? canvas.slice() : null;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4, d = ((top + y) * w + left + x) * 4;
      if (f.patch[s + 3] === 0) continue;
      canvas[d] = f.patch[s]; canvas[d + 1] = f.patch[s + 1]; canvas[d + 2] = f.patch[s + 2]; canvas[d + 3] = 255;
    }
    const big = upscaleRGBA(canvas, w, h, f);
    clearWhiteBackground(big.data, big.w, big.h);
    out.push(big.data.buffer);
    delays.push(Math.max(20, f.delay || 100));
    if (f.disposalType === 2) for (let y = 0; y < height; y++) canvas.fill(0, ((top + y) * w + left) * 4, ((top + y) * w + left + width) * 4);
    else if (before) canvas.set(before);
  }
  const png = UPNG.encode(out, w * f, h * f, 0, delays);
  return new Blob([png], { type: "image/apng" });
};

const apngToApng = async (file: Blob): Promise<Blob> => {
  const UPNG = await import("upng-js").then((m) => m.default ?? m);
  const img = UPNG.decode(await file.arrayBuffer());
  const rgba = UPNG.toRGBA8(img);
  const f = upscaleFactor(img.width, img.height);
  const frames = rgba.map((buf: ArrayBuffer) => { const big = upscaleRGBA(new Uint8Array(buf), img.width, img.height, f); clearWhiteBackground(big.data, big.w, big.h); return big.data.buffer; });
  const delays = rgba.length > 1 ? img.frames.map((f: { delay: number }) => f.delay || 100) : undefined;
  return new Blob([UPNG.encode(frames, img.width * f, img.height * f, 0, delays)], { type: "image/apng" });
};

/** Devuelve el archivo sin fondo blanco: PNG si era estático, APNG si era animado. */
export const removeWhiteBackground = async (file: File): Promise<File> => {
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
  const base = file.name.replace(/\.[^.]+$/, "") || "ejercicio";
  if (ext === "gif" || file.type === "image/gif") return new File([await gifToApng(file)], `${base}.apng`, { type: "image/apng" });
  if (ext === "apng" || ext === "png") {
    const out = await apngToApng(file);
    return new File([out], `${base}.${ext}`, { type: ext === "apng" ? "image/apng" : "image/png" });
  }
  if (!file.type.startsWith("image/")) return file;
  return new File([await staticToPng(file)], `${base}.png`, { type: "image/png" });
};
