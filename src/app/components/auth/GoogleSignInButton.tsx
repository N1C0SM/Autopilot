import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { signInWithGoogle } from "@/shared/lib/nativeAuth";
import { hapticNotify, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";

/** La «G» oficial de Google a cuatro colores (sus normas de marca piden no recolorearla). */
const GoogleLogo = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

type GoogleSignInButtonProps = {
  /** Ruta de vuelta tras Google; se calcula al pulsar para leer el estado de ese momento. */
  destination: () => string;
  className?: string;
};

/**
 * «Continuar con Google»: píldora secundaria con las mismas medidas que el CTA
 * dorado, para que ambas se apilen como iguales. Mientras el navegador sale
 * hacia Google queda ocupada y no admite un segundo toque.
 */
export const GoogleSignInButton = ({ destination, className }: GoogleSignInButtonProps) => {
  const [pending, setPending] = useState(false);

  // Al volver con «atrás» desde Google la página puede salir de la caché del
  // navegador con el botón aún ocupado: se libera.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => { if (event.persisted) setPending(false); };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const handleClick = async () => {
    if (pending) return;
    void hapticTap();
    setPending(true);
    const { error } = await signInWithGoogle(destination());
    if (error) {
      setPending(false);
      void hapticNotify("error");
      toast.error("No se pudo continuar con Google. Inténtalo de nuevo.");
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      className={cn("w-full rounded-full", pending && "disabled:opacity-100", className)}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={handleClick}
    >
      {pending ? <Spinner size="sm" aria-hidden="true" /> : <GoogleLogo />}
      Continuar con Google
    </Button>
  );
};
