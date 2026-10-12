import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
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
      <p className={`flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
        <Sparkles className="w-3 h-3 text-primary shrink-0" />
        <span>
          Análisis asistido por IA · tu plan se adapta a ti ·{" "}
          <Link to="/legal/disclaimer-medico" className="underline hover:text-foreground">
            no sustituye consejo médico
          </Link>
        </span>
      </p>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground ${className}`}
      role="note"
    >
      <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <p className="leading-snug">
        El análisis inicial se apoya en <strong className="text-foreground">IA</strong>. Tu plan se genera y se adapta
        automáticamente a lo que registras{plans.coach ? <>; con el plan <strong className="text-foreground">{plans.coachName}</strong>, además, Nicolás
        lo revisa y lo ajusta</> : null}. No sustituye el consejo de un médico ni de un profesional sanitario.{" "}
        <Link to="/legal/disclaimer-medico" className="underline hover:text-foreground">
          Leer aviso completo
        </Link>
        .
      </p>
    </div>
  );
};

export default AIDisclaimer;