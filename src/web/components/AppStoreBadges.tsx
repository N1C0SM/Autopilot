import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { isIOSNative } from "@/shared/lib/platform";
import { hapticTap } from "@/shared/lib/native";
import { AppleLogo, GooglePlayLogo } from "@/web/components/StoreLogos";

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
          <AppleLogo className={`${iconSize} shrink-0`} />
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
          <GooglePlayLogo className={`${iconSize} shrink-0`} />
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
