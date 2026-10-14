import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Avisa al usuario cuando pierde la conexión (importante en móvil/gimnasio).
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: "calc(var(--safe-bottom, 0px) + 96px)" }}
    >
      <div className="material flex max-w-full items-center gap-2 rounded-full border border-border px-3.5 py-1.5 type-footnote">
        <WifiOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">Sin conexión. Guardaremos tus cambios al volver.</span>
      </div>
    </div>
  );
}
