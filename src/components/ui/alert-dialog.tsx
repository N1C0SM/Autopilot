import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/40 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

/** La alerta de iOS: estrecha, centrada, con los botones en una fila separada por líneas. */
const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "material fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100dvh-2rem)] w-[270px] flex-col overflow-hidden rounded-[14px] outline-none data-[state=open]:animate-alert-in data-[state=closed]:animate-alert-out sm:w-[320px]",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1 overflow-y-auto px-4 pb-4 pt-5 text-center", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

interface AlertDialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Apila los botones (tres o más acciones, o etiquetas largas). */
  stacked?: boolean;
}

const AlertDialogFooter = ({ className, stacked = false, ...props }: AlertDialogFooterProps) => (
  <div
    className={cn(
      "sep-t flex shrink-0 [&>*]:min-w-0 [&>*]:flex-1",
      stacked ? "flex-col [&>*:not(:first-child)]:sep-t" : "[&>*:not(:first-child)]:sep-l",
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn("type-headline", className)} {...props} />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn("type-footnote text-foreground/90", className)} {...props} />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const alertButton =
  "inline-flex min-h-[44px] items-center justify-center px-2 py-2 text-center type-body text-primary transition-colors duration-150 active:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";

interface AlertDialogActionProps extends React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> {
  /** Acción destructiva: texto en rojo. */
  destructive?: boolean;
}

const AlertDialogAction = React.forwardRef<React.ElementRef<typeof AlertDialogPrimitive.Action>, AlertDialogActionProps>(
  ({ className, destructive = false, ...props }, ref) => {
    // Los botones de una alerta no llevan relleno. Los sitios que aún pasan
    // `bg-destructive …` se leen como "destructiva" hasta que usen la prop.
    const legacyDestructive = typeof className === "string" && className.includes("bg-destructive");
    return (
      <AlertDialogPrimitive.Action
        ref={ref}
        className={cn(alertButton, (destructive || legacyDestructive) && "text-destructive", legacyDestructive ? undefined : className)}
        {...props}
      />
    );
  },
);
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel ref={ref} className={cn(alertButton, "font-semibold", className)} {...props} />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
