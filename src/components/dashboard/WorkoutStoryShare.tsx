import { useState } from "react";
import { Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  title: string;
  date: string;
  volumeKg: number;
  sets: number;
  exercises: number;
  records: string[];
  muscles: string[];
}

const css = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : fallback;
};

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

async function renderStory(p: Props): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const primary = css("--primary", "#d4a64a");
  const gold = "#e8c27a";
  const fg = "#fafaf9", muted = "#a1a1aa";
  const F = "system-ui, -apple-system, 'SF Pro Display', sans-serif";

  ctx.fillStyle = "#09090b"; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 760, 40, W / 2, 760, 900);
  glow.addColorStop(0, "rgba(232,194,122,0.28)");
  glow.addColorStop(0.5, "rgba(232,194,122,0.06)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  // fine grid lines for telemetry feel
  ctx.strokeStyle = "rgba(255,255,255,0.035)"; ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 90) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }

  // header pill
  ctx.textAlign = "left";
  ctx.font = `700 28px ${F}`;
  const pill = "SESIÓN VERIFICADA · AUTOPILOT";
  const pw = ctx.measureText(pill).width + 110;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.strokeStyle = "rgba(232,194,122,0.35)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(96, 120, pw, 72, 36); ctx.fill(); ctx.stroke();
  ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(136, 156, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = fg; ctx.fillText(pill, 162, 166);

  ctx.fillStyle = muted; ctx.font = `500 34px ${F}`;
  ctx.fillText(p.date.toUpperCase(), 96, 290);
  ctx.fillStyle = fg; ctx.font = `800 84px ${F}`;
  let y = wrap(ctx, p.title || "Sesión de hoy", 96, 390, W - 192, 96);

  // monumental number
  y = Math.max(y + 260, 900);
  const big = p.volumeKg > 0 ? Math.round(p.volumeKg).toLocaleString("es-ES") : String(p.sets);
  const g = ctx.createLinearGradient(0, y - 220, 0, y);
  g.addColorStop(0, "#fff7e6"); g.addColorStop(1, gold);
  ctx.fillStyle = g; ctx.font = `900 250px ${F}`;
  ctx.fillText(big, 84, y);
  ctx.fillStyle = muted; ctx.font = `600 38px ${F}`;
  ctx.fillText(p.volumeKg > 0 ? "KG LEVANTADOS HOY" : "SERIES COMPLETADAS", 100, y + 70);

  // glass stats
  y += 150;
  const stats = [
    { v: String(p.sets), l: "Series" },
    { v: String(p.exercises), l: "Ejercicios" },
    { v: String(p.records.length), l: "Récords" },
  ];
  const bw = (W - 192 - 48) / 3;
  stats.forEach((s, i) => {
    const x = 96 + i * (bw + 24);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, bw, 210, 40); ctx.fill(); ctx.stroke();
    ctx.fillStyle = fg; ctx.font = `800 86px ${F}`;
    ctx.fillText(s.v, x + 40, y + 118);
    ctx.fillStyle = muted; ctx.font = `500 30px ${F}`;
    ctx.fillText(s.l.toUpperCase(), x + 40, y + 172);
  });
  y += 290;

  if (p.records.length) {
    const rg = ctx.createLinearGradient(96, y, W - 96, y);
    rg.addColorStop(0, "rgba(232,194,122,0.30)"); rg.addColorStop(1, "rgba(232,194,122,0.08)");
    ctx.fillStyle = rg; ctx.strokeStyle = "rgba(232,194,122,0.7)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(96, y, W - 192, 150, 40); ctx.fill(); ctx.stroke();
    ctx.fillStyle = gold; ctx.font = `800 34px ${F}`;
    ctx.fillText("🏆  NUEVO RÉCORD PERSONAL", 140, y + 62);
    ctx.fillStyle = fg; ctx.font = `600 32px ${F}`;
    wrap(ctx, p.records.slice(0, 2).join(" · "), 140, y + 112, W - 280, 40, 1);
    y += 200;
  }

  if (p.muscles.length) {
    ctx.font = `600 32px ${F}`;
    let x = 96;
    for (const m of p.muscles.slice(0, 6)) {
      const w = ctx.measureText(m).width + 64;
      if (x + w > W - 96) { x = 96; y += 92; }
      if (y > H - 300) break;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, y, w, 70, 35); ctx.fill(); ctx.stroke();
      ctx.fillStyle = fg; ctx.fillText(m, x + 32, y + 46);
      x += w + 16;
    }
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(W / 2 - 60, H - 190, 120, 2);
  ctx.fillStyle = muted; ctx.font = `600 30px ${F}`;
  ctx.fillText("autopilotplan.com", W / 2, H - 120);
  void primary;

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
