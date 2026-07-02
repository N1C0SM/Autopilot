import { Apple, Play } from "lucide-react";
import { APP_STORE_URL, PLAY_STORE_URL, hasAnyStoreLink } from "@/config/appStores";

interface Props {
  className?: string;
  align?: "start" | "center";
  label?: string;
}

/**
 * Badges "Descarga en App Store / Google Play".
 * Si ninguna URL está configurada en src/config/appStores.ts se oculta
 * el bloque entero. Si sólo una está configurada, sólo se muestra esa.
 */
const AppStoreBadges = ({ className = "", align = "center", label = "Descarga la app" }: Props) => {
  if (!hasAnyStoreLink()) return null;

  const wrap =
    align === "center"
      ? "flex flex-col items-center gap-3"
      : "flex flex-col items-start gap-3";

  return (
    <div className={`${wrap} ${className}`}>
      {label && (
        <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-3 justify-center">
        {APP_STORE_URL && (
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Descargar en la App Store"
            className="group inline-flex items-center gap-3 h-12 px-4 rounded-xl bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            <Apple className="w-6 h-6" />
            <span className="flex flex-col leading-tight text-left">
              <span className="text-[10px] opacity-80">Descarga en</span>
              <span className="text-sm font-semibold">App Store</span>
            </span>
          </a>
        )}
        {PLAY_STORE_URL && (
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Disponible en Google Play"
            className="group inline-flex items-center gap-3 h-12 px-4 rounded-xl bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            <Play className="w-6 h-6" />
            <span className="flex flex-col leading-tight text-left">
              <span className="text-[10px] opacity-80">Disponible en</span>
              <span className="text-sm font-semibold">Google Play</span>
            </span>
          </a>
        )}
      </div>
    </div>
  );
};

export default AppStoreBadges;