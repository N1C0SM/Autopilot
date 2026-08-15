import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  /** Texto de ayuda que se muestra al pasar el ratón o tocar el icono */
  text: string;
  /** Etiqueta accesible; por defecto usa el propio texto */
  label?: string;
  className?: string;
}

/**
 * Pista de ayuda contextual. Funciona con ratón (hover), teclado (focus)
 * y táctil (tap), para que en móvil también se pueda leer.
 */
const InfoHint = ({ text, label, className = "" }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label || text}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen((o) => !o);
          }}
          className={`inline-flex items-center justify-center text-muted-foreground/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full transition-colors ${className}`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
};

export default InfoHint;
