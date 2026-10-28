import * as React from "react";

import { cn } from "@/shared/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "field flex h-auto min-h-[88px] w-full py-2.5 text-foreground transition-colors duration-150 placeholder:text-muted-foreground/70 focus-visible:outline-none md:focus-visible:ring-2 md:focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
