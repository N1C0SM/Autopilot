import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      offset="calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 8px)"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast material !rounded-[22px] !border-0 !px-4 !py-3 group-[.toaster]:text-foreground group-[.toaster]:shadow-[0_10px_40px_rgba(0,0,0,0.5)]",
          title: "group-[.toast]:text-[15px] group-[.toast]:font-medium",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-[13px]",
          success: "group-[.toast]:[&_[data-icon]]:text-success",
          error: "group-[.toast]:[&_[data-icon]]:text-destructive",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-full",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-full",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
