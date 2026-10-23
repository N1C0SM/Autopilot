import { Loader2, WifiOff } from "lucide-react";
import { useState } from "react";

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
      <div className="flex w-full max-w-sm items-center gap-2 rounded-full border border-border/60 bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
        <WifiOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 type-caption1 leading-tight">
          {stillOffline ? "Sigue sin conexión" : "Sin conexión"}
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3 py-1 type-caption1 font-semibold text-primary transition-transform active:scale-95 disabled:opacity-60"
          >
            {retrying && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {retrying ? "Comprobando" : "Reintentar"}
          </button>
        )}
      </div>
    </div>
  );
};

export default OfflineBanner;
