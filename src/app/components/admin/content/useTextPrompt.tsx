import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Input } from "@/shared/components/ui/input";
import { MONO_FIELD } from "@/app/components/admin/content/AdminContentParts";
import { cn } from "@/shared/lib/utils";

export interface TextPromptOptions {
  title: string;
  description?: string;
  initialValue?: string;
  /** Etiqueta de la acción ("Guardar" por defecto). */
  confirmLabel?: string;
  /** Muestra un valor para copiarlo a mano: seleccionado, sin "Cancelar" y en monoespaciada. */
  readOnly?: boolean;
}

/**
 * Sustituye a `window.prompt` por la alerta de iOS con un campo de texto. `ask()` devuelve el
 * texto, o `null` si se cancela, así que `const x = prompt(…)` pasa a `const x = await ask({ … })`.
 * Hay que pintar `dialog` una vez en el componente.
 */
export function useTextPrompt() {
  const [options, setOptions] = useState<TextPromptOptions | null>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const resolver = useRef<((result: string | null) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const settle = useCallback((result: string | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpen(false);
  }, []);

  const ask = useCallback((next: TextPromptOptions) => {
    resolver.current?.(null);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
      setOptions(next);
      setValue(next.initialValue ?? "");
      setOpen(true);
    });
  }, []);

  const readOnly = options?.readOnly === true;
  const dialog = (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) settle(null); }}>
      <AlertDialogContent
        {...(options?.description ? {} : { "aria-describedby": undefined })}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus({ preventScroll: true });
          if (readOnly) inputRef.current?.select();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          {options?.description ? <AlertDialogDescription>{options.description}</AlertDialogDescription> : null}
          <Input
            ref={inputRef}
            aria-label={options?.title}
            value={value}
            readOnly={readOnly}
            className={cn("mt-3 text-left", readOnly && MONO_FIELD)}
            autoCapitalize={readOnly ? "none" : "sentences"}
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            onChange={(e) => setValue(e.target.value)}
            onFocus={readOnly ? (e) => e.currentTarget.select() : undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                settle(readOnly ? null : value);
              }
            }}
          />
        </AlertDialogHeader>
        <AlertDialogFooter>
          {readOnly ? null : <AlertDialogCancel>Cancelar</AlertDialogCancel>}
          <AlertDialogAction onClick={() => settle(readOnly ? null : value)}>
            {options?.confirmLabel ?? (readOnly ? "Listo" : "Guardar")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ask, dialog };
}
