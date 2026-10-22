import { forwardRef } from "react";
import autopilotLogo from "@/assets/autopilot-logo.png";

export interface ScanShareData {
  physique: number;
  potential: number;
  body_composition?: { body_fat_pct?: number | null } | null;
  headline_diagnosis?: string | null;
  summary?: string | null;
  improvements?: { label?: string | null }[] | null;
}

const MUTED = "#a1a1aa";
const GOLD = "#FFAA3C";

/** Story 1080×1920 que se exporta a PNG; mismo lenguaje visual que la story del entreno. */
const ScanShareCard = forwardRef<HTMLDivElement, { result: ScanShareData; photos: string[] }>(({ result, photos }, ref) => {
  const focus = (result.improvements ?? []).map((m) => m.label).filter((l): l is string => !!l).slice(0, 2);
  const fat = result.body_composition?.body_fat_pct;
  const stats: [string, string, string?][] = [["Potencial", result.potential.toFixed(1), GOLD]];
  if (fat) stats.push(["Grasa est.", `${fat}%`]);
  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1920,
        background: "radial-gradient(ellipse 900px 640px at 50% 0%, rgba(255,170,60,0.09) 0%, transparent 70%), linear-gradient(#08090b, #020203)",
        color: "#fafafa",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif",
        padding: "82px 76px 70px",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img loading="eager" decoding="sync" src={autopilotLogo} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />
          <span style={{ fontSize: 30, fontWeight: 700 }}>Autopilot</span>
        </div>
        <span style={{ fontSize: 28, color: MUTED, fontWeight: 500 }}>
          {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 56 }}>
        {photos.length > 0 && (
          <div style={{ display: "flex", gap: 16, height: photos.length > 1 ? 780 : 900 }}>
            {photos.map((src, i) => (
              <div key={i} style={{ flex: 1, borderRadius: 44, overflow: "hidden", background: "#111216" }}>
                <img loading="eager" decoding="sync" src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, color: MUTED, fontWeight: 600 }}>Físico</div>
          <div style={{ fontSize: 200, fontWeight: 800, letterSpacing: -6, lineHeight: 1, marginTop: 8 }}>
            {result.physique.toFixed(1)}
            <span style={{ fontSize: 60, color: MUTED, fontWeight: 600, letterSpacing: 0 }}> /10</span>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
            {stats.map(([label, value, color], i) => (
              <div key={label} style={{ padding: "0 56px", borderLeft: i ? "2px solid rgba(255,255,255,0.12)" : "none" }}>
                <div style={{ fontSize: 64, fontWeight: 700, color: color ?? "#fafafa" }}>{value}</div>
                <div style={{ fontSize: 28, color: MUTED, fontWeight: 500, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {(result.headline_diagnosis || result.summary || focus.length > 0) && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 500, lineHeight: 1.3, color: "#e4e4e7" }}>
              {(result.headline_diagnosis ?? result.summary ?? "").slice(0, 110)}
            </div>
            {focus.length > 0 && (
              <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                {focus.map((f) => (
                  <span key={f} style={{ fontSize: 28, fontWeight: 600, padding: "14px 30px", borderRadius: 999, background: "rgba(255,170,60,0.14)", color: GOLD }}>
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, color: "#52525b" }}>Lectura orientativa con IA</div>
        <div style={{ fontSize: 26, color: "#71717a", fontWeight: 500, marginTop: 8 }}>autopilotplan.com/scan</div>
      </div>
    </div>
  );
});
ScanShareCard.displayName = "ScanShareCard";

export default ScanShareCard;
