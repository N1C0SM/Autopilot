import { forwardRef } from "react";
import { formatDecimal } from "@/shared/lib/numberFormat";
import autopilotLogo from "@/shared/assets/autopilot-logo.png";
import { BRAND_GOLD, INK, INK_TEXT } from "@/shared/lib/palette";

export interface ScanShareData {
  physique: number;
  potential: number;
  body_composition?: { body_fat_pct?: number | null } | null;
  headline_diagnosis?: string | null;
  summary?: string | null;
  improvements?: { label?: string | null }[] | null;
}

const MUTED = INK_TEXT.secondary;
// Cifras con la firma de marca (.claude/design/marca.md).
const FIG = "'Big Shoulders', -apple-system, system-ui, sans-serif";
const GOLD = BRAND_GOLD;

/** Story 1080×1920 que se exporta a PNG; no incluye fotos personales por defecto. */
const ScanShareCard = forwardRef<HTMLDivElement, { result: ScanShareData }>(({ result }, ref) => {
  const focus = (result.improvements ?? []).map((m) => m.label).find((label): label is string => !!label);
  const fat = result.body_composition?.body_fat_pct;
  const stats: [string, string, string?][] = [["Potencial", formatDecimal(result.potential, 1), GOLD]];
  if (fat) stats.push(["Grasa est.", `${fat}%`]);
  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1920,
        background: `radial-gradient(ellipse 900px 640px at 50% 0%, rgba(216,178,94,0.14) 0%, transparent 70%), ${INK.base}`,
        color: INK_TEXT.primary,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif",
        padding: "82px 76px 70px",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 66 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img loading="eager" decoding="sync" src={autopilotLogo} alt="" style={{ width: 66, height: 66, objectFit: "contain" }} />
          <span style={{ fontSize: 50, fontWeight: 700 }}>Autopilot</span>
        </div>
        <span style={{ fontSize: 39, color: MUTED, fontWeight: 500 }}>
          {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 56 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "ui-rounded, -apple-system, system-ui, sans-serif", fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
            Tu análisis corporal
          </div>
          <div style={{ fontSize: 42, color: MUTED, fontWeight: 600, marginTop: 28 }}>Físico</div>
          <div style={{ fontFamily: FIG, fontSize: 240, fontWeight: 800, lineHeight: 1, marginTop: 8 }}>
            {formatDecimal(result.physique, 1)}
            <span style={{ fontFamily: "inherit", fontSize: 72, color: MUTED, fontWeight: 600 }}> /10</span>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 30, marginTop: 40 }}>
            {stats.map(([label, value, color]) => (
              <div key={label} style={{ flex: 1, minWidth: 0, padding: "48px", borderRadius: 66, background: INK.card }}>
                <div style={{ fontFamily: FIG, fontSize: 80, fontWeight: 800, color: color ?? INK_TEXT.primary }}>{value}</div>
                <div style={{ fontSize: 39, color: MUTED, fontWeight: 500, marginTop: 12 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {(result.headline_diagnosis || result.summary || focus) && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 51, fontWeight: 500, lineHeight: 1.35, color: INK_TEXT.body }}>
              {(result.headline_diagnosis ?? result.summary ?? "").slice(0, 110)}
            </div>
            {focus && <div style={{ marginTop: 28, fontSize: 45, fontWeight: 600, color: GOLD }}>{focus}</div>}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 39, color: INK_TEXT.secondary }}>Lectura orientativa con IA</div>
        <div style={{ fontSize: 39, color: INK_TEXT.primary, fontWeight: 500, marginTop: 12 }}>autopilotplan.com/scan</div>
      </div>
    </div>
  );
});
ScanShareCard.displayName = "ScanShareCard";

export default ScanShareCard;
