import { useState } from "react";
import { Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { hapticTap, shareFileOrImage } from "@/shared/lib/native";
import { BRAND_GOLD, INK, INK_TEXT } from "@/shared/lib/palette";
import { drawBrandA } from "@/app/components/dashboard/WorkoutStoryShare";
import {
  SCAN_SHARE_COPY, scanShareDate, scanShareFocus, scanShareHeadline, scanShareStats, scoreText, type ScanResultData,
} from "@/shared/lib/scanResultFormat";

/**
 * Imagen del scan para compartir (historia 1080 × 1920), con la misma composición que
 * `ScanShareCardView` en la app y la firma del entreno (`WorkoutStoryShare`): la fecha arriba,
 * «Mi análisis físico», la nota de físico en Big Shoulders, el foco en dorado, la frase del
 * diagnóstico, tres cifras y el AP con autopilotplan.com al pie. Nunca lleva tus fotos.
 */

const F = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif";
const FIG = `"Big Shoulders", ${F}`;
const W = 1080;
const H = 1920;
const SIDE = 76;

function drawBackdrop(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = INK.base;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 100, 0, W / 2, 100, 650);
  glow.addColorStop(0, "rgba(216, 178, 94, 0.14)");
  glow.addColorStop(1, "rgba(216, 178, 94, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

/** Texto centrado que se encoge hasta caber en una línea. */
function fitText(ctx: CanvasRenderingContext2D, text: string, y: number, weight: number, size: number, min: number, family = F) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > W - SIDE * 2 && s > min) { s -= 2; ctx.font = `${weight} ${s}px ${family}`; }
  ctx.fillText(text, W / 2, y);
}

/** Hasta `max` líneas centradas; la última termina en «…» si no cabe. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, y: number, lineHeight: number, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= W - SIDE * 2 || !line) { line = next; continue; }
    lines.push(line);
    line = word;
    if (lines.length === max) break;
  }
  if (lines.length < max && line) lines.push(line);
  const cut = lines.length === max && lines.join(" ").length < text.length;
  if (cut) {
    let last = lines[max - 1];
    while (ctx.measureText(`${last}…`).width > W - SIDE * 2 && last.includes(" ")) last = last.slice(0, last.lastIndexOf(" "));
    lines[max - 1] = `${last.replace(/[.,;:]$/, "")}…`;
  }
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * lineHeight));
}

/** La nota con su «/10» al lado, siempre en una línea. */
function drawScore(ctx: CanvasRenderingContext2D, value: string, unit: string, baseline: number) {
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  const size = 240;
  ctx.font = `800 ${size}px ${FIG}`; const nw = ctx.measureText(value).width;
  ctx.font = `600 ${size * 0.27}px ${F}`; const uw = unit ? ctx.measureText(unit).width + 18 : 0;
  const x0 = W / 2 - (nw + uw) / 2;
  ctx.font = `800 ${size}px ${FIG}`; ctx.fillStyle = INK_TEXT.primary;
  ctx.fillText(value, x0, baseline);
  if (unit) {
    ctx.font = `600 ${size * 0.27}px ${F}`; ctx.fillStyle = INK_TEXT.secondary;
    ctx.fillText(unit, x0 + nw + 18, baseline);
  }
}

function drawFocus(ctx: CanvasRenderingContext2D, focus: string, y: number) {
  const label = `${SCAN_SHARE_COPY.focus} · ${focus}`;
  let fs = 34;
  ctx.font = `600 ${fs}px ${F}`;
  while (ctx.measureText(label).width + 72 > W - SIDE * 2 && fs > 22) { fs -= 1; ctx.font = `600 ${fs}px ${F}`; }
  let text = label;
  while (ctx.measureText(text).width + 72 > W - SIDE * 2 && text.length > 4) text = `${text.slice(0, -2)}…`;
  const bw = ctx.measureText(text).width + 72, bh = 68, bx = (W - bw) / 2;
  ctx.fillStyle = "rgba(216,178,94,0.14)";
  ctx.beginPath(); ctx.roundRect(bx, y, bw, bh, bh / 2); ctx.fill();
  ctx.fillStyle = BRAND_GOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, y + bh / 2 + 1);
}

function drawStats(ctx: CanvasRenderingContext2D, stats: [string, string][], y: number) {
  if (!stats.length) return;
  const cw = (W - SIDE * 2) / stats.length;
  stats.forEach(([label, value], i) => {
    const cx = SIDE + cw * i + cw / 2;
    if (i) { ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(SIDE + cw * i, y - 70, 2, 130); }
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = i === 0 ? BRAND_GOLD : INK_TEXT.primary;
    fitCell(ctx, value, cx, y, cw - 24);
    ctx.fillStyle = INK_TEXT.secondary; ctx.font = `500 39px ${F}`; ctx.fillText(label, cx, y + 50);
  });
}

function fitCell(ctx: CanvasRenderingContext2D, value: string, cx: number, y: number, maxW: number) {
  let s = 96;
  ctx.font = `800 ${s}px ${FIG}`;
  while (ctx.measureText(value).width > maxW && s > 48) { s -= 4; ctx.font = `800 ${s}px ${FIG}`; }
  ctx.fillText(value, cx, y);
}

/** El AP y la web, abajo: la firma de todo lo que sale de Autopilot (como el entreno). */
function drawSignature(ctx: CanvasRenderingContext2D) {
  drawBrandA(ctx, W / 2 - 36, H - 224, 72);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = INK_TEXT.tertiary; ctx.font = `500 39px ${F}`;
  ctx.fillText("autopilotplan.com", W / 2, H - 120);
}

export function drawScanStory(ctx: CanvasRenderingContext2D, r: ScanResultData, date = new Date()) {
  drawBackdrop(ctx);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = INK_TEXT.secondary; ctx.font = `500 39px ${F}`;
  ctx.fillText(scanShareDate(date), W / 2, 130);

  ctx.textBaseline = "alphabetic"; ctx.fillStyle = INK_TEXT.primary;
  fitText(ctx, SCAN_SHARE_COPY.title, 520, 800, 84, 44);
  ctx.fillStyle = INK_TEXT.secondary;
  fitText(ctx, SCAN_SHARE_COPY.subtitle, 578, 500, 45, 30);

  ctx.font = `600 34px ${F}`; ctx.fillText(SCAN_SHARE_COPY.hero, W / 2, 780);
  drawScore(ctx, scoreText(r.physique), typeof r.physique === "number" ? "/10" : "", 1000);

  const focus = scanShareFocus(r);
  if (focus) drawFocus(ctx, focus, 1070);

  const headline = scanShareHeadline(r);
  if (headline) {
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = INK_TEXT.body; ctx.font = `500 42px ${F}`;
    wrapText(ctx, headline, 1250, 58, 3);
  }

  drawStats(ctx, scanShareStats(r), 1560);
  drawSignature(ctx);
}

export async function renderScanStory(r: ScanResultData): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  await document.fonts?.load(`800 120px "Big Shoulders"`).catch(() => undefined);
  drawScanStory(ctx, r);
  const blob = await new Promise<Blob | null>((res) => {
    try { c.toBlob((b) => res(b), "image/png"); } catch { res(null); }
  });
  if (blob && blob.size > 0) return blob;
  // Respaldo: algunos WebKit fallan con toBlob.
  return await (await fetch(c.toDataURL("image/png"))).blob();
}

/** La misma imagen como `data:` (para subirla y enlazarla en el email del diagnóstico). */
export async function renderScanStoryDataUrl(r: ScanResultData): Promise<string> {
  const blob = await renderScanStory(r);
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** «Compartir resumen»: la hoja de compartir con la imagen (en la app la hoja ya trae «Guardar imagen»). */
export function ScanShareButton({ result, variant = "default" }: { result: ScanResultData; variant?: "default" | "secondary" }) {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    if (busy) return;
    void hapticTap();
    setBusy(true);
    try {
      const blob = await renderScanStory(result);
      // Se libera el botón antes de abrir la hoja: en iOS puede no resolverse nunca.
      setBusy(false);
      shareFileOrImage({
        blob,
        filename: `autopilot-scan-${Date.now()}.png`,
        title: SCAN_SHARE_COPY.title,
        text: "Mi análisis físico con IA en autopilotplan.com/scan",
      }).then((res) => {
        if (res.downloaded) toast.success("Imagen descargada");
      }).catch((e: unknown) => {
        const name = (e as Error)?.name || "";
        const msg = (e as Error)?.message || "";
        if (name !== "AbortError" && !msg.toLowerCase().includes("cancel")) toast.error("No se pudo compartir");
      });
    } catch {
      toast.error("No se pudo crear la imagen. Inténtalo de nuevo.");
      setBusy(false);
    }
  };
  return (
    <Button type="button" size="lg" variant={variant} className="w-full" disabled={busy} onClick={() => void share()}>
      {busy
        ? <Spinner size="sm" label="Creando imagen" className={variant === "default" ? "text-primary-foreground" : undefined} />
        : <Share aria-hidden="true" />}
      Compartir resumen
    </Button>
  );
}
