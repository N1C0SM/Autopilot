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
} from "@/components/ui/alert-dialog";
import { hapticNotify } from "@/lib/native";

/** En táctil la alerta no enfoca ni resalta ningún botón al abrirse. */
const skipAutoFocusOnTouch = (event: Event) => {
  if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) {
    event.preventDefault();
  }
};

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Etiqueta de la acción ("Eliminar" por defecto). */
  confirmLabel?: string;
  /** Texto en rojo. `true` por defecto: casi todas las confirmaciones destruyen algo. */
  destructive?: boolean;
}

/**
 * Sustituye a `window.confirm` por la alerta de iOS. `ask()` devuelve una promesa con la
 * decisión, así que `if (!confirm(…)) return;` pasa a `if (!(await ask({ … }))) return;`.
 * Hay que pintar `dialog` una vez en el componente.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);

  const settle = useCallback((accepted: boolean) => {
    resolver.current?.(accepted);
    resolver.current = null;
    setOpen(false);
  }, []);

  const ask = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOptions(next);
      setOpen(true);
      if (next.destructive !== false) void hapticNotify("warning");
    });
  }, []);

  const destructive = options?.destructive !== false;
  const dialog = (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) settle(false); }}>
      <AlertDialogContent onOpenAutoFocus={skipAutoFocusOnTouch} {...(options?.description ? {} : { "aria-describedby": undefined })}>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          {options?.description ? <AlertDialogDescription>{options.description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction destructive={destructive} onClick={() => settle(true)}>
            {options?.confirmLabel ?? "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ask, dialog };
}
