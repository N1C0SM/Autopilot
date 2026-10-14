import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlanAvailability } from "@/lib/planCatalog";

interface Props {
  variant?: "default" | "compact";
  className?: string;
}

/**
 * Aviso visible exigido por el AI Act / RGPD. Debe ser exacto con lo que hace el
 * producto: la IA genera y adapta el plan; solo el plan Coach añade un entrenador
 * real. No sustituye consejo médico.
 */
const AIDisclaimer = ({ variant = "default", className = "" }: Props) => {
  const plans = usePlanAvailability();
  if (variant === "compact") {
    return (
      <p className={cn("type-footnote text-muted-foreground", className)}>
        Análisis asistido por IA · tu plan se adapta a ti ·{" "}
        <Link to="/legal/disclaimer-medico" className="text-primary active:opacity-60">
          no sustituye consejo médico
        </Link>
      </p>
    );
  }

  return (
    <div className={cn("flex items-start gap-3", className)} role="note">
      <Sparkles className="mt-px h-5 w-5 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
      <p className="min-w-0 flex-1 type-footnote text-muted-foreground">
        El análisis inicial se apoya en <strong className="font-semibold text-foreground">IA</strong>. Tu plan se genera y se adapta
        automáticamente a lo que registras{plans.coach ? <>; con el plan <strong className="font-semibold text-foreground">{plans.coachName}</strong>, además, Nicolás
        lo revisa y lo ajusta</> : null}. No sustituye el consejo de un médico ni de un profesional sanitario.{" "}
        <Link to="/legal/disclaimer-medico" className="text-primary active:opacity-60">
          Leer aviso completo
        </Link>
        .
      </p>
    </div>
  );
};

export default AIDisclaimer;
