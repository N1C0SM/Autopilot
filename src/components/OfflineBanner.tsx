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
      className="fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-xs font-medium text-destructive-foreground sm:text-sm"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      Sin conexión. Tus cambios se guardarán cuando vuelvas a tener internet.
    </div>
  );
}
