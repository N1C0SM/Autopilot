import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/components/ui/label";

interface FieldProps {
  label: React.ReactNode;
  /** Un único hijo (normalmente `<Input>` o `<Textarea>`). */
  children: React.ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean | "true" | "false";
  }>;
  /** Ayuda bajo el campo (se lee también con lector de pantalla). */
  hint?: React.ReactNode;
  /** Error: sustituye al aviso, en rojo, y marca el campo como inválido. */
  error?: React.ReactNode;
  /** A la derecha de la etiqueta («Opcional», «Recomendado»). */
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * Campo de formulario único: etiqueta visible arriba, control en píldora y aviso
 * debajo. La etiqueta nunca se sustituye por el placeholder (se pierde al escribir
 * y el lector de pantalla se queda sin nombre); el placeholder solo ejemplifica.
 *
 *   <Field label="Email" hint="El de tu cuenta" error={errors.email}>
 *     <Input type="email" placeholder="tu@correo.com" />
 *   </Field>
 *
 * El `id`, `aria-describedby` y `aria-invalid` se inyectan en el hijo, así que no
 * hay que repetirlos en cada formulario.
 */
const Field = ({ label, children, hint, error, trailing, className }: FieldProps) => {
  const generated = React.useId();
  const id = children.props.id ?? generated;
  const describedBy = hint || error ? `${id}-help` : undefined;

  const control = React.cloneElement(children, {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
  });

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="type-footnote font-semibold text-muted-foreground">
          {label}
        </Label>
        {trailing ? <span className="type-footnote text-muted-foreground">{trailing}</span> : null}
      </div>
      {control}
      {error ? (
        <p id={`${id}-help`} role="alert" className="type-footnote text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-help`} className="type-footnote text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export { Field };
