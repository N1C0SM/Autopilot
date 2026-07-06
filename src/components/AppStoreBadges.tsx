import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  className?: string;
  align?: "start" | "center";
  label?: string;
  /** compact = badges más pequeños (hero); default = tamaño estándar (footer). */
  size?: "default" | "compact";
}

/**
 * Badges "Descarga en App Store / Google Play".
 * Si ninguna URL está configurada en src/config/appStores.ts se oculta
 * el bloque entero. Si sólo una está configurada, sólo se muestra esa.
 */
const AppleGlyph = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 384 512" aria-hidden className={className} fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM248.5 92.3c22.7-27 20.6-51.5 19.9-60.3-20 1.2-43.2 13.7-56.4 29.2-14.6 16.6-23.2 37.1-21.4 60 21.6 1.7 41.2-9.4 57.9-28.9z" />
  </svg>
);

const PlayGlyph = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 512 512" aria-hidden className={className}>
    <defs>
      <linearGradient id="pg-blue" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#00d4ff" />
        <stop offset="100%" stopColor="#0087ff" />
      </linearGradient>
      <linearGradient id="pg-red" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ff5b3a" />
        <stop offset="100%" stopColor="#e60023" />
      </linearGradient>
      <linearGradient id="pg-green" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#00e676" />
        <stop offset="100%" stopColor="#00b34a" />
      </linearGradient>
      <linearGradient id="pg-yellow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffd233" />
        <stop offset="100%" stopColor="#ffab00" />
      </linearGradient>
    </defs>
    <path fill="url(#pg-blue)" d="M60 40c-8 5-13 14-13 26v380c0 12 5 21 13 26l217-217L60 40z" />
    <path fill="url(#pg-red)" d="M394 190L322 148 258 212l64 64 72-42c22-13 22-42 0-44z" />
    <path fill="url(#pg-yellow)" d="M277 256L60 40c1 0 3 1 4 2l257 148-44 66z" />
    <path fill="url(#pg-green)" d="M277 256l45 66-257 148c-1 1-3 1-5 2l217-216z" />
  </svg>
);

const AppStoreBadges = ({
  className = "",
  align = "center",
  label,
  size = "default",
}: Props) => {
  const [appStoreUrl, setAppStoreUrl] = useState("");
  const [playStoreUrl, setPlayStoreUrl] = useState("");

  useEffect(() => {
    let alive = true;
    supabase.rpc("get_public_settings").then(({ data }) => {
      if (!alive) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setAppStoreUrl(((row as any).app_store_url || "").trim());
        setPlayStoreUrl(((row as any).play_store_url || "").trim());
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!appStoreUrl && !playStoreUrl) return null;

  const wrap =
    align === "center"
      ? "flex flex-col items-center gap-3"
      : "flex flex-col items-start gap-3";

  const isCompact = size === "compact";
  const btnH = isCompact ? "h-11" : "h-[52px]";
  const btnPx = isCompact ? "px-3.5" : "px-4";
  const iconSize = isCompact ? "w-5 h-5" : "w-6 h-6";
  const smallText = isCompact ? "text-[9px]" : "text-[10px]";
  const bigText = isCompact ? "text-[13px]" : "text-sm";

  // Apple: negro con brillo sutil. Google Play: negro con acento coloreado del glifo.
  const baseBtn = `group relative inline-flex items-center gap-2.5 ${btnH} ${btnPx} rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 ring-1 ring-white/10`;
  const appleBg =
    "bg-[linear-gradient(180deg,#1f1f1f_0%,#000_100%)] text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)] hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,1)]";
  const playBg =
    "bg-[linear-gradient(180deg,#1f1f1f_0%,#000_100%)] text-white shadow-[0_10px_30px_-12px_rgba(0,135,255,0.6)] hover:shadow-[0_16px_40px_-10px_rgba(0,230,118,0.55)]";

  return (
    <div className={`${wrap} ${className}`}>
      {label && (
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-2.5 justify-center">
        {appStoreUrl && (
          <a
            href={appStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Descargar en la App Store"
            className={`${baseBtn} ${appleBg}`}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />
            <AppleGlyph className={`${iconSize} shrink-0`} />
            <span className="flex flex-col leading-tight text-left">
              <span className={`${smallText} opacity-70`}>Descarga en</span>
              <span className={`${bigText} font-semibold tracking-tight`}>App Store</span>
            </span>
          </a>
        )}
        {playStoreUrl && (
          <a
            href={playStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Disponible en Google Play"
            className={`${baseBtn} ${playBg}`}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />
            <PlayGlyph className={`${iconSize} shrink-0`} />
            <span className="flex flex-col leading-tight text-left">
              <span className={`${smallText} opacity-70`}>Disponible en</span>
              <span className={`${bigText} font-semibold tracking-tight`}>Google Play</span>
            </span>
          </a>
        )}
      </div>
    </div>
  );
};

export default AppStoreBadges;