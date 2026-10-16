import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/native";

/**
 * Valores técnicos (URLs, claves) dentro de un campo: monoespaciada a 13 px.
 * `.field` fija 17 px, así que el tamaño del tipo lleva `!` para ganarle.
 */
export const MONO_FIELD = "font-mono !type-footnote";

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipBarProps<T extends string> {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
  className?: string;
}

/**
 * Barra de chips con scroll horizontal para filtrar una lista (más de cinco opciones
 * o etiquetas largas no caben en un segmentado). Seleccionado = tinte al 15 %.
 * El botón mide 44 pt de alto; el chip visible, 34.
 */
export function ChipBar<T extends string>({ options, value, onChange, className, "aria-label": ariaLabel }: ChipBarProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("no-scrollbar flex items-center overflow-x-auto", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              void hapticSelection();
              onChange(option.value);
            }}
            className="group flex h-11 shrink-0 items-center px-1 first:pl-0 last:pr-0 focus-visible:outline-none"
          >
            <span
              className={cn(
                "flex h-[34px] items-center whitespace-nowrap rounded-full px-4 type-subhead font-medium transition-colors duration-150 group-active:opacity-60 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                selected ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface FieldRowProps {
  /** Etiqueta sobre el campo. Sin ella, `children` se pinta tal cual (varias columnas). */
  label?: ReactNode;
  /** `id` del campo: la etiqueta es un `<label>`. Sin él es un texto. */
  htmlFor?: string;
  /** Dos columnas (precio y días, nombre y apellido…). */
  columns?: boolean;
  children: ReactNode;
}

/** Etiqueta pequeña sobre un campo dentro de una fila de formulario. */
export const Field = ({ label, htmlFor, children }: { label: ReactNode; htmlFor?: string; children: ReactNode }) => {
  const labelClass = "mb-1.5 block type-footnote text-muted-foreground";
  return (
    <div className="min-w-0">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>{label}</label>
      ) : (
        <p className={labelClass}>{label}</p>
      )}
      {children}
    </div>
  );
};

/**
 * Fila de un formulario agrupado dentro de un `ListGroup`: etiqueta, campo `bg-secondary`
 * y un separador de 0,5 pt con la misma sangría que las `ListRow`.
 */
export const FieldRow = ({ label, htmlFor, columns, children }: FieldRowProps) => (
  <div className="group/field px-4">
    <div className={cn("sep-b py-3 group-[:last-child]/field:border-b-0", columns && "grid grid-cols-2 gap-3")}>
      {label ? <Field label={label} htmlFor={htmlFor}>{children}</Field> : children}
    </div>
  </div>
);
