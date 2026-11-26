import { useEffect, useState } from "react";
import { Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { hapticTap, shareFileOrImage } from "@/shared/lib/native";
import { BRAND_GOLD, INK_TEXT } from "@/shared/lib/palette";
import { STORY } from "@/shared/lib/shareStory";
import {
  STORY_FONT, centerText, createStoryCanvas, drawBackdrop, drawCapsule, drawHeroFigure, drawSignature, drawStats,
  exportStory, loadStoryFonts, wrapCentered,
} from "@/shared/lib/storyCanvas";
import {
  SCAN_SHARE_COPY, scanShareDate, scanShareFocus, scanShareHeadline, scanShareStats, scoreText, type ScanResultData,
} from "@/shared/lib/scanResultFormat";

/**
 * Imagen del scan para compartir (historia 1080 × 1920), con la misma rejilla y la misma firma
 * que la del entreno (`WorkoutStoryShare`) y la misma composición que `ScanShareCardView` en la
 * app: arriba la nota de físico en Big Shoulders dentro de su anillo dorado; debajo la fecha,
 * «Mi análisis físico», el foco en dorado, la frase del diagnóstico, tres cifras y el AP con
 * autopilotplan.com al pie. Nunca lleva tus fotos.
 */

const W = STORY.width;
/** Primera línea de la frase del diagnóstico (40 px, hasta tres líneas de 56). */
const HEADLINE_Y = 1090;

/** La nota de físico sobre 10 en su anillo: dorado hasta la nota, pista blanca tenue el resto. */
function drawScoreRing(ctx: CanvasRenderingContext2D, score: number | null | undefined) {
  const cx = W / 2;
  const cy = STORY.ringCenter;
  const r = (STORY.ringSize - STORY.ringStroke) / 2;
  ctx.save();
  ctx.lineWidth = STORY.ringStroke; ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  const hasScore = typeof score === "number" && Number.isFinite(score);
  if (hasScore) {
    const frac = Math.max(0, Math.min(1, score / 10));
    ctx.strokeStyle = BRAND_GOLD;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
  }
  ctx.restore();
  centerText(ctx, SCAN_SHARE_COPY.hero, cy - 110, 600, 32, 26, INK_TEXT.secondary);
  drawHeroFigure(ctx, scoreText(score), hasScore ? "/10" : "", cy + 62, 170);
}

export function drawScanStory(ctx: CanvasRenderingContext2D, r: ScanResultData, date = new Date()) {
  drawBackdrop(ctx);
  drawScoreRing(ctx, r.physique);

  centerText(ctx, scanShareDate(date), STORY.eyebrow, 500, 36, 26, INK_TEXT.secondary);
  centerText(ctx, SCAN_SHARE_COPY.title, STORY.title, 800, 76, 48, INK_TEXT.primary);
  centerText(ctx, SCAN_SHARE_COPY.subtitle, STORY.subtitle, 500, 38, 28, INK_TEXT.secondary);

  const focus = scanShareFocus(r);
  if (focus) drawCapsule(ctx, `${SCAN_SHARE_COPY.focus} · ${focus}`, STORY.heroLabel);

  const headline = scanShareHeadline(r);
  if (headline) {
    ctx.fillStyle = INK_TEXT.body; ctx.font = `500 40px ${STORY_FONT}`;
    wrapCentered(ctx, headline, HEADLINE_Y, 56, 3);
  }

  drawStats(ctx, scanShareStats(r).map(([label, value]) => [value, label]));
  drawSignature(ctx);
}

export async function renderScanStory(r: ScanResultData): Promise<Blob> {
  await loadStoryFonts();
  const { canvas, ctx } = createStoryCanvas();
  drawScanStory(ctx, r);
  return exportStory(canvas);
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
  useEffect(() => { void loadStoryFonts(); }, []);
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
