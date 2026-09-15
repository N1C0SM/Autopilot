import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  variant?: "default" | "compact";
  className?: string;
}

/**
 * Aviso visible exigido por el AI Act / RGPD:
 * la IA solo apoya el análisis inicial; el plan y seguimiento son humanos.
 * No sustituye consejo médico.
 */
const AIDisclaimer = ({ variant = "default", className = "" }: Props) => {
  if (variant === "compact") {
    return (
      <p className={`text-[11px] text-muted-foreground flex items-center gap-1 ${className}`}>
        <Sparkles className="w-3 h-3 text-primary shrink-0" />
        <span>
          Análisis inicial asistido por IA · el plan lo prepara tu entrenador ·{" "}
          <Link to="/legal/disclaimer-medico" className="underline hover:text-foreground">
            no sustituye consejo médico
          </Link>
        </span>
      </p>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground ${className}`}
      role="note"
    >
      <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <p className="leading-snug">
        La <strong className="text-foreground">IA</strong> solo apoya este análisis inicial. Un{" "}
        <strong className="text-foreground">entrenador humano</strong> prepara y ajusta el plan. No sustituye el consejo de un médico
        ni de un profesional sanitario.{" "}
        <Link to="/legal/disclaimer-medico" className="underline hover:text-foreground">
          Leer aviso completo
        </Link>
        .
      </p>
    </div>
  );
};

export default AIDisclaimer;