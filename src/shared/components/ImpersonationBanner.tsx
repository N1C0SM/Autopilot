import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

export default function ImpersonationBanner() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("lovable-impersonating") === "1") {
        setEmail(sessionStorage.getItem("lovable-impersonating-email"));
      }
    } catch { /* Session storage may be unavailable in private browsing. */ }
  }, []);

  if (!email) return null;

  return (
    <div
      className="material fixed inset-x-0 top-0 z-[9999] sep-b"
      style={{ paddingTop: "var(--safe-top, 0px)", paddingLeft: "var(--safe-left, 0px)", paddingRight: "var(--safe-right, 0px)" }}
    >
      <div className="mx-auto flex min-h-[44px] max-w-3xl items-center gap-2 pl-4 type-footnote">
        <Eye className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <span className="min-w-0 flex-1 line-clamp-2 py-1">
          Estás viendo la app como <strong className="font-semibold">{email}</strong>. Cualquier acción será real para este usuario.
        </span>
        <button
          type="button"
          onClick={() => window.close()}
          className="inline-flex h-11 shrink-0 items-center px-4 font-semibold text-primary transition-opacity active:opacity-60"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
