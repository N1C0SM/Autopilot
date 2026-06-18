import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";

export default function ImpersonationBanner() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("lovable-impersonating") === "1") {
        setEmail(sessionStorage.getItem("lovable-impersonating-email"));
      }
    } catch {}
  }, []);

  if (!email) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-center gap-3 text-xs sm:text-sm shadow-lg">
      <Eye className="w-4 h-4 shrink-0" />
      <span className="truncate">
        Estás viendo la app como <strong>{email}</strong>. Cualquier acción será real para este usuario.
      </span>
      <button
        onClick={() => window.close()}
        className="ml-2 inline-flex items-center gap-1 bg-black/20 hover:bg-black/30 rounded px-2 py-0.5 font-medium"
      >
        <X className="w-3 h-3" /> Salir
      </button>
    </div>
  );
}