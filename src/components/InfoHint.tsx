import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { hapticTap } from "@/lib/native";
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
            void hapticTap();
            setOpen((o) => !o);
          }}
          className={`relative inline-flex items-center justify-center rounded-full text-muted-foreground/60 transition-colors before:absolute before:-inset-3.5 before:content-[''] active:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] type-footnote">
        {text}
      </TooltipContent>
    </Tooltip>
  );
};

export default InfoHint;
