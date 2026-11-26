import { WifiOff } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/shared/components/ui/spinner";

interface Props {
  /** Reintento real (normalmente el mismo refresco del pull-to-refresh). */
  onRetry?: () => Promise<unknown> | unknown;
}

/**
 * Aviso flotante de «sin conexión» sobre la barra de pestañas. No mueve el
 * contenido ni bloquea la app: se puede seguir leyendo lo ya cargado, y el
 * reintento vuelve a pedir los datos sin recargar la pantalla.
 */
const OfflineBanner = ({ onRetry }: Props) => {
  const [retrying, setRetrying] = useState(false);
  const [stillOffline, setStillOffline] = useState(false);

  const retry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    setStillOffline(false);
    try {
      await onRetry();
    } catch {
      // El aviso sigue visible; el error concreto lo muestra la pantalla.
    } finally {
      setRetrying(false);
      if (!navigator.onLine) setStillOffline(true);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 z-40 flex justify-center px-3 md:hidden"
      style={{
        bottom:
          "calc(0.75rem + env(safe-area-inset-bottom, 0px) + var(--mobile-nav-height) + 1rem)",
      }}
    >
      {/* Píldora con la profundidad de las tarjetas (sin sombra escrita a mano) y texto a 13 px como mínimo. */}
      <div className="flex min-h-12 w-full max-w-sm items-center gap-2.5 rounded-full bg-card py-1 pl-4 pr-1">
        <WifiOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate type-footnote font-medium">
          {stillOffline ? "Sigue sin conexión" : "Sin conexión"}
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary/15 px-4 type-footnote font-semibold text-primary transition-transform active:scale-95 disabled:opacity-60"
          >
            {retrying && <Spinner size="sm" className="text-primary" aria-hidden="true" />}
            {retrying ? "Comprobando" : "Reintentar"}
          </button>
        )}
      </div>
    </div>
  );
};

export default OfflineBanner;
