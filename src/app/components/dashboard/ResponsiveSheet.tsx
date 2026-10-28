import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/shared/components/ui/drawer";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { cn } from "@/shared/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Ancho en escritorio. */
  desktopClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Móvil: hoja inferior casi a pantalla completa, pensada para el pulgar. Web: ventana amplia. */
const ResponsiveSheet = ({ open, onOpenChange, title, description, desktopClassName, children, footer }: Props) => {
  const mobile = useIsMobile();

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="flex h-[94dvh] flex-col">
          <DrawerHeader className="px-5 pb-2 pt-3 text-left">
            <DrawerTitle className="type-title3 font-semibold tracking-tight">{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col px-5">{children}</div>
          {footer && (
            <div className="border-t border-border/60 bg-background/80 px-5 pt-3 backdrop-blur-xl" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}>
              {footer}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("flex max-h-[88dvh] flex-col gap-4", desktopClassName ?? "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle className="type-title3 tracking-tight">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {footer && <div className="border-t border-border/60 pt-4">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
};

export default ResponsiveSheet;
