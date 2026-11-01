import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { isIOSNative } from "@/shared/lib/platform";
import { hapticTap } from "@/shared/lib/native";

interface Props {
  className?: string;
  align?: "start" | "center";
  label?: string;
  /** compact = badges más pequeños (hero); default = tamaño estándar (footer). */
  size?: "default" | "compact";
  /** Envuelve los badges con su contexto (título, texto), que así solo aparece si hay alguno que enseñar. */
  wrap?: (badges: ReactNode) => ReactNode;
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

const AppStoreBadges = (props: Props) => {
  // iOS v1: ya estás dentro de la app; no mostramos badges de descarga.
  if (isIOSNative()) return null;
  return <StoreBadges {...props} />;
};

const StoreBadges = ({
  className = "",
  align = "center",
  label,
  size = "default",
  wrap,
}: Props) => {
  // Sin URLs configuradas en Ajustes no se muestra ningún badge: nunca enlazamos
  // a una app de terceros como valor por defecto.
  const [appStoreUrl, setAppStoreUrl] = useState("");
  const [playStoreUrl, setPlayStoreUrl] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("get_public_settings");
        if (!alive || error) return;
        const row = Array.isArray(data) ? data[0] : data;
        // El switch «Descarga de la app» del admin apaga las insignias en toda la web.
        if (row && row.show_app_download !== false) {
          setAppStoreUrl((row.app_store_url || "").trim());
          setPlayStoreUrl((row.play_store_url || "").trim());
        }
      } catch {
        // Sin datos no mostramos badges: nunca enlazamos a otra app por defecto.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!appStoreUrl && !playStoreUrl) return null;

  const isCompact = size === "compact";
  const iconSize = isCompact ? "w-5 h-5" : "w-6 h-6";
  const bigText = isCompact ? "type-footnote" : "type-subhead";

  // Badge oficial: negro, filo gris claro, sin brillos ni sombras.
  const badge = `inline-flex items-center gap-2.5 ${isCompact ? "h-11 px-3.5" : "h-12 px-4"} rounded-media bg-black text-white ring-1 ring-white/25 transition-[opacity,transform] duration-150 ease-out active:scale-[0.97] active:opacity-80`;

  const badges = (
    <div className={`flex flex-wrap gap-2.5 ${align === "center" ? "justify-center" : "justify-start"}`}>
      {appStoreUrl && (
        <a
          href={appStoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Descargar en la App Store"
          onClick={() => void hapticTap()}
          className={badge}
        >
          <AppleGlyph className={`${iconSize} shrink-0`} />
          <span className="flex flex-col text-left">
            <span className="type-caption2 opacity-70">Descarga en</span>
            <span className={`${bigText} font-semibold`}>App Store</span>
          </span>
        </a>
      )}
      {playStoreUrl && (
        <a
          href={playStoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Disponible en Google Play"
          onClick={() => void hapticTap()}
          className={badge}
        >
          <PlayGlyph className={`${iconSize} shrink-0`} />
          <span className="flex flex-col text-left">
            <span className="type-caption2 opacity-70">Disponible en</span>
            <span className={`${bigText} font-semibold`}>Google Play</span>
          </span>
        </a>
      )}
    </div>
  );

  if (wrap) return <div className={className}>{wrap(badges)}</div>;

  return (
    <div className={`flex flex-col gap-3 ${align === "center" ? "items-center" : "items-start"} ${className}`}>
      {label && <span className="type-footnote text-muted-foreground">{label}</span>}
      {badges}
    </div>
  );
};

export default AppStoreBadges;
