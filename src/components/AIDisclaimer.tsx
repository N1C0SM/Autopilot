import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  variant?: "default" | "compact";
  className?: string;
}

/**
 * Aviso visible exigido por el AI Act / RGPD:
 * el contenido es generado por IA y revisado por un entrenador humano.
 * No sustituye consejo médico.
 */
const AIDisclaimer = ({ variant = "default", className = "" }: Props) => {
  if (variant === "compact") {
    return (
      <p className={`text-[11px] text-muted-foreground flex items-center gap-1 ${className}`}>
        <Sparkles className="w-3 h-3 text-primary shrink-0" />
        <span>
          Generado por IA + supervisión humana ·{" "}
          <Link to="/legal/aviso-medico" className="underline hover:text-foreground">
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
        Este contenido se genera con <strong className="text-foreground">IA</strong> y se revisa por un{" "}
        <strong className="text-foreground">entrenador humano</strong>. No sustituye el consejo de un médico
        ni de un profesional sanitario.{" "}
        <Link to="/legal/aviso-medico" className="underline hover:text-foreground">
          Leer aviso completo
        </Link>
        .
      </p>
    </div>
  );
};

export default AIDisclaimer;