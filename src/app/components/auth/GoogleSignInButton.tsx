import { useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/shared/integrations/lovable";
import { hapticNotify, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";

const GoogleLogo = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" className="h-[18px] w-[18px]">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

type Props = { label?: string; next?: string; className?: string; onBeforeRedirect?: () => void };

/** «Continuar con Google»: píldora de contorno fino, como los botones secundarios de la portada. */
export const GoogleSignInButton = ({ label = "Continuar con Google", next, className, onBeforeRedirect }: Props) => {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    void hapticTap();
    setBusy(true);
    onBeforeRedirect?.();
    try { if (next) sessionStorage.setItem("autopilot:oauth-next", next); } catch { /* opcional */ }
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setBusy(false);
      void hapticNotify("error");
      toast.error("No se pudo continuar con Google");
      return;
    }
    if (result.redirected) return;
    window.location.assign(next || "/dashboard");
  };
  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      className={cn(
        "inline-flex h-[50px] w-full items-center justify-center gap-2.5 rounded-full border border-foreground/20 bg-transparent text-[16px] font-medium text-foreground",
        "transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-foreground/5 disabled:opacity-60",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <GoogleLogo />
      <span>{busy ? "Abriendo Google…" : label}</span>
    </button>
  );
};
