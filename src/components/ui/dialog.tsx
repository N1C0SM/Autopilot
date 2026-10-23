import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.5; // px/ms

/**
 * Arrastrar el tirador hacia abajo mueve la hoja con el dedo; al soltar pasado el
 * umbral (o con impulso) se cierra, si no vuelve a su sitio. Solo el tirador inicia
 * el gesto, así el scroll del contenido nunca se secuestra.
 */
function useSheetDrag(onDismiss: () => void) {
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const start = React.useRef<number | null>(null);
  const last = React.useRef({ y: 0, t: 0, v: 0 });
  const mounted = React.useRef(true);
  React.useEffect(() => () => { mounted.current = false; }, []);

  const handleProps = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      start.current = e.clientY;
      last.current = { y: e.clientY, t: e.timeStamp, v: 0 };
      setDragging(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (start.current === null) return;
      const dt = e.timeStamp - last.current.t;
      if (dt > 0) last.current = { y: e.clientY, t: e.timeStamp, v: (e.clientY - last.current.y) / dt };
      setOffset(Math.max(0, e.clientY - start.current));
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      if (start.current === null) return;
      const distance = Math.max(0, e.clientY - start.current);
      start.current = null;
      setDragging(false);
      if (distance > DISMISS_DISTANCE || (distance > 24 && last.current.v > DISMISS_VELOCITY)) {
        onDismiss();
        // Si quien controla `open` decide no cerrar, la hoja vuelve a su sitio.
        window.setTimeout(() => { if (mounted.current) setOffset(0); }, 400);
      } else {
        setOffset(0);
      }
    },
    onPointerCancel: () => {
      start.current = null;
      setDragging(false);
      setOffset(0);
    },
  };

  const style = {
    "--sheet-offset": `${offset}px`,
    ...(offset > 0 ? { transform: `translateY(${offset}px)` } : {}),
    transition: dragging ? "none" : "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
  } as React.CSSProperties;

  return { handleProps, style };
}

const closeButtonClass =
  "absolute right-3 top-3 z-20 inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-secondary text-muted-foreground transition-opacity before:absolute before:-inset-[7px] before:content-[''] active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none";

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** En móvil, permite cerrar la hoja arrastrando el tirador. Por defecto, sí. */
  dismissible?: boolean;
}

/**
 * En el móvil es una hoja inferior (tirador, esquinas superiores redondeadas, sube
 * desde abajo, se cierra arrastrando). Desde `sm` es un diálogo centrado.
 */
const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, dismissible = true, style, ...props }, ref) => {
    const closeRef = React.useRef<HTMLButtonElement>(null);
    const drag = useSheetDrag(() => closeRef.current?.click());
    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 grid max-h-[calc(100dvh-var(--safe-top)-10px)] w-full gap-4 overflow-y-auto overscroll-contain rounded-t-[28px] bg-card px-4 pb-[max(1rem,var(--safe-bottom))] pt-3 shadow-[0_-8px_40px_rgba(0,0,0,0.45)] outline-none data-[state=open]:animate-sheet-up data-[state=closed]:animate-sheet-down",
            "sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-2xl sm:p-6 sm:shadow-2xl sm:duration-200 sm:data-[state=open]:animate-in sm:data-[state=closed]:animate-out sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
            className,
          )}
          style={{ ...drag.style, ...style }}
          {...props}
        >
          {dismissible ? (
            <div
              aria-hidden="true"
              className="sticky -top-3 z-10 -mx-4 -mb-2 -mt-3 flex h-7 cursor-grab touch-none items-start justify-center bg-card pt-2 active:cursor-grabbing sm:hidden"
              {...drag.handleProps}
            >
              <span className="h-[5px] w-9 rounded-full bg-muted-foreground/40" />
            </div>
          ) : null}
          {children}
          <DialogPrimitive.Close ref={closeRef} className={closeButtonClass}>
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 px-8 text-center sm:px-0 sm:pr-8 sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("type-headline sm:type-title3", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("type-subhead text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  closeButtonClass,
};
