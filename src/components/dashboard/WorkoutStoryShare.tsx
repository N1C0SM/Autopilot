import { useState } from "react";
import { Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import frontAnatomy from "@/assets/muscle-map-front.png";
import backAnatomy from "@/assets/muscle-map-back.png";
import { FRONT_REGIONS, BACK_REGIONS, FRONT_SILHOUETTE, BACK_SILHOUETTE } from "./MuscleMapFigure";
import { tonnageEquivalence } from "@/lib/muscleMapping";

interface Props {
  title: string;
  date: string;
  volumeKg: number;
  sets: number;
  exercises: number;
  records: string[];
  muscles: string[];
  muscleSetCounts?: Record<string, number>;
  previousVolumeKg?: number;
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const img = new Image();
  img.onload = () => res(img); img.onerror = rej; img.src = src;
});

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number, maxLines = 2) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, x, y);
      y += lh; line = w; lines++;
      if (lines >= maxLines - 1) break;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

// Draws the same anatomy + regions as the in-app map, heat-colored by set load.
function drawFigure(ctx: CanvasRenderingContext2D, img: HTMLImageElement, side: "front" | "back", p: Props, x: number, y: number, scale: number) {
  const regions = side === "front" ? FRONT_REGIONS : BACK_REGIONS;
  const sil = new Path2D(side === "front" ? FRONT_SILHOUETTE : BACK_SILHOUETTE);
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(img, 0, 0, 399, 698);
  ctx.globalAlpha = 1;
  ctx.clip(sil);
  const counts = p.muscleSetCounts || {};
  for (const r of regions) {
    if (!p.muscles.includes(r.muscle)) continue;
    if (r.muscle === "Piernas" && side === "back" && p.muscles.includes("Isquiotibiales")) continue;
    const n = counts[r.muscle] || 1;
    const alpha = n >= 6 ? 0.95 : n >= 3 ? 0.75 : 0.45;
    const path = new Path2D((r.details ?? [r.d]).join(" "));
    ctx.shadowColor = "rgba(255,170,60,0.9)"; ctx.shadowBlur = n >= 3 ? 18 : 8;
    ctx.fillStyle = n >= 6 ? `rgba(255,120,40,${alpha})` : `rgba(240,190,90,${alpha})`;
    ctx.fill(path);
  }
  ctx.restore();
}

async function renderStory(p: Props): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const gold = "#e8c27a";
  const fg = "#fafaf9", muted = "#a1a1aa";
  const F = "system-ui, -apple-system, 'SF Pro Display', sans-serif";
  const [front, back] = await Promise.all([loadImage(frontAnatomy), loadImage(backAnatomy)]);

  ctx.fillStyle = "#09090b"; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 760, 40, W / 2, 760, 820);
  glow.addColorStop(0, "rgba(232,194,122,0.22)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // header
  ctx.textAlign = "left";
  ctx.font = `700 26px ${F}`;
  const pill = "SESIÓN VERIFICADA · AUTOPILOT";
  const pw = ctx.measureText(pill).width + 100;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.strokeStyle = "rgba(232,194,122,0.35)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(80, 100, pw, 64, 32); ctx.fill(); ctx.stroke();
  ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(116, 132, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = fg; ctx.fillText(pill, 140, 141);
  ctx.fillStyle = muted; ctx.font = `500 32px ${F}`;
  ctx.fillText(p.date.toUpperCase(), 80, 240);
  ctx.fillStyle = fg; ctx.font = `800 72px ${F}`;
  wrap(ctx, p.title || "Sesión de hoy", 80, 325, W - 160, 80, 1);

  // muscle map (front + back)
  const scale = 0.92, fw = 399 * scale;
  drawFigure(ctx, front, "front", p, W / 2 - fw - 10, 400, scale);
  drawFigure(ctx, back, "back", p, W / 2 + 10, 400, scale);
  const mapBottom = 400 + 698 * scale;

  // muscle chips
  let y = mapBottom + 30;
  ctx.font = `600 28px ${F}`;
  const top = [...p.muscles].sort((a, b) => (p.muscleSetCounts?.[b] || 0) - (p.muscleSetCounts?.[a] || 0)).slice(0, 4);
  const widths = top.map((m) => ctx.measureText(m).width + 52);
  let x = (W - (widths.reduce((a, b) => a + b, 0) + 14 * Math.max(0, top.length - 1))) / 2;
  top.forEach((m, i) => {
    ctx.fillStyle = "rgba(232,194,122,0.10)"; ctx.strokeStyle = "rgba(232,194,122,0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, widths[i], 60, 30); ctx.fill(); ctx.stroke();
    ctx.fillStyle = fg; ctx.fillText(m, x + 26, y + 40);
    x += widths[i] + 14;
  });

  // monumental number + equivalence
  ctx.textAlign = "center";
  y += 250;
  const big = p.volumeKg > 0 ? `${Math.round(p.volumeKg).toLocaleString("es-ES")} kg` : `${p.sets} series`;
  const g = ctx.createLinearGradient(0, y - 170, 0, y);
  g.addColorStop(0, "#fff7e6"); g.addColorStop(1, gold);
  ctx.fillStyle = g; ctx.font = `900 170px ${F}`;
  ctx.fillText(big, W / 2, y);
  const eq = tonnageEquivalence(p.volumeKg);
  ctx.fillStyle = gold; ctx.font = `700 24px ${F}`;
  ctx.fillText("—  TELEMETRÍA DE CARGA  —", W / 2, y + 60);
  ctx.fillStyle = fg; ctx.font = `600 40px ${F}`;
  ctx.fillText(eq ? eq.text : `${p.exercises} ejercicios completados`, W / 2, y + 112, W - 160);

  // comparison vs previous
  y += 140;
  const prev = p.previousVolumeKg || 0;
  const lines: string[] = [];
  if (prev > 0 && p.volumeKg > 0) {
    const d = p.volumeKg - prev;
    const pct = Math.round((d / prev) * 100);
    lines.push(`${d >= 0 ? "🔥 +" : "−"}${Math.abs(Math.round(d)).toLocaleString("es-ES")} kg (${pct > 0 ? "+" : ""}${pct} %) vs tu última sesión`);
  }
  if (p.records.length) lines.push(`🏆 Récord · ${p.records[0]}`);
  if (!lines.length) lines.push(`${p.sets} series · ${p.exercises} ejercicios`);
  ctx.font = `700 34px ${F}`;
  for (const line of lines.slice(0, 2)) {
    const lw = Math.min(W - 160, ctx.measureText(line).width + 80);
    ctx.fillStyle = "rgba(232,194,122,0.14)"; ctx.strokeStyle = "rgba(232,194,122,0.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect((W - lw) / 2, y, lw, 76, 38); ctx.fill(); ctx.stroke();
    ctx.fillStyle = gold; ctx.fillText(line, W / 2, y + 50, W - 220);
    y += 96;
  }

  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(W / 2 - 60, H - 150, 120, 2);
  ctx.fillStyle = muted; ctx.font = `600 30px ${F}`;
  ctx.fillText("autopilotplan.com", W / 2, H - 90);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("no blob"))), "image/png"));
}

export function WorkoutStoryShare(props: Props) {
  const [busy, setBusy] = useState(false);
  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "autopilot-entreno.png"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const run = async (mode: "share" | "download") => {
    setBusy(true);
    try {
      const blob = await renderStory(props);
      const file = new File([blob], "autopilot-entreno.png", { type: "image/png" });
      if (mode === "share" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mi entreno en Autopilot" });
      } else {
        download(blob);
        if (mode === "share") toast.success("Imagen descargada. Súbela a tu historia.");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("No se pudo crear la imagen");
    } finally { setBusy(false); }
  };
  return (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_3rem] gap-2">
      <Button type="button" variant="hero" disabled={busy} onClick={() => run("share")} className="h-12 min-w-0 px-3 text-sm">
        <Share2 className="h-4 w-4" /> <span className="truncate">Compartir en historias</span>
      </Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => run("download")} className="h-12 w-12 px-0" aria-label="Descargar imagen">
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
